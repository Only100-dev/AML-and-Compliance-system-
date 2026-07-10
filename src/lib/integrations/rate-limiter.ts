/**
 * Integration Rate Limiter — External Service Quota Protection
 *
 * Prevents accidental API quota exhaustion and denial-of-wallet attacks
 * on external integration adapters (identity providers, screening providers,
 * regulatory gateways).
 *
 * Unlike the general-purpose rate limiter in @/lib/rate-limit (which is
 * request-oriented and returns NextResponse), this module provides a
 * simplified interface suitable for non-HTTP integration adapters that
 * don't have access to Request objects.
 *
 * Features:
 * - Service-specific rate limit profiles
 * - Fixed identifier keys (no IP resolution needed)
 * - Simplified return type (no NextResponse)
 * - Warning logs when limits are hit
 * - Shares the same in-memory store pattern as @/lib/rate-limit
 */

import { RateLimitOptions } from '@/lib/rate-limit';

// ─── In-Memory Store ──────────────────────────────────────────────────────

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

const integrationStore = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of integrationStore.entries()) {
    if (now > entry.resetTime) {
      integrationStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

// ─── Rate Limit Profiles ──────────────────────────────────────────────────

/**
 * Service-specific rate limit profiles designed to protect external API quotas.
 *
 * - Identity Provider (UAE Pass / Nafath): 10 req/min — biometric verification is expensive
 * - Screening Provider (Dow Jones / Refinitiv): 20 req/min — already cached for 24h, this limits live API calls
 * - Regulatory Gateway (goAML): 5 req/min — each submission is very expensive and legally binding
 */
export const INTEGRATION_RATE_LIMITS: Record<IntegrationService, RateLimitOptions> = {
  identity: {
    windowMs: 60_000,        // 1 minute
    maxRequests: 10,          // 10 requests per minute per integration key
    keyPrefix: 'integration:identity-provider',
  },
  screening: {
    windowMs: 60_000,        // 1 minute
    maxRequests: 20,          // 20 requests per minute per integration key
    keyPrefix: 'integration:screening-provider',
  },
  regulatory: {
    windowMs: 60_000,        // 1 minute
    maxRequests: 5,           // 5 requests per minute per integration key (very limited)
    keyPrefix: 'integration:regulatory-gateway',
  },
};

export type IntegrationService = 'identity' | 'screening' | 'regulatory';

export interface IntegrationRateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

// ─── Rate Limit Check ─────────────────────────────────────────────────────

/**
 * Check rate limit for an external integration service.
 *
 * Uses a fixed identifier (the service key prefix) since integration adapters
 * don't have direct access to Request objects or client IP addresses.
 * This protects against systemic overuse rather than per-client abuse.
 *
 * @param service - Which external service to check rate limit for
 * @returns Simplified result without NextResponse (suitable for non-HTTP contexts)
 */
export function checkIntegrationRateLimit(
  service: IntegrationService,
): IntegrationRateLimitResult {
  const options = INTEGRATION_RATE_LIMITS[service];
  const key = `${options.keyPrefix}:global`;
  const now = Date.now();

  const entry = integrationStore.get(key);

  if (!entry || now > entry.resetTime) {
    // First request or window expired — start fresh
    integrationStore.set(key, {
      count: 1,
      resetTime: now + options.windowMs,
    });
    return { allowed: true };
  }

  if (entry.count >= options.maxRequests) {
    // Rate limit exceeded
    const retryAfterSeconds = Math.ceil((entry.resetTime - now) / 1000);

    console.warn(
      `[Integration Rate Limit] ${service} provider rate limit exceeded. ` +
      `Limit: ${options.maxRequests} requests per ${options.windowMs / 1000}s. ` +
      `Retry after ${retryAfterSeconds}s. ` +
      `Key: ${key}`
    );

    return {
      allowed: false,
      retryAfterSeconds,
    };
  }

  // Increment counter
  entry.count++;
  return { allowed: true };
}

/**
 * Get current rate limit usage for a service (useful for monitoring/dashboards).
 */
export function getIntegrationRateLimitStatus(
  service: IntegrationService,
): { count: number; limit: number; resetIn: number } {
  const options = INTEGRATION_RATE_LIMITS[service];
  const key = `${options.keyPrefix}:global`;
  const entry = integrationStore.get(key);

  if (!entry) {
    return { count: 0, limit: options.maxRequests, resetIn: 0 };
  }

  const resetIn = Math.max(0, Math.ceil((entry.resetTime - Date.now()) / 1000));
  return {
    count: entry.count,
    limit: options.maxRequests,
    resetIn,
  };
}
