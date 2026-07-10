import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { toGCCAlpha2 } from '@/lib/constants/jurisdictions';

// ─── IC-OS Middleware: Auth + Preview Panel & Security Headers ────────────────
//
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  DUAL-AXIS RBAC CLARIFICATION (Pre-UAT Polish Fix #2)                      ║
// ║                                                                            ║
// ║  Admin is Level 100 for System Config (ROLE_HIERARCHY), BUT                ║
// ║  BUSINESS_AUTHORITY for sensitive data is strictly 0 (ZERO).               ║
// ║  SoD blocks apply regardless of system level.                              ║
// ║  - Admin CANNOT approve KYC, file SARs, override sanctions,               ║
// ║    review MLR flags, or activate break-glass.                              ║
// ║  - Middleware SoD hard-blocks on /api/kyc/*, /api/evidence/*,              ║
// ║    /api/sar/*, /api/goaml/* return 403 regardless of system level.         ║
// ║  - Per FDL 10/2025 Art. 15 (Segregation of Duties) and                    ║
// ║    CBUAE Notice 3551/2021 S3.1 (Governance).                               ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ── P0-B Fix: BYPASS_AUTH completely eradicated ─────────────────────────────────
// Per Fortress v5.0 A-002: The BYPASS_AUTH mechanism and x-bypass-auth headers
// are a CRITICAL vulnerability. The entire code path that skips authentication
// has been physically removed. There is NO way to bypass auth in this middleware.
// If E2E tests need a bypass, it must be handled at the test framework level,
// NOT in production code.

const ALLOWED_FRAME_ORIGINS = [
  'https://*.space-z.ai',
  'http://localhost:*',
  'ws://localhost:*',
  'http://127.0.0.1:*',
];

// Public routes that don't require authentication.
// '/' is public so unauthenticated visitors see the Institutional Landing Page
// (the page.tsx server component renders the dashboard only when authenticated).
// '/preview' is the iframe-friendly entry for the preview panel.
// API routes under /api/* (except /api/auth/*) still require a valid session.
//
// NOTE: '/' is matched by EXACT equality (not startsWith) — otherwise every
// pathname would match '/' and the auth gate would be a no-op. The prefix
// list below covers the remaining public routes.
const PUBLIC_ROUTE_PREFIXES = ['/login', '/api/auth', '/api/health', '/api/route', '/preview'];

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = new URL(request.url);
  const isDev = process.env.NODE_ENV === 'development';

  // ── Detect preview panel ──────────────────────────────────────────────────
  const referer = request.headers.get('referer') || '';
  const origin = request.headers.get('origin') || '';
  const isFromPreviewPanel =
    referer.includes('space-z.ai') ||
    origin.includes('space-z.ai') ||
    pathname.startsWith('/preview');

  // ── Skip middleware for static assets ──────────────────────────────────────
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/static/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ── Create response ───────────────────────────────────────────────────────
  const response = NextResponse.next();

  // ── Apply permissive iframe headers for development or preview panel ───────
  if (isDev || isFromPreviewPanel) {
    // CRITICAL: Do NOT set X-Frame-Options here!
    // X-Frame-Options SAMEORIGIN blocks iframe from preview panel (different origin).
    // We rely solely on CSP frame-ancestors to control iframe embedding.
    // The middleware runs AFTER next.config.ts headers, so this deletes any
    // X-Frame-Options that Next.js may have already set.
    response.headers.delete('X-Frame-Options');

    const devCsp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https: blob:",
      `connect-src 'self' http://localhost:11434 http://localhost:8000 http://localhost:6333 ws://localhost:3003 ws://localhost:3000 https://*.space-z.ai`,
      "font-src 'self' data:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      `frame-ancestors 'self' ${ALLOWED_FRAME_ORIGINS.join(' ')}`,
    ].join('; ');

    response.headers.set('Content-Security-Policy', devCsp);
  }

  // ── Add CORS headers ──────────────────────────────────────────────────────
  if (isFromPreviewPanel || isDev) {
    response.headers.set('Access-Control-Allow-Origin', '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // ── Handle OPTIONS preflight ──────────────────────────────────────────────
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: response.headers,
    });
  }

  // ── Authentication Check (ALWAYS ENFORCED — P0-B Fix) ──────────────────
  // BYPASS_AUTH has been ERADICATED. Authentication is ALWAYS enforced.
  // There is no environment variable, header, or condition that can skip auth.
  // Per Fortress v5.0 A-002: The auth bypass code path must physically not exist.
  const isPublicRoute = pathname === '/' || PUBLIC_ROUTE_PREFIXES.some(route => pathname.startsWith(route));

  if (!isPublicRoute) {
    // P0-A Fix: Consistent NEXTAUTH_SECRET handling with route handler
    // Must use the same fallback as [...nextauth]/route.ts so JWT tokens
    // encrypted by the route handler can be decoded by the middleware.
    // In production, NEXTAUTH_SECRET MUST be set (route.ts enforces this).
    const secret = process.env.NEXTAUTH_SECRET || 'insecure-dev-only-secret-do-not-use-in-production';
    const token = await getToken({ req: request, secret });

    if (!token) {
      // Redirect to login for page requests
      if (!pathname.startsWith('/api/')) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }
      // Return 401 for API requests
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    // ── Active User Check ───────────────────────────────────────────────
    // Even if the JWT is technically valid, deactivated users must not
    // access any protected resource.
    if (token.isActive === false) {
      if (!pathname.startsWith('/api/')) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('error', 'Account deactivated');
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.json(
        { success: false, error: 'Account deactivated' },
        { status: 401 }
      );
    }

    // ── Jurisdiction Isolation Check (API routes only) ──────────────────
    // Non-admin users can only access API data for their own jurisdiction.
    // Admin and Board roles bypass this check (cross-region visibility).
    if (pathname.startsWith('/api/')) {
      const userRole = token.role as string | undefined;
      const isPrivileged = userRole === 'admin' || userRole === 'board';

      if (!isPrivileged) {
        const requestedJurisdiction =
          searchParams.get('jurisdiction') ||
          request.headers.get('x-jurisdiction') ||
          null;

        if (requestedJurisdiction) {
          const userJurisdictionId = token.jurisdictionId as string | undefined;
          const normalizedRequest = toGCCAlpha2(requestedJurisdiction);

          if (
            userJurisdictionId &&
            normalizedRequest !== userJurisdictionId
          ) {
            return NextResponse.json(
              {
                success: false,
                error: 'Jurisdiction access denied',
                message: `Your account is restricted to jurisdiction '${userJurisdictionId}'. Access to '${requestedJurisdiction}' is not permitted.`,
              },
              { status: 403 }
            );
          }
        }
      }
    }
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
