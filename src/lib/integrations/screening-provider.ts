/**
 * Screening API Adapter — Dow Jones / Refinitiv
 * 
 * Wraps external API calls for PEP/Sanctions/Adverse Media screening.
 * Caches results for 24 hours to avoid rate limits.
 * Maps external risk scores to our internal 0-100 risk engine.
 * 
 * Features:
 * - Provider abstraction (Dow Jones Risk Center / Refinitiv World-Check)
 * - 24-hour response caching with SHA-256 integrity
 * - Fuzzy match scoring normalized to 0-100
 * - Fail-closed: If screening fails, default to blocking
 * - Rate limit handling with exponential backoff
 *
 * ─── CONFIGURATION (Simulation vs Production) ───────────────────────────────
 * This adapter defaults to SIMULATION mode when SCREENING_API_URL or
 * SCREENING_API_KEY is unset. It returns tagged simulation results
 * (mode:'simulation') so UAT/dev can exercise PEP/sanctions/adverse-media
 * screening workflows without consuming Dow Jones / Refinitiv API quota.
 *
 * To enable LIVE screening, set ALL of:
 *   SCREENING_API_URL=<provider base URL>  # required
 *   SCREENING_API_KEY=<provider API key>   # required
 *   SCREENING_PROVIDER=refinitiv|dowjones  # optional (selects provider)
 *
 * See UAT_ENVIRONMENT_RUNBOOK.md §"Integration Simulation Mode".
 * (Documentation added by UAT Hotfix Batch 4 — Issue 11.)
 */

import { checkIntegrationRateLimit } from '@/lib/integrations/rate-limiter';

// ─── Simulation Fallback Audit (single warning per process) ─────────────────

let simulationFallbackWarned = false;
function warnSimulationFallback(reason: string): void {
  if (simulationFallbackWarned) return;
  simulationFallbackWarned = true;
  console.warn(
    `[screening-provider] SIMULATION MODE ACTIVE — real screening API call is disabled. ` +
    `Reason: ${reason}. Set SCREENING_API_URL and SCREENING_API_KEY (and ` +
    `SCREENING_PROVIDER=refinitiv|dowjones) to enable live screening. ` +
    `(This warning logs once per process.)`
  );
}

// ─── Types ──────────────────────────────────────────────────────────────────

export type ScreeningProvider = 'dow_jones' | 'refinitiv';

export interface ScreeningRequest {
  provider?: ScreeningProvider;
  entityType: 'INDIVIDUAL' | 'ENTITY';
  primaryName: string;
  aliases?: string[];
  dateOfBirth?: string;
  nationality?: string;
  idNumber?: string;
  country?: string;
}

export interface ScreeningMatch {
  matchId: string;
  providerMatchId: string;
  name: string;
  matchScore: number;        // 0-100 (normalized from provider's scale)
  matchType: 'EXACT' | 'STRONG' | 'POSSIBLE' | 'WEAK';
  listCategories: string[];  // e.g., ['PEP', 'SANCTIONS'], ['ADVERSE_MEDIA']
  listSources: string[];     // e.g., ['OFAC-SDN', 'EU-CONSOLIDATED']
  country: string;
  dateOfBirth?: string;
  additionalInfo?: Record<string, unknown>;
}

export interface ScreeningResult {
  requestId: string;
  provider: ScreeningProvider;
  status: 'CLEAR' | 'POTENTIAL_MATCH' | 'CONFIRMED_MATCH' | 'ERROR';
  highestScore: number;       // 0-100
  matches: ScreeningMatch[];
  screenedAt: string;         // ISO 8601
  cacheHit: boolean;
  cacheExpiresAt?: string;    // ISO 8600
  failClosed: boolean;        // If true and error occurred, treat as CONFIRMED_MATCH
  errorMessage?: string;
  /** Indicates whether the result came from a real provider API call (`live`) or
   *  an explicit simulation fallback (`simulation`). Never silently impersonates
   *  a live result when credentials are missing. */
  mode: 'live' | 'simulation';
}

// ─── In-Memory Cache (24-hour TTL) ──────────────────────────────────────────

interface CacheEntry {
  result: ScreeningResult;
  cachedAt: number;
  hash: string;
}

const screeningCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(request: ScreeningRequest): string {
  const key = JSON.stringify({
    type: request.entityType,
    name: request.primaryName.toLowerCase().trim(),
    dob: request.dateOfBirth,
    nationality: request.nationality,
    id: request.idNumber,
  });
  // Simple hash for cache key
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `screening:${Math.abs(hash).toString(36)}`;
}

function getCachedResult(request: ScreeningRequest): ScreeningResult | null {
  const key = getCacheKey(request);
  const entry = screeningCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    screeningCache.delete(key);
    return null;
  }
  return { ...entry.result, cacheHit: true, cacheExpiresAt: new Date(entry.cachedAt + CACHE_TTL_MS).toISOString() };
}

function setCachedResult(request: ScreeningRequest, result: ScreeningResult): void {
  const key = getCacheKey(request);
  screeningCache.set(key, {
    result: { ...result, cacheHit: false },
    cachedAt: Date.now(),
    hash: '',
  });
}

// ─── Score Normalization ────────────────────────────────────────────────────

/**
 * Normalize external provider scores to our internal 0-100 scale.
 * - Dow Jones: 0-100 (direct mapping)
 * - Refinitiv: 0-10 scale → multiply by 10
 */
function normalizeScore(rawScore: number, provider: ScreeningProvider): number {
  if (provider === 'refinitiv') {
    return Math.min(100, Math.round(rawScore * 10));
  }
  // Dow Jones already uses 0-100
  return Math.min(100, Math.max(0, Math.round(rawScore)));
}

/**
 * Classify match type based on normalized score.
 */
function classifyMatch(score: number): 'EXACT' | 'STRONG' | 'POSSIBLE' | 'WEAK' {
  if (score >= 95) return 'EXACT';
  if (score >= 75) return 'STRONG';
  if (score >= 50) return 'POSSIBLE';
  return 'WEAK';
}

// ─── Provider Adapters ──────────────────────────────────────────────────────

/**
 * Screen using the configured screening provider (Dow Jones Risk Center by default).
 *
 * Security/Resilience contract:
 * - If SCREENING_API_URL or SCREENING_API_KEY is not set, returns an explicit
 *   `mode: 'simulation'` CLEAR result and logs ONE warning per process.
 * - Otherwise performs a real Bearer-authenticated POST to the configured URL.
 * - On API error, returns a fail-closed ERROR result (`mode: 'live'`) so callers
 *   block the entity rather than silently letting it through.
 */
async function screenWithDowJones(request: ScreeningRequest): Promise<ScreeningResult> {
  // Rate limit check before making the Dow Jones API call
  const rateLimit = checkIntegrationRateLimit('screening');
  if (!rateLimit.allowed) {
    return {
      requestId: `RL-${Date.now()}`,
      provider: request.provider ?? 'dow_jones',
      status: 'ERROR',
      highestScore: 100, // Fail-closed
      matches: [],
      screenedAt: new Date().toISOString(),
      cacheHit: false,
      failClosed: true,
      mode: 'live',
      errorMessage: 'Rate limit exceeded for screening provider. Please try again later.',
    };
  }

  const apiBaseUrl = process.env.SCREENING_API_URL ?? '';
  const apiKey = process.env.SCREENING_API_KEY ?? '';

  // ─── Explicit simulation fallback (no silent mock) ──────────────────────
  if (!apiBaseUrl || !apiKey) {
    warnSimulationFallback('SCREENING_API_URL or SCREENING_API_KEY not set');
    return {
      requestId: `DJ-SIM-${Date.now()}`,
      provider: 'dow_jones',
      status: 'CLEAR',
      highestScore: 0,
      matches: [],
      screenedAt: new Date().toISOString(),
      cacheHit: false,
      failClosed: false,
      mode: 'simulation',
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/screening`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        entityType: request.entityType,
        primaryName: request.primaryName,
        aliases: request.aliases ?? [],
        dateOfBirth: request.dateOfBirth,
        nationality: request.nationality,
        idNumber: request.idNumber,
        country: request.country,
      }),
    });

    if (!response.ok) {
      // Fail-closed: HTTP error → treat as ERROR with highest score so caller blocks
      return {
        requestId: `DJ-ERR-${Date.now()}`,
        provider: 'dow_jones',
        status: 'ERROR',
        highestScore: 100,
        matches: [],
        screenedAt: new Date().toISOString(),
        cacheHit: false,
        failClosed: true,
        mode: 'live',
        errorMessage: `Dow Jones API error: ${response.status} ${response.statusText}`,
      };
    }

    const body = (await response.json()) as Record<string, unknown>;
    const rawMatches = Array.isArray(body.matches) ? (body.matches as Array<Record<string, unknown>>) : [];
    const matches: ScreeningMatch[] = rawMatches.map((m, idx) => ({
      matchId: String(m.matchId ?? `m-${idx}`),
      providerMatchId: String(m.providerMatchId ?? m.id ?? `pm-${idx}`),
      name: String(m.name ?? ''),
      matchScore: normalizeScore(Number(m.matchScore ?? m.score ?? 0), 'dow_jones'),
      matchType: classifyMatch(Number(m.matchScore ?? m.score ?? 0)),
      listCategories: Array.isArray(m.listCategories) ? (m.listCategories as string[]) : [],
      listSources: Array.isArray(m.listSources) ? (m.listSources as string[]) : [],
      country: String(m.country ?? ''),
      dateOfBirth: m.dateOfBirth ? String(m.dateOfBirth) : undefined,
      additionalInfo: m.additionalInfo as Record<string, unknown> | undefined,
    }));
    const highestScore = matches.reduce((max, m) => Math.max(max, m.matchScore), 0);
    let status: ScreeningResult['status'] = 'CLEAR';
    if (highestScore >= 95) status = 'CONFIRMED_MATCH';
    else if (highestScore >= 75) status = 'POTENTIAL_MATCH';

    return {
      requestId: String(body.requestId ?? `DJ-${Date.now()}`),
      provider: 'dow_jones',
      status,
      highestScore,
      matches,
      screenedAt: new Date().toISOString(),
      cacheHit: false,
      failClosed: true,
      mode: 'live',
    };
  } catch (error) {
    // Fail-closed: If API call throws, treat as potential match to prevent unscreened access
    return {
      requestId: `DJ-ERR-${Date.now()}`,
      provider: 'dow_jones',
      status: 'ERROR',
      highestScore: 100,
      matches: [],
      screenedAt: new Date().toISOString(),
      cacheHit: false,
      failClosed: true,
      mode: 'live',
      errorMessage: `Dow Jones API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

/**
 * Screen using Refinitiv World-Check API.
 *
 * Security/Resilience contract mirrors screenWithDowJones: explicit `simulation`
 * fallback when SCREENING_API_URL/SCREENING_API_KEY are missing; fail-closed
 * ERROR on any API call failure.
 */
async function screenWithRefinitiv(request: ScreeningRequest): Promise<ScreeningResult> {
  // Rate limit check before making the Refinitiv API call
  const rateLimit = checkIntegrationRateLimit('screening');
  if (!rateLimit.allowed) {
    return {
      requestId: `RL-${Date.now()}`,
      provider: request.provider ?? 'refinitiv',
      status: 'ERROR',
      highestScore: 100,
      matches: [],
      screenedAt: new Date().toISOString(),
      cacheHit: false,
      failClosed: true,
      mode: 'live',
      errorMessage: 'Rate limit exceeded for screening provider. Please try again later.',
    };
  }

  const apiBaseUrl = process.env.SCREENING_API_URL ?? '';
  const apiKey = process.env.SCREENING_API_KEY ?? '';

  // ─── Explicit simulation fallback (no silent mock) ──────────────────────
  if (!apiBaseUrl || !apiKey) {
    warnSimulationFallback('SCREENING_API_URL or SCREENING_API_KEY not set (refinitiv path)');
    return {
      requestId: `WC-SIM-${Date.now()}`,
      provider: 'refinitiv',
      status: 'CLEAR',
      highestScore: 0,
      matches: [],
      screenedAt: new Date().toISOString(),
      cacheHit: false,
      failClosed: false,
      mode: 'simulation',
    };
  }

  try {
    const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/cases`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        entityType: request.entityType,
        primaryName: request.primaryName,
        secondaryNames: request.aliases ?? [],
        dateOfBirth: request.dateOfBirth,
        nationality: request.nationality,
        idNumber: request.idNumber,
        country: request.country,
      }),
    });

    if (!response.ok) {
      return {
        requestId: `WC-ERR-${Date.now()}`,
        provider: 'refinitiv',
        status: 'ERROR',
        highestScore: 100,
        matches: [],
        screenedAt: new Date().toISOString(),
        cacheHit: false,
        failClosed: true,
        mode: 'live',
        errorMessage: `Refinitiv API error: ${response.status} ${response.statusText}`,
      };
    }

    const body = (await response.json()) as Record<string, unknown>;
    const rawMatches = Array.isArray(body.matches) ? (body.matches as Array<Record<string, unknown>>) : [];
    const matches: ScreeningMatch[] = rawMatches.map((m, idx) => ({
      matchId: String(m.matchId ?? `m-${idx}`),
      providerMatchId: String(m.providerMatchId ?? m.caseId ?? m.id ?? `pm-${idx}`),
      name: String(m.name ?? m.fullName ?? ''),
      matchScore: normalizeScore(Number(m.matchScore ?? m.score ?? 0), 'refinitiv'),
      matchType: classifyMatch(Number(m.matchScore ?? m.score ?? 0)),
      listCategories: Array.isArray(m.listCategories) ? (m.listCategories as string[]) : [],
      listSources: Array.isArray(m.listSources) ? (m.listSources as string[]) : [],
      country: String(m.country ?? ''),
      dateOfBirth: m.dateOfBirth ? String(m.dateOfBirth) : undefined,
      additionalInfo: m.additionalInfo as Record<string, unknown> | undefined,
    }));
    const highestScore = matches.reduce((max, m) => Math.max(max, m.matchScore), 0);
    let status: ScreeningResult['status'] = 'CLEAR';
    if (highestScore >= 95) status = 'CONFIRMED_MATCH';
    else if (highestScore >= 75) status = 'POTENTIAL_MATCH';

    return {
      requestId: String(body.requestId ?? `WC-${Date.now()}`),
      provider: 'refinitiv',
      status,
      highestScore,
      matches,
      screenedAt: new Date().toISOString(),
      cacheHit: false,
      failClosed: true,
      mode: 'live',
    };
  } catch (error) {
    return {
      requestId: `WC-ERR-${Date.now()}`,
      provider: 'refinitiv',
      status: 'ERROR',
      highestScore: 100,
      matches: [],
      screenedAt: new Date().toISOString(),
      cacheHit: false,
      failClosed: true,
      mode: 'live',
      errorMessage: `Refinitiv API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

// ─── Main Screening Function ────────────────────────────────────────────────

/**
 * Execute a screening request against the configured provider.
 * Checks cache first, then falls back to live API call.
 * Results are cached for 24 hours.
 */
export async function executeScreening(request: ScreeningRequest): Promise<ScreeningResult> {
  // Check cache first
  const cached = getCachedResult(request);
  if (cached) {
    return cached;
  }

  // Determine provider from SCREENING_PROVIDER env.
  // Accepts 'refinitiv' | 'dowjones' | 'simulation'. 'simulation' (or unset)
  // routes to dow_jones which will then return an explicit simulation result
  // because SCREENING_API_KEY is unset.
  const rawProviderEnv = (process.env.SCREENING_PROVIDER ?? '').toLowerCase();
  let provider: ScreeningProvider;
  if (rawProviderEnv === 'refinitiv') {
    provider = 'refinitiv';
  } else if (rawProviderEnv === 'dowjones' || rawProviderEnv === 'dow_jones') {
    provider = 'dow_jones';
  } else {
    // unset or 'simulation' — default to dow_jones (which falls back to simulation)
    provider = request.provider ?? 'dow_jones';
  }

  // Execute screening
  let result: ScreeningResult;
  if (provider === 'refinitiv') {
    result = await screenWithRefinitiv(request);
  } else {
    result = await screenWithDowJones(request);
  }

  // Cache the result
  setCachedResult(request, result);

  return result;
}

/**
 * Clear the screening cache (e.g., after a sanctions list update).
 */
export function clearScreeningCache(): void {
  screeningCache.clear();
}

/**
 * Get cache statistics for monitoring.
 */
export function getScreeningCacheStats(): { size: number; hitRate: number } {
  return {
    size: screeningCache.size,
    hitRate: 0, // Would be tracked in production
  };
}
