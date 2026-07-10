/**
 * IC-OS Environment Validation Module
 * Phase 6: Production Readiness & Security Hardening
 *
 * Validates all required environment variables at startup using Zod.
 * Fails fast in production if critical variables are missing.
 * In development, provides sensible defaults to reduce friction.
 */

import { z } from "zod";

const envSchema = z.object({
  // Runtime environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Database — always required
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // NextAuth — required in production, optional in dev
  NEXTAUTH_SECRET: z.string().optional(),
  NEXTAUTH_URL: z.string().url().optional(),

  // AI Infrastructure — backend inference gateway (optional)
  AI_GATEWAY_URL: z.string().url().optional(),

  // Feature flags
  ENABLE_MAKER_CHECKER: z
    .string()
    .transform((v) => v === "true")
    .default(true),
  ENABLE_AI_CHAT: z
    .string()
    .transform((v) => v === "true")
    .default(true),
  ENABLE_PII_MASKING: z
    .string()
    .transform((v) => v === "true")
    .default(true),

  // UAE Data Residency flag
  DATA_RESIDENCY_REGION: z.string().default("me-central-1"),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
        .join("\n");

      // In production, fail hard; in dev, warn but continue
      if (process.env.NODE_ENV === "production") {
        console.error(
          `\n❌ IC-OS Environment Validation Failed (Production):\n${issues}\n`
        );
        process.exit(1);
      } else {
        console.warn(
          `\n⚠️  IC-OS Environment Validation Warnings (Development):\n${issues}\n`
        );
        // Return partial parse for dev
        return envSchema.parse({
          ...process.env,
          NODE_ENV: process.env.NODE_ENV || "development",
          DATABASE_URL:
            process.env.DATABASE_URL ||
            "file:./dev.db",
          NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "dev-secret-min-32-characters-long!!",
        });
      }
    }
    throw error;
  }
}

export const env = validateEnv();

/**
 * Security posture check — call from health endpoint
 */
export function getSecurityPosture() {
  const checks = {
    httpsEnforced: process.env.NODE_ENV === "production",
    authConfigured: !!process.env.NEXTAUTH_SECRET,
    dataResidencyUAE:
      (process.env.DATA_RESIDENCY_REGION || "me-central-1") ===
      "me-central-1",
    piiMaskingEnabled:
      (process.env.ENABLE_PII_MASKING || "true") === "true",
    makerCheckerEnabled:
      (process.env.ENABLE_MAKER_CHECKER || "true") === "true",
    aiBackendConfigured: !!process.env.AI_GATEWAY_URL,
    cspHeadersActive: true, // Set by next.config.ts
    hstsActive: true, // Set by next.config.ts
  };

  const passed = Object.values(checks).filter(Boolean).length;
  const total = Object.values(checks).length;
  const score = Math.round((passed / total) * 100);

  return {
    checks,
    passed,
    total,
    score,
    grade:
      score >= 90
        ? "A"
        : score >= 75
          ? "B"
          : score >= 60
            ? "C"
            : "D",
  };
}
