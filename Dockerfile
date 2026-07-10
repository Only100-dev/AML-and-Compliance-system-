# ═══════════════════════════════════════════════════════════════════════════════
# IC-OS v7.2 — Multi-Stage Dockerfile
# Framework: Next.js 16 (App Router, standalone output)
# Runtime: Bun
# Database: SQLite via Prisma
# ═══════════════════════════════════════════════════════════════════════════════

# ── Stage 1: Build ─────────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS base
WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Generate Prisma client
COPY prisma ./prisma
RUN bun run db:generate

# Copy source code
COPY . .

# Build Next.js standalone output
# This runs: next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/
RUN bun run build

# ── Stage 2: Production ────────────────────────────────────────────────────────
FROM oven/bun:1.3 AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy standalone output from builder
COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public

# Copy Prisma schema and database (for runtime client access)
COPY --from=base /app/prisma ./prisma
COPY --from=base /app/db ./db

# Copy uploads directory (KYC documents, evidence files)
COPY --from=base /app/uploads ./uploads

# Expose port
EXPOSE 3000

# Health check — hits the /api/health endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start the standalone server
CMD ["bun", "server.js"]
