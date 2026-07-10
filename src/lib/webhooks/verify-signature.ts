/**
 * Webhook Signature Verification — HMAC with constant-time comparison
 *
 * SECURITY CONTRACT:
 * - This function MUST NOT throw on bad input. It returns `false` for any
 *   missing/malformed input, missing secret, or signature mismatch. The
 *   caller (webhook route) treats `false` as 401 Unauthorized and refuses
 *   to read, parse, log, or persist the payload.
 * - The HMAC is computed using `crypto.createHmac` with the configured
 *   algorithm and the secret read lazily from `process.env[secretEnvVar]`.
 * - Comparison uses `crypto.timingSafeEqual` after a length guard, so that
 *   an attacker cannot use response timing to brute-force the signature.
 * - The secret is NEVER logged. Only a boolean result is returned.
 */

import crypto from 'crypto';
import type { WebhookProviderConfig, WebhookSignatureEncoding } from './providers';

/**
 * Verify the HMAC signature of an inbound webhook payload.
 *
 * @param payload   Raw request body as a UTF-8 string (exactly the bytes
 *                  that were signed by the provider — do NOT re-serialize
 *                  JSON, as key ordering / whitespace would change the hash).
 * @param signature Signature as received from the header, in the encoding
 *                  declared by the provider config ('hex' or 'base64').
 * @param config    The provider config (declares the secret env var,
 *                  algorithm, and encoding).
 * @returns         `true` if the signature is valid; `false` for any
 *                  missing/malformed input, missing secret, or mismatch.
 *                  NEVER throws.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null | undefined,
  config: WebhookProviderConfig,
): boolean {
  // ─── Hard guards — never throw, just return false ──────────────────────
  if (typeof payload !== 'string' || payload.length === 0) return false;
  if (typeof signature !== 'string' || signature.length === 0) return false;

  // Read the secret lazily — never log it.
  const secret = process.env[config.secretEnvVar];
  if (!secret || secret.length === 0) {
    // Misconfiguration: secret not set. Fail closed (return false) so that
    // the webhook route returns 401 and ops notices that deliveries are
    // being rejected, rather than silently accepting unsigned payloads.
    return false;
  }

  try {
    // Compute the expected HMAC over the raw payload bytes.
    const expectedHmac = crypto.createHmac(config.algorithm, secret).update(payload, 'utf8');
    const expectedBuffer =
      config.signatureEncoding === 'base64'
        ? expectedHmac.digest('base64')
        : expectedHmac.digest('hex');

    // Convert both strings to buffers for constant-time comparison.
    // Strip any leading algorithm prefix the provider may include
    // (e.g. "sha256=abcdef...") — common in GitHub-style webhooks.
    const providedSignature = stripAlgorithmPrefix(signature, config.signatureEncoding);

    const expectedBuf = Buffer.from(expectedBuffer, 'utf8');
    const providedBuf = Buffer.from(providedSignature, 'utf8');

    // Length guard: timingSafeEqual requires equal-length buffers, otherwise
    // it throws. We must NOT short-circuit on length alone in a way that
    // leaks the expected length via timing — but returning false here is
    // fine because the *expected* length is deterministic per provider
    // config (algorithm + encoding) and thus already public.
    if (expectedBuf.length !== providedBuf.length) {
      return false;
    }

    // Constant-time comparison to prevent timing attacks.
    return crypto.timingSafeEqual(expectedBuf, providedBuf);
  } catch {
    // Any unexpected error (bad encoding, etc.) → fail closed.
    return false;
  }
}

/**
 * Strip an optional "algo=" prefix from a signature string.
 * e.g. "sha256=abcdef..." → "abcdef...".
 * If there is no "=", returns the original string.
 */
function stripAlgorithmPrefix(signature: string, _encoding: WebhookSignatureEncoding): string {
  const eqIdx = signature.indexOf('=');
  if (eqIdx === -1) return signature;
  // Only strip if the prefix looks like an algorithm name (alphanumeric, no spaces).
  const prefix = signature.slice(0, eqIdx);
  if (/^[a-zA-Z0-9]+$/.test(prefix)) {
    return signature.slice(eqIdx + 1);
  }
  return signature;
}
