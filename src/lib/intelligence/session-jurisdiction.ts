/**
 * Intelligence Engine — Session-Based Jurisdiction Isolation Helper
 *
 * Single source of truth for extracting authenticated user context
 * from NextAuth sessions and enforcing jurisdiction isolation.
 *
 * All intelligence API routes MUST use this helper instead of
 * trusting client-supplied userId/userRole/userJurisdiction values.
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import {
  GCC_JURISDICTIONS,
  getJurisdictionScopeWithLegacy,
  mapLegacyJurisdictionToGCC,
  type GCCJurisdiction,
} from '@/lib/intelligence/jurisdiction-contexts';
import { toGCCAlpha2 } from '@/lib/constants/jurisdictions';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthenticatedUserContext {
  /** Authenticated user ID from session */
  userId: string;
  /** Authenticated user role from session */
  userRole: string;
  /** Raw jurisdiction string from session (e.g. 'CBUAE', 'SA') */
  userJurisdiction: string;
  /** Normalized GCC alpha-2 jurisdiction code (e.g. 'AE', 'SA') */
  jurisdictionId: string;
  /** List of jurisdictions this user is allowed to access */
  allowedJurisdictions: GCCJurisdiction[];
  /** Whether the user has admin-level cross-jurisdiction access */
  isCrossJurisdiction: boolean;
}

// ─── Admin / Board Roles ────────────────────────────────────────────────────

const CROSS_JURISDICTION_ROLES = ['admin', 'board'];

// ─── Get Authenticated User Context ─────────────────────────────────────────

/**
 * Extracts the authenticated user's context from the NextAuth session.
 * Returns null if no valid session exists.
 *
 * IMPORTANT: This should be called at the top of every intelligence API handler.
 * The returned values MUST be used for access control instead of any
 * client-supplied userId, userRole, or jurisdiction parameters.
 */
export async function getAuthenticatedContext(): Promise<AuthenticatedUserContext | null> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return null;
  }

  const sessionUser = session.user as Record<string, unknown>;

  const userId = (sessionUser.id as string) || 'unknown';
  const userRole = (sessionUser.role as string) || 'compliance_officer';
  // Fix 1: No CBUAE fallback — JWT callback throws if jurisdiction is missing,
  // so session should always have a valid jurisdiction. Use non-null assertion.
  const userJurisdiction = sessionUser.jurisdiction as string;
  const jurisdictionId = (sessionUser.jurisdictionId as string) || toGCCAlpha2(userJurisdiction);

  const allowedJurisdictions = getJurisdictionScopeWithLegacy(userRole, userJurisdiction);
  const isCrossJurisdiction = CROSS_JURISDICTION_ROLES.includes(userRole);

  return {
    userId,
    userRole,
    userJurisdiction,
    jurisdictionId,
    allowedJurisdictions,
    isCrossJurisdiction,
  };
}

// ─── Validate Client-Supplied Jurisdiction ──────────────────────────────────

/**
 * Validates that a client-supplied jurisdiction filter is within the
 * authenticated user's allowed scope.
 *
 * For admin/board users: any jurisdiction is allowed.
 * For other users: the requested jurisdiction must match their own.
 *
 * Returns the normalized list of jurisdictions that should be used for queries,
 * or null if the request should be rejected (403).
 */
export function validateJurisdictionAccess(
  ctx: AuthenticatedUserContext,
  requestedJurisdiction?: string,
): GCCJurisdiction[] | null {
  // Admin/Board can access any jurisdiction
  if (ctx.isCrossJurisdiction) {
    if (requestedJurisdiction) {
      const normalized = mapLegacyJurisdictionToGCC(requestedJurisdiction);
      return [normalized];
    }
    return ctx.allowedJurisdictions; // All GCC jurisdictions
  }

  // Non-admin: if they request a specific jurisdiction, it must match their own
  if (requestedJurisdiction) {
    const requested = mapLegacyJurisdictionToGCC(requestedJurisdiction);
    if (requested !== ctx.jurisdictionId) {
      return null; // 403 - trying to access another jurisdiction
    }
  }

  return ctx.allowedJurisdictions; // Their own jurisdiction only
}

// ─── Filter TrendSignals by Jurisdiction ────────────────────────────────────

/**
 * TrendSignal.jurisdictions is a JSON string like '["AE","SA","BH"]'.
 * Prisma cannot directly query JSON arrays with `in`, so we use
 * `string_contains` for each allowed jurisdiction code.
 *
 * Returns a Prisma where clause that filters TrendSignals to only those
 * that include at least one of the allowed jurisdictions.
 */
export function trendJurisdictionFilter(
  allowedJurisdictions: GCCJurisdiction[],
): Record<string, unknown> {
  // If all GCC jurisdictions are allowed, no filter needed
  if (allowedJurisdictions.length >= GCC_JURISDICTIONS.length) {
    return {};
  }

  // Use OR with string_contains for each jurisdiction
  // This works because the JSON array format '["AE","SA"]' will contain
  // the string '"AE"' when AE is in the array
  return {
    OR: allowedJurisdictions.map((j) => ({
      jurisdictions: { contains: `"${j}"` },
    })),
  };
}

// ─── In-Memory TrendSignal Jurisdiction Filter ──────────────────────────────

/**
 * Filters an array of TrendSignal-like objects in memory by checking
 * if their jurisdictions JSON field includes any of the allowed jurisdictions.
 * Used when we need to filter after a DB query (e.g., for faceted counts).
 */
export function filterTrendsByJurisdiction<T extends { jurisdictions: string | null }>(
  trends: T[],
  allowedJurisdictions: GCCJurisdiction[],
): T[] {
  if (allowedJurisdictions.length >= 6) {
    // All GCC jurisdictions — no filtering needed
    return trends;
  }

  return trends.filter((t) => {
    if (!t.jurisdictions) return false;
    try {
      const jurisArray = JSON.parse(t.jurisdictions);
      if (!Array.isArray(jurisArray)) return false;
      return jurisArray.some((j: string) => allowedJurisdictions.includes(j as GCCJurisdiction));
    } catch {
      return false;
    }
  });
}
