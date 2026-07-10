import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { NextResponse } from 'next/server';

type AllowedRole = string;

interface AuthGuardOptions {
  allowedRoles?: AllowedRole[];
  requireAuth?: boolean;
}

/**
 * Protect an API route with authentication and optional RBAC.
 *
 * P0-B Fix: The dev-mode bypass has been ERADICATED.
 * Per Fortress v5.0 A-004: The `NODE_ENV === 'development'` check that created
 * a synthetic admin user was a CRITICAL vulnerability. In production, the code
 * path to bypass auth must physically not exist. This function now ALWAYS
 * requires a valid session — no exceptions, no environment-based bypasses.
 *
 * Authentication is enforced uniformly regardless of NODE_ENV.
 */
export async function authGuard(options: AuthGuardOptions = {}) {
  const { allowedRoles, requireAuth = true } = options;

  if (!requireAuth) return { session: null, authorized: true };

  const session = await getServerSession(authOptions);

  // P0-B Fix: No dev-mode bypass. Authentication is ALWAYS enforced.
  // Previously, when NODE_ENV === 'development' and no session existed,
  // a synthetic admin user was created — this was a CRITICAL security hole.
  // That code path has been physically removed.
  if (!session?.user) {
    return {
      session: null,
      authorized: false,
      error: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  const userRole = (session.user as Record<string, unknown>).role as string;

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
    return {
      session,
      authorized: false,
      error: NextResponse.json(
        { success: false, error: 'Insufficient permissions', requiredRoles: allowedRoles },
        { status: 403 }
      ),
    };
  }

  return { session, authorized: true };
}

/**
 * Require that the session user has access to the given jurisdiction.
 * Returns an object with `ok` flag; if not ok, includes a NextResponse error.
 */
export function requireJurisdiction(
  session: Record<string, unknown> | null,
  targetJurisdictionId: string
): { ok: boolean; error?: NextResponse } {
  if (!session) {
    return {
      ok: false,
      error: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
    };
  }

  // Admin users have access to all jurisdictions
  const role = (session as Record<string, unknown>).role as string;
  if (role === 'ADMIN' || role === 'COMPLIANCE_MANAGER') {
    return { ok: true };
  }

  const userJurisdictionId = (session as Record<string, unknown>).jurisdictionId as string | undefined;
  if (!userJurisdictionId || userJurisdictionId !== targetJurisdictionId) {
    return {
      ok: false,
      error: NextResponse.json(
        { success: false, error: 'Jurisdiction access denied' },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}

/**
 * Extract the jurisdiction ID from the current session.
 */
export function getSessionJurisdictionId(
  session: Record<string, unknown> | null
): string | undefined {
  if (!session) return undefined;
  return (session as Record<string, unknown>).jurisdictionId as string | undefined;
}

/**
 * Extract the jurisdiction code from the current session.
 */
export function getSessionJurisdictionCode(
  session: Record<string, unknown> | null
): string | undefined {
  if (!session) return undefined;
  return (session as Record<string, unknown>).jurisdictionCode as string | undefined;
}

/**
 * Check if the current session user can switch jurisdictions.
 * Admin and Compliance Manager users can switch; others cannot.
 */
export function canSessionSwitchJurisdiction(
  session: Record<string, unknown> | null
): boolean {
  if (!session) return false;
  const role = (session as Record<string, unknown>).role as string;
  return role === 'ADMIN' || role === 'COMPLIANCE_MANAGER';
}
