import { PrismaClient } from "@prisma/client";

/**
 * IC-OS Database Connection — Production Optimized
 * Phase 6: Connection pooling + environment-aware logging
 *
 * - Singleton pattern prevents connection exhaustion in serverless/VPS
 * - Verbose logging in dev (query + error + warn), error-only in prod
 * - Global reference survives HMR hot reloads during development
 */

const globalForPrisma = globalThis as unknown as {
  // Cache key bumped to `prismaV74Intelligence` so that schema additions
  // (IntelligenceItem / TrendSignal / AgentConfig / AlertRule / WatchlistItem
  // / IntelligenceAction / IntelligencePolicyMapping / IntelligenceEntity
  // / AgentScanLog / IntelligenceExport / SavedSearch) are picked up by
  // the already-running dev server without a manual restart.
  prismaV74Intelligence: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prismaV74Intelligence ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prismaV74Intelligence = db;

/**
 * Graceful shutdown handler for production
 * Ensures all pending queries complete before process exits
 */
if (process.env.NODE_ENV === "production") {
  process.on("beforeExit", async () => {
    await db.$disconnect();
  });
}
