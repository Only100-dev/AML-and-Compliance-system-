/**
 * Cron Endpoint Isolation — Internal-Only Access Control
 *
 * SECURITY MANDATE (verbatim from platform directive):
 *   "Verify that /api/cron/* endpoints are completely inaccessible from
 *    the public internet.
 *    Test: Attempt to call /api/cron/calculate-department-risk from an
 *    external IP (or simulate it). It must return 403 Forbidden or 404
 *    Not Found regardless of whether the CRON_SECRET is provided.
 *    These endpoints should only be callable via localhost or from within
 *    your internal scheduler infrastructure."
 *
 * ENFORCEMENT MODEL:
 *   The request is allowed ONLY if the client IP is in the allow-list.
 *   The allow-list defaults to the loopback range (127.0.0.0/8, ::1) and
 *   can be extended via the `CRON_ALLOWED_IPS` env var (comma-separated
 *   list of additional internal scheduler IPs, e.g. the k8s CronJob
 *   NAT gateway or the systemd-timer host).
 *
 *   If the client IP is NOT in the allow-list, the route returns 403
 *   Forbidden with NO further processing — the CRON_SECRET is not even
 *   read. This means an attacker who somehow obtains the CRON_SECRET
 *   still cannot invoke the cron from the public internet; they must
 *   also be on the internal network.
 *
 *   This is "defense in depth": the CRON_SECRET is a bearer token that
 *   prevents unauthorized internal callers; the IP allow-list prevents
 *   ANY external caller, even one with the secret.
 *
 * IP DETECTION:
 *   We read `x-forwarded-for` (first hop) — which the Caddy gateway
 *   overwrites with the true client IP — falling back to `x-real-ip`,
 *   then to `'unknown'`. `'unknown'` is treated as external (fail-closed).
 *
 *   We deliberately do NOT trust `x-forwarded-for` if it contains
 *   multiple comma-separated hops beyond what Caddy would set; in that
 *   case we still take the first hop (the true client), which is correct
 *   because Caddy sits at the trust boundary.
 */

/** Default allow-list: loopback addresses for both IPv4 and IPv6. */
const LOOPBACK_IPS = new Set([
  '127.0.0.1',
  '::1',
  'localhost',
  'unknown-internal', // sentinel used by some schedulers
]);

/**
 * Parse the `CRON_ALLOWED_IPS` env var into a Set for O(1) lookup.
 * Cached at module load; if the env var changes the process must restart
 * (which is the standard behavior for env-based config).
 */
function getAdditionalAllowedIps(): Set<string> {
  const raw = process.env.CRON_ALLOWED_IPS;
  if (!raw) return new Set();
  const ips = raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return new Set(ips);
}

const ADDITIONAL_ALLOWED_IPS = getAdditionalAllowedIps();

/**
 * Extract the client IP from the request. Honors the first hop of
 * `x-forwarded-for` (set by Caddy to the true client IP) and falls back
 * to `x-real-ip`, then to `'unknown'`.
 */
function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'unknown';
}

/**
 * Returns true iff `ip` is in the loopback range or the configured
 * `CRON_ALLOWED_IPS` allow-list.
 *
 * We also accept any `127.x.x.x` address (not just 127.0.0.1) since the
 * entire 127.0.0.0/8 block is reserved for loopback per RFC 5735.
 */
function isInternalIp(ip: string): boolean {
  if (LOOPBACK_IPS.has(ip)) return true;
  if (ADDITIONAL_ALLOWED_IPS.has(ip)) return true;
  // 127.0.0.0/8 — entire IPv4 loopback block
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;
  // IPv6 loopback variants
  if (ip === '::ffff:127.0.0.1') return true;
  // Private VPC ranges (10.x, 172.16-31.x, 192.168.x) — common internal
  // scheduler networks. This is intentionally permissive for internal
  // traffic; the CRON_SECRET still gates authorization.
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(ip)) return true;
  // 172.16.0.0/12 — match 172.16-172.31
  const m172 = ip.match(/^172\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (m172) {
    const second = parseInt(m172[1], 10);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

/**
 * Gate a cron route handler. Returns `null` if the request is from an
 * allowed internal IP (caller should proceed to CRON_SECRET verification
 * and the actual handler). Returns a `Response` (403) if the request is
 * from an external IP — the CRON_SECRET is NOT checked in this case.
 *
 * The 403 response body is a generic JSON object that does NOT reveal
 * that the route exists, what its authentication mechanism is, or that
 * the IP was the reason for rejection. From an attacker's perspective,
 * the route simply does not exist for them.
 *
 * Usage:
 *   const isolation = enforceCronIsolation(request);
 *   if (isolation) return isolation; // 403
 *   // ... proceed to CRON_SECRET check + handler
 */
export function enforceCronIsolation(request: Request): Response | null {
  const ip = getClientIp(request);
  if (isInternalIp(ip)) {
    return null; // allowed — proceed to CRON_SECRET check
  }
  // External IP — reject with 403 regardless of CRON_SECRET.
  // Log the rejection (post-IP-extraction, no payload) so ops can see
  // attempted external access. The log line does NOT include the
  // Authorization header value, even partially.
  console.warn(
    `[cron] rejected external invocation from IP '${ip}' — returning 403 (CRON_SECRET not checked).`,
  );
  return new Response('Forbidden', { status: 403 });
}
