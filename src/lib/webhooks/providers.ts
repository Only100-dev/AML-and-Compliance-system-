/**
 * Webhook Provider Registry — Security-First Configuration
 *
 * This registry is the SINGLE source of truth for which inbound webhook
 * providers are allowed by the IC-OS platform. Adding a provider here is
 * a deliberate, code-reviewed security decision.
 *
 * SECURITY INVARIANTS:
 * - Every entry MUST declare a signature header, a secret env var, and a hash
 *   algorithm. The webhook route refuses to process any provider not listed.
 * - Secrets are NEVER read into memory at module load — they are read lazily
 *   from `process.env` inside `verifyWebhookSignature` so that a missing
 *   secret cannot crash the process and so that secret rotation via env
 *   reload takes effect without a redeploy.
 * - The `externalIdField` is used for idempotency keying so that replayed
 *   webhook deliveries do not create duplicate records.
 *
 * Adding a new provider:
 *   1. Append an entry to WEBHOOK_PROVIDERS with a unique key.
 *   2. Document the new `*_WEBHOOK_SECRET` env var in `.env.example`.
 *   3. Add a routing case in src/app/api/webhooks/[provider]/route.ts if
 *      the provider needs bespoke processing beyond a generic AuditLog entry.
 */

export type WebhookHashAlgorithm = 'sha256' | 'sha512';
export type WebhookSignatureEncoding = 'hex' | 'base64';

export interface WebhookProviderConfig {
  /** Canonical provider name (matches the [provider] URL segment). */
  name: string;
  /** HTTP header that carries the HMAC signature, e.g. 'x-webhook-signature'. */
  signatureHeader: string;
  /** Name of the env var holding the HMAC secret, e.g. 'SANCTIONS_WEBHOOK_SECRET'. */
  secretEnvVar: string;
  /** HMAC hash algorithm. */
  algorithm: WebhookHashAlgorithm;
  /** Encoding used by the provider when serializing the signature. */
  signatureEncoding: WebhookSignatureEncoding;
  /** Top-level JSON key whose value is the provider's unique event id (used for idempotency). */
  externalIdField: string;
  /** Optional human-readable description shown in audit logs / docs. */
  description?: string;
}

/**
 * Allowed inbound webhook providers. To add a new provider, append here and
 * document the corresponding `*_WEBHOOK_SECRET` env var in `.env.example`.
 */
export const WEBHOOK_PROVIDERS: Record<string, WebhookProviderConfig> = {
  sanctions: {
    name: 'sanctions',
    signatureHeader: 'x-webhook-signature',
    secretEnvVar: 'SANCTIONS_WEBHOOK_SECRET',
    algorithm: 'sha256',
    signatureEncoding: 'hex',
    externalIdField: 'event_id',
    description: 'Sanctions list update / match webhook (OFAC, UN, EU, UAE Local Lists).',
  },
  screening: {
    name: 'screening',
    signatureHeader: 'x-webhook-signature',
    secretEnvVar: 'SCREENING_WEBHOOK_SECRET',
    algorithm: 'sha256',
    signatureEncoding: 'hex',
    externalIdField: 'event_id',
    description: 'PEP / Adverse Media screening provider webhook (Dow Jones / Refinitiv).',
  },
  regulatory: {
    name: 'regulatory',
    signatureHeader: 'x-webhook-signature',
    secretEnvVar: 'REGULATORY_WEBHOOK_SECRET',
    algorithm: 'sha256',
    signatureEncoding: 'hex',
    externalIdField: 'event_id',
    description: 'Regulatory circular / obligation update webhook (CBUAE, IA, FDL).',
  },
  identity: {
    name: 'identity',
    signatureHeader: 'x-webhook-signature',
    secretEnvVar: 'IDENTITY_WEBHOOK_SECRET',
    algorithm: 'sha256',
    signatureEncoding: 'hex',
    externalIdField: 'event_id',
    description: 'Identity verification lifecycle webhook (UAE Pass / Emirates Pass / Nafath).',
  },
};

/**
 * Look up a provider config by name. Returns undefined for unknown providers.
 * Callers (the webhook route) MUST treat `undefined` as a hard 404 — never
 * reveal which provider names are accepted.
 */
export function getWebhookProviderConfig(name: string): WebhookProviderConfig | undefined {
  return WEBHOOK_PROVIDERS[name];
}

/**
 * Returns true iff the provider's secret env var is set. Useful for ops
 * dashboards / health checks (NEVER expose the secret itself).
 */
export function isWebhookProviderConfigured(name: string): boolean {
  const config = WEBHOOK_PROVIDERS[name];
  if (!config) return false;
  return Boolean(process.env[config.secretEnvVar]);
}
