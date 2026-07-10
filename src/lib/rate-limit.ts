import { NextResponse } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory rate limit store (resets on server restart)
const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetTime) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Maximum number of requests per window */
  maxRequests: number;
  /** Key prefix for namespacing (e.g., 'api:ai:chat') */
  keyPrefix?: string;
}

// ─── Tiered Rate Limit Profiles ──────────────────────────────────────────────
// Tier 1: Read-heavy/Standard GET — dashboards, lists, analytics (100 req/min)
// Tier 2: Standard Writes — POST/PUT/PATCH/DELETE (30 req/min)
// Tier 3: High-Cost/Sensitive — AI endpoints, bulk ops, data room (10 req/min)

export type RateLimitTier = 'READ' | 'WRITE' | 'SENSITIVE' | 'AI';

export const RATE_LIMIT_TIERS: Record<RateLimitTier, RateLimitOptions> = {
  /** Tier 1: Read-heavy/Standard GET — 100 requests per minute per user */
  READ: { windowMs: 60_000, maxRequests: 100, keyPrefix: 'tier:read' },
  /** Tier 2: Standard Writes — 30 requests per minute per user */
  WRITE: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'tier:write' },
  /** Tier 3: High-Cost/Sensitive — AI, bulk, data room — 10 requests per minute per user */
  SENSITIVE: { windowMs: 60_000, maxRequests: 10, keyPrefix: 'tier:sensitive' },
  /** Tier 4: AI endpoints — 10 requests per minute per user (separate bucket from SENSITIVE) */
  AI: { windowMs: 60_000, maxRequests: 10, keyPrefix: 'tier:ai' },
} as const;

// ─── Legacy Rate Limit Profiles (backward-compatible) ────────────────────────

export const RATE_LIMITS = {
  /** AI chat: 20 requests per minute per user */
  AI_CHAT: { windowMs: 60_000, maxRequests: 20, keyPrefix: 'api:ai:chat' },
  /** AI tasks: 10 requests per minute per user */
  AI_TASK: { windowMs: 60_000, maxRequests: 10, keyPrefix: 'api:ai:task' },
  /** Auth endpoints: 5 attempts per 15 minutes per user */
  AUTH: { windowMs: 15 * 60_000, maxRequests: 5, keyPrefix: 'api:auth' },
  /** Write endpoints: 30 requests per minute per user */
  WRITE: { windowMs: 60_000, maxRequests: 30, keyPrefix: 'api:write' },
  /** Read endpoints: 100 requests per minute per user */
  READ: { windowMs: 60_000, maxRequests: 100, keyPrefix: 'api:read' },
} as const;

// ─── Core Rate Limit Check ───────────────────────────────────────────────────

/**
 * Check rate limit for a given identifier.
 * Returns { allowed: true } if the request is within limits,
 * or { allowed: false, error: NextResponse } if the limit is exceeded.
 *
 * The 429 response includes:
 *   - Retry-After header (seconds until reset)
 *   - X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset headers
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions
): { allowed: true } | { allowed: false; error: NextResponse } {
  const key = `${options.keyPrefix || 'default'}:${identifier}`;
  const now = Date.now();

  const entry = store.get(key);

  if (!entry || now > entry.resetTime) {
    // First request or window expired
    store.set(key, {
      count: 1,
      resetTime: now + options.windowMs,
    });
    return { allowed: true };
  }

  if (entry.count >= options.maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return {
      allowed: false,
      error: NextResponse.json(
        {
          success: false,
          error: 'Rate limit exceeded',
          retryAfterSeconds: retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(options.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(entry.resetTime / 1000)),
          },
        }
      ),
    };
  }

  // Increment counter
  entry.count++;
  return { allowed: true };
}

// ─── User Identity Extraction ────────────────────────────────────────────────

/**
 * Extract client identifier from request (IP address or fallback).
 * Used as fallback when no authenticated session is available.
 */
export function getClientIdentifier(request: Request): string {
  // Try to get IP from common headers first
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  // Fallback for development
  return 'unknown';
}

/**
 * Extract userId from an authGuard result session.
 * Normalizes between dev-mode (userId field) and real sessions (id field).
 * Falls back to IP-based identification if no session is available.
 *
 * v7.3.0: In development mode, the `x-user-id` header takes PRECEDENCE over
 * the dev-mode synthetic `dev-user` session. This allows load tests to
 * distribute rate-limit budget across many synthetic users by sending
 * different `x-user-id` headers — without which every authGuard-protected
 * endpoint (audit-integrity, department-risk) would share a single
 * `dev-user` rate-limit bucket and throttle at 100 req/min aggregate.
 *
 * In production, real sessions are always used and the `x-user-id` header
 * is ignored (it's only respected when `NODE_ENV === 'development'`).
 */
export function getUserIdFromAuth(
  auth: { session: { user?: Record<string, unknown> } | null; authorized: boolean },
  request: Request
): string {
  // v7.3.0: In dev mode, prefer the x-user-id header for rate-limit
  // identification. This enables load-test distribution across synthetic
  // users. In production, this branch never executes.
  if (process.env.NODE_ENV === 'development') {
    const headerUserId = request.headers.get('x-user-id');
    if (headerUserId) return headerUserId;
  }

  if (auth.session?.user) {
    const user = auth.session.user as Record<string, unknown>;
    // Real sessions use 'id', dev mode uses 'userId'
    const userId = (user.id as string) || (user.userId as string);
    if (userId) return userId;
  }
  // Fallback to IP-based identifier
  return getClientIdentifier(request);
}

// ─── Convenience: applyRateLimit ─────────────────────────────────────────────

/**
 * Apply tiered rate limiting using the auth session for user identification.
 *
 * Usage in route handlers:
 *   const auth = await authGuard({ allowedRoles: [...] });
 *   if (!auth.authorized) return auth.error ?? NextResponse.json({...}, { status: 401 });
 *
 *   const rateLimitError = applyRateLimit(auth, request, 'WRITE');
 *   if (rateLimitError) return rateLimitError;
 *
 * @param auth   - The result from authGuard()
 * @param request - The incoming Request object
 * @param tier   - 'READ' (100/min), 'WRITE' (30/min), or 'SENSITIVE' (10/min)
 * @returns NextResponse (429) if rate limited, or null if allowed
 */
export function applyRateLimit(
  auth: { session: { user?: Record<string, unknown> } | null; authorized: boolean },
  request: Request,
  tier: RateLimitTier = 'READ'
): NextResponse | null {
  const identifier = getUserIdFromAuth(auth, request);
  const result = checkRateLimit(identifier, RATE_LIMIT_TIERS[tier]);
  if (!result.allowed) {
    return result.error;
  }
  return null;
}
