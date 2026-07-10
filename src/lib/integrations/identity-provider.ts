/**
 * Identity Provider Adapter — UAE Pass / KSA Nafath
 * 
 * Abstracts the OAuth2 flow so we can switch between UAE Pass and KSA Nafath
 * based on the IDENTITY_PROVIDER environment variable.
 * 
 * Supported providers:
 * - "uae_pass" (default for UAE) — UAE Pass biometric identity verification
 * - "nafath" (for KSA) — Nafath biometric liveness + verified identity
 * 
 * Features:
 * - OAuth2 Authorization Code flow
 * - Biometric liveness verification
 * - Verified identity attribute extraction (name, ID, nationality, etc.)
 * - Token refresh handling
 * - Fail-closed: If identity verification fails, access is denied
 *
 * ─── CONFIGURATION (Simulation vs Production) ───────────────────────────────
 * This adapter defaults to SIMULATION mode when IDENTITY_API_URL or
 * IDENTITY_API_KEY is unset. It returns tagged simulation tokens
 * (mode:'simulation', accessToken:'sim-access-token-...') so UAT/dev can
 * exercise the SSO login flow without a real UAE Pass / Nafath integration.
 *
 * To enable LIVE identity verification, set ALL of:
 *   IDENTITY_API_URL=<IdP base URL>        # required
 *   IDENTITY_API_KEY=<IdP API key>         # required
 *   IDENTITY_PROVIDER=uae_pass|nafath      # optional (selects provider; default uae_pass)
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
    `[identity-provider] SIMULATION MODE ACTIVE — real identity provider call is disabled. ` +
    `Reason: ${reason}. Set IDENTITY_API_URL and IDENTITY_API_KEY (and ` +
    `IDENTITY_PROVIDER=uae_pass|emirates_pass|nafath) to enable live verification. ` +
    `(This warning logs once per process.)`
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** True when IDENTITY_API_URL + IDENTITY_API_KEY are configured for live calls. */
function isLiveConfigured(): boolean {
  return Boolean(process.env.IDENTITY_API_URL && process.env.IDENTITY_API_KEY);
}

/** True when IDENTITY_PROVIDER is explicitly 'simulation'. */
function isExplicitSimulation(): boolean {
  return (process.env.IDENTITY_PROVIDER ?? '').toLowerCase() === 'simulation';
}

// ─── Types ──────────────────────────────────────────────────────────────────

export interface IdentityProviderConfig {
  provider: 'uae_pass' | 'nafath';
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  userinfoEndpoint: string;
  scope: string[];
}

export interface VerifiedIdentity {
  provider: 'uae_pass' | 'nafath';
  subjectId: string;           // Unique identifier from the provider
  fullName: string;            // Verified full name
  firstName: string;
  lastName: string;
  nationality: string;         // ISO 3166-1 alpha-2
  idNumber: string;            // Emirates ID or Iqama/Civil ID number
  idType: 'emirates_id' | 'iqama' | 'civil_id' | 'passport';
  dateOfBirth: string;         // ISO 8601
  email?: string;
  phone?: string;
  biometricVerified: boolean;  // Whether biometric liveness was confirmed
  verificationTimestamp: string; // ISO 8601
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;           // Unix timestamp
  /** Indicates whether the verified identity came from a real provider API call (`live`)
   *  or an explicit simulation fallback (`simulation`). Never silently impersonates
   *  a live verification when credentials are missing. */
  mode: 'live' | 'simulation';
}

export interface OAuth2TokenResponse {
  access_token: string;
  refresh_token?: string;
  token_type: string;
  expires_in: number;
  id_token?: string;
}

// ─── Configuration ──────────────────────────────────────────────────────────

function getProviderConfig(): IdentityProviderConfig {
  // IDENTITY_PROVIDER accepts 'uae_pass' | 'emirates_pass' (alias) | 'nafath' | 'simulation'.
  // 'simulation' (or unset + no IDENTITY_API_KEY) routes to uae_pass which then falls back
  // to a clearly-tagged simulation result.
  const rawProvider = (process.env.IDENTITY_PROVIDER ?? '').toLowerCase();
  const provider: 'uae_pass' | 'nafath' =
    rawProvider === 'nafath' ? 'nafath' : 'uae_pass';

  // IDENTITY_API_URL overrides the hardcoded endpoints when set.
  const identityApiUrl = (process.env.IDENTITY_API_URL ?? '').replace(/\/$/, '');

  if (provider === 'nafath') {
    return {
      provider: 'nafath',
      clientId: process.env.NAFATH_CLIENT_ID ?? process.env.IDENTITY_API_KEY ?? '',
      clientSecret: process.env.NAFATH_CLIENT_SECRET ?? process.env.IDENTITY_API_KEY ?? '',
      redirectUri: process.env.NAFATH_REDIRECT_URI ?? 'https://icos.ae/api/auth/nafath/callback',
      authorizationEndpoint: identityApiUrl
        ? `${identityApiUrl}/auth`
        : 'https://nfth.api.elm.sa/auth/realms/nafath/protocol/openid-connect/auth',
      tokenEndpoint: identityApiUrl
        ? `${identityApiUrl}/token`
        : 'https://nfth.api.elm.sa/auth/realms/nafath/protocol/openid-connect/token',
      userinfoEndpoint: identityApiUrl
        ? `${identityApiUrl}/userinfo`
        : 'https://nfth.api.elm.sa/auth/realms/nafath/protocol/openid-connect/userinfo',
      scope: ['openid', 'profile', 'idno', 'nationality', 'dob'],
    };
  }

  // Default: UAE Pass / Emirates Pass
  return {
    provider: 'uae_pass',
    clientId: process.env.UAE_PASS_CLIENT_ID ?? process.env.IDENTITY_API_KEY ?? '',
    clientSecret: process.env.UAE_PASS_CLIENT_SECRET ?? process.env.IDENTITY_API_KEY ?? '',
    redirectUri: process.env.UAE_PASS_REDIRECT_URI ?? 'https://icos.ae/api/auth/uaepass/callback',
    authorizationEndpoint: identityApiUrl
      ? `${identityApiUrl}/authorize`
      : 'https://sat.uae.gov.ae/uaepass/trustedx-authserver/resources/oauth2/authorize',
    tokenEndpoint: identityApiUrl
      ? `${identityApiUrl}/token`
      : 'https://sat.uae.gov.ae/uaepass/trustedx-authserver/resources/oauth2/token',
    userinfoEndpoint: identityApiUrl
      ? `${identityApiUrl}/userinfo`
      : 'https://sat.uae.gov.ae/uaepass/trustedx-resources/resources/userinfo',
    scope: ['openid', 'profile', 'uaepass:mobile_id', 'uaepass:email'],
  };
}

// ─── Adapter Functions ──────────────────────────────────────────────────────

/**
 * Generate the OAuth2 authorization URL for the configured identity provider.
 * The user is redirected to this URL to authenticate via biometric liveness.
 */
export function getAuthorizationUrl(state: string): string {
  const config = getProviderConfig();
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scope.join(' '),
    state,
  });

  return `${config.authorizationEndpoint}?${params.toString()}`;
}

/**
 * Exchange the authorization code for access and ID tokens.
 * Implements the OAuth2 Authorization Code flow.
 *
 * If IDENTITY_API_URL/IDENTITY_API_KEY are not set (or IDENTITY_PROVIDER=simulation),
 * returns a clearly-simulated token tagged with `access_token: 'sim-...'` so callers
 * can detect simulation mode. Never silently impersonates a real provider response.
 */
export async function exchangeCodeForTokens(code: string): Promise<OAuth2TokenResponse> {
  // Rate limit check before making the token exchange request
  const rateLimit = checkIntegrationRateLimit('identity');
  if (!rateLimit.allowed) {
    throw new Error('Rate limit exceeded for identity provider. Please try again later.');
  }

  // ─── Explicit simulation fallback (no silent mock) ──────────────────────
  if (!isLiveConfigured() || isExplicitSimulation()) {
    warnSimulationFallback(
      isExplicitSimulation()
        ? "IDENTITY_PROVIDER='simulation'"
        : 'IDENTITY_API_URL or IDENTITY_API_KEY not set'
    );
    return {
      access_token: `sim-access-token-${Date.now()}`,
      refresh_token: `sim-refresh-token-${Date.now()}`,
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: undefined,
    };
  }

  const config = getProviderConfig();

  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
  });

  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<OAuth2TokenResponse>;
}

/**
 * Fetch verified user identity from the provider's userinfo endpoint.
 * Maps the provider-specific attributes to our internal VerifiedIdentity type.
 *
 * If IDENTITY_API_URL/IDENTITY_API_KEY are not set (or IDENTITY_PROVIDER=simulation),
 * returns a clearly-simulated VerifiedIdentity with `mode: 'simulation'` so callers
 * can surface it. Never silently impersonates a real verification.
 */
export async function getVerifiedIdentity(accessToken: string): Promise<VerifiedIdentity> {
  // Rate limit check before making the userinfo request
  const rateLimit = checkIntegrationRateLimit('identity');
  if (!rateLimit.allowed) {
    throw new Error('Rate limit exceeded for identity provider. Please try again later.');
  }

  const config = getProviderConfig();

  // ─── Explicit simulation fallback (no silent mock) ──────────────────────
  if (!isLiveConfigured() || isExplicitSimulation()) {
    warnSimulationFallback(
      isExplicitSimulation()
        ? "IDENTITY_PROVIDER='simulation'"
        : 'IDENTITY_API_URL or IDENTITY_API_KEY not set'
    );
    const simIdentity: VerifiedIdentity = {
      provider: config.provider,
      subjectId: `sim-sub-${Date.now()}`,
      fullName: 'Simulated User',
      firstName: 'Simulated',
      lastName: 'User',
      nationality: 'AE',
      idNumber: '000-0000-0000000-0',
      idType: config.provider === 'nafath' ? 'iqama' : 'emirates_id',
      dateOfBirth: '1990-01-01',
      biometricVerified: false, // Explicitly false in simulation — caller must surface this
      verificationTimestamp: new Date().toISOString(),
      accessToken: accessToken || `sim-access-token-${Date.now()}`,
      expiresAt: Date.now() + 3600 * 1000,
      mode: 'simulation',
    };
    return simIdentity;
  }

  const response = await fetch(config.userinfoEndpoint, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Userinfo fetch failed: ${response.status} ${response.statusText}`);
  }

  const userInfo = await response.json() as Record<string, unknown>;

  // Map provider-specific fields to our unified VerifiedIdentity
  let verified: VerifiedIdentity;
  if (config.provider === 'nafath') {
    verified = mapNafathIdentity(userInfo, accessToken);
  } else {
    verified = mapUAEPassIdentity(userInfo, accessToken);
  }
  verified.mode = 'live';
  return verified;
}

/**
 * Refresh an expired access token using the refresh token.
 *
 * In simulation mode (no IDENTITY_API_URL/IDENTITY_API_KEY or IDENTITY_PROVIDER=simulation),
 * returns a clearly-simulated refreshed token tagged with `access_token: 'sim-...'`.
 */
export async function refreshAccessToken(refreshToken: string): Promise<OAuth2TokenResponse> {
  // Rate limit check before making the refresh request
  const rateLimit = checkIntegrationRateLimit('identity');
  if (!rateLimit.allowed) {
    throw new Error('Rate limit exceeded for identity provider. Please try again later.');
  }

  // ─── Explicit simulation fallback (no silent mock) ──────────────────────
  if (!isLiveConfigured() || isExplicitSimulation()) {
    warnSimulationFallback(
      isExplicitSimulation()
        ? "IDENTITY_PROVIDER='simulation'"
        : 'IDENTITY_API_URL or IDENTITY_API_KEY not set (refresh path)'
    );
    return {
      access_token: `sim-access-token-${Date.now()}`,
      refresh_token: refreshToken,
      token_type: 'Bearer',
      expires_in: 3600,
      id_token: undefined,
    };
  }

  const config = getProviderConfig();

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  const response = await fetch(config.tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<OAuth2TokenResponse>;
}

// ─── Provider-Specific Mappers ──────────────────────────────────────────────

function mapUAEPassIdentity(
  userInfo: Record<string, unknown>,
  accessToken: string,
): VerifiedIdentity {
  // UAE Pass field mapping per official documentation
  const sub = String(userInfo.sub ?? '');
  const fullnameEN = String(userInfo.fullnameEN ?? userInfo.name ?? '');
  const firstnameEN = String(userInfo.firstnameEN ?? '');
  const lastnameEN = String(userInfo.lastnameEN ?? '');
  const nationalityEN = String(userInfo.nationalityEN ?? userInfo.nationality ?? '');
  const idn = String(userInfo.idn ?? userInfo.emiratesId ?? '');
  const dob = String(userInfo.dob ?? userInfo.birthdate ?? '');

  return {
    provider: 'uae_pass',
    subjectId: sub,
    fullName: fullnameEN,
    firstName: firstnameEN,
    lastName: lastnameEN,
    nationality: nationalityEN,
    idNumber: idn,
    idType: 'emirates_id',
    dateOfBirth: dob,
    email: userInfo.email ? String(userInfo.email) : undefined,
    phone: userInfo.mobile ? String(userInfo.mobile) : undefined,
    biometricVerified: true, // UAE Pass requires biometric liveness for authentication
    verificationTimestamp: new Date().toISOString(),
    accessToken,
    expiresAt: Date.now() + 3600 * 1000, // 1 hour default
    mode: 'live',
  };
}

function mapNafathIdentity(
  userInfo: Record<string, unknown>,
  accessToken: string,
): VerifiedIdentity {
  // Nafath field mapping per Elm API documentation
  const sub = String(userInfo.sub ?? '');
  const fullName = String(userInfo.name ?? '');
  const firstName = String(userInfo.given_name ?? '');
  const lastName = String(userInfo.family_name ?? '');
  const nationality = String(userInfo.nationality ?? '');
  const idNumber = String(userInfo.idno ?? userInfo.iqama ?? '');
  const dob = String(userInfo.birthdate ?? '');

  // Determine ID type based on the identifier
  const idType: 'iqama' | 'civil_id' = String(userInfo.id_type) === 'iqama' ? 'iqama' : 'civil_id';

  return {
    provider: 'nafath',
    subjectId: sub,
    fullName,
    firstName,
    lastName,
    nationality,
    idNumber,
    idType,
    dateOfBirth: dob,
    biometricVerified: true, // Nafath requires biometric match (Absher/Nafath app)
    verificationTimestamp: new Date().toISOString(),
    accessToken,
    expiresAt: Date.now() + 3600 * 1000,
    mode: 'live',
  };
}
