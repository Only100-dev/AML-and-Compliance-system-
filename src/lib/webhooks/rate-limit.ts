/**
 * Webhook Rate Limiting — Sliding Window Algorithm
 *
 * SECURITY MANDATE (verbatim from platform directive):
 *   "Add strict rate limiting to all /api/webhooks/* endpoints.
 *    Target: Maximum 100 requests per minute per IP address.
 *    Use a sliding window algorithm.
 *    Return 429 Too Many Requests with a Retry-After header when the limit
 *    is exceeded."
 *
 * ALGORITHM: True sliding window (not fixed window).
 * We store an array of request timestamps per IP within the active window.
 * On each request:
 *   1. Drop timestamps older than `windowMs` from the front of the array.
 *   2. If the remaining count >= `maxRequests`, REJECT (429).
 *   3. Otherwise, append `now` and ALLOW.
 *
 * This is more accurate than a fixed-window counter: a burst of 100 requests
 * at 11:59:59 + 100 at 12:00:01 would pass a fixed 1-minute window but is
 * correctly capped at 100/minute by the sliding window.
 *
 * MEMORY: The store is a Map<ip, number[]>. Cleanup runs every 5 minutes
 * and evicts IPs whose timestamp arrays are fully outside the window. To
 * bound memory under attack, an IP can never accumulate more than
 * `maxRequests + 1` timestamps (we reject before appending once full).
 *
 * IDENTIFICATION: The IP is read from `x-forwarded-for` (first hop) or
 * `x-real-ip`, falling back to `'unknown'`. We deliberately do NOT trust
 * `x-forwarded-for` blindly beyond the first hop — the gateway (Caddy)
 * overwrites this header with the true client IP.
 */

import { NextResponse } from 'next/server';

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 100; // per IP per window

// Map<ip, sorted timestamps within window>. We use a plain array and
// shift() from the front; under the small bound (≤101 entries) this is
// cheaper than a deque and avoids extra deps.
const store = new Map<string, number[]>();

// Background cleanup — evict IPs whose windows are fully expired.
// Runs every 5 minutes. Each cleanup pass is O(N) over the store size.
setInterval(
  () => {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    for (const [ip, timestamps] of store.entries()) {
      // Drop everything older than the window
      while (timestamps.length > 0 && timestamps[0] < cutoff) {
        timestamps.shift();
      }
      if (timestamps.length === 0) {
        store.delete(ip);
      }
    }
  },
  5 * 60 * 1000,
);

/**
 * Extract the client IP from the request. Honors the first hop of
 * `x-forwarded-for` (set by Caddy to the true client IP) and falls back
 * to `x-real-ip`, then to `'unknown'`.
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    // First hop only — Caddy overwrites this with the true client IP,
    // but a downstream proxy could append additional hops. Take the first.
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return 'unknown';
}

/**
 * Apply the sliding-window rate limit to an inbound webhook request.
 *
 * @returns `null` if the request is allowed; otherwise a `NextResponse`
 *          with status 429 and the standard rate-limit headers
 *          (`Retry-After`, `X-RateLimit-Limit`, `X-RateLimit-Remaining`,
 *          `X-RateLimit-Reset`).
 *
 * Per the platform directive, the 429 response body is a small JSON
 * object — it does NOT echo the request payload (which may be an attack
 * vector) and does NOT reveal which provider was being targeted.
 */
export function applyWebhookRateLimit(
  request: Request,
): NextResponse | null {
  const ip = getClientIp(request);
  const now = Date.now();
  const cutoff = now - WINDOW_MS;

  const timestamps = store.get(ip) ?? [];
  // Drop expired timestamps (lazy eviction — keeps the array tight even
  // between background cleanup passes).
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }

  if (timestamps.length >= MAX_REQUESTS) {
    // Rate limit exceeded — the oldest timestamp in the window tells us
    // when a slot will free up, which is the basis for Retry-After.
    const oldestInWindow = timestamps[0];
    const retryAfterMs = Math.max(0, oldestInWindow + WINDOW_MS - now);
    const retryAfterSec = Math.max(1, Math.ceil(retryAfterMs / 1000));
    const resetEpochSec = Math.ceil((oldestInWindow + WINDOW_MS) / 1000);

    return NextResponse.json(
      {
        success: false,
        error: 'Rate limit exceeded',
        retryAfterSeconds: retryAfterSec,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(retryAfterSec),
          'X-RateLimit-Limit': String(MAX_REQUESTS),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(resetEpochSec),
          // Cache-Control: no-store prevents any intermediary from caching
          // the 429 response and masking a subsequent legitimate request.
          'Cache-Control': 'no-store',
        },
      },
    );
  }

  // Allowed — record the timestamp and persist the array back to the store.
  timestamps.push(now);
  store.set(ip, timestamps);
  return null;
}
