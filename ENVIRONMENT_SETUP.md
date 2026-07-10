# IC-OS v7.2 — Environment Setup Guide

> **Version:** 7.2 Phase 6+  
> **Framework:** Next.js 16.1.3 (App Router, standalone output)  
> **Runtime:** Bun >= 1.3  
> **Database:** SQLite via Prisma ORM  
> **Auth:** NextAuth.js v4  
> **UI:** shadcn/ui + Tailwind CSS 4  
> **State:** Zustand + TanStack Query v5  
> **Regulatory:** FDL 10/2025, CR 134/2025, CBUAE Notice 3551/2021, goAML v4.2, UAE PDPL  
> **Last Updated:** 2026-03-05

---

## Table of Contents

1. [Environment Matrix](#1-environment-matrix)
   - [Local Developer Environment](#11-local-developer-environment)
   - [Test / Staging Environment](#12-test--staging-environment)
   - [Production Environment](#13-production-environment)
2. [Docker / Containerization](#2-docker--containerization)
3. [Environment Variables Reference](#3-environment-variables-reference)

---

## 1. Environment Matrix

### 1.1 Local Developer Environment

#### Prerequisites

| Tool | Minimum Version | Notes |
|------|----------------|-------|
| **Bun** | >= 1.3 | Primary runtime & package manager |
| **Node.js** | >= 20 | Required for Prisma CLI compatibility |
| **Git** | >= 2.30 | Version control |
| **curl** | Any | Health check verification |

> **Tip:** If using GPU-accelerated AI features locally, install [Ollama](https://ollama.ai) with an NVIDIA RTX 3090/4090 or equivalent. This is optional — the app degrades gracefully without AI services.

#### Clone & Setup

```bash
# Clone the repository
git clone <REPO_URL> /opt/ic-os
cd /opt/ic-os

# Install dependencies (uses Bun lockfile)
bun install --frozen-lockfile

# Generate Prisma client
bun run db:generate
```

#### `.env.local` Setup

Create `.env.local` in the project root. The app validates all variables at startup via Zod (`src/lib/env.ts`). In development, missing optional variables produce warnings with sensible defaults; in production, missing required variables cause `process.exit(1)`.

```bash
# ═══ Required ═══
DATABASE_URL=file:./db/custom.db

# ═══ NextAuth (required in production, optional in dev) ═══
NEXTAUTH_SECRET=dev-secret-min-32-characters-long!!
NEXTAUTH_URL=http://localhost:3000

# ═══ AI Infrastructure (optional — on-premise) ═══
AI_GATEWAY_URL=http://localhost:8000
OLLAMA_HOST=http://localhost:11434
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=

# ═══ Feature Flags ═══
ENABLE_MAKER_CHECKER=true
ENABLE_AI_CHAT=true
ENABLE_PII_MASKING=true

# ═══ UAE Data Residency ═══
DATA_RESIDENCY_REGION=me-central-1

# ═══ Optional Cloud AI ═══
ZAI_API_KEY=
```

#### Database Commands

```bash
# Push schema changes to SQLite (creates/updates tables)
bun run db:push

# Generate Prisma client after schema changes
bun run db:generate

# Run Prisma migrations (alternative to db:push)
bun run db:migrate

# Reset database (destructive — drops all data)
bun run db:reset

# Seed the database with realistic UAE compliance data
bunx tsx prisma/seed.ts
# Expected: 8 users, 5 circulars, 5 AML alerts, 3 sanctions exceptions,
#           3 evidence records, 5 claims, 8 regulations, 11 policies,
#           7 labor law items, 5 legal cases, 8 training courses,
#           + Phase 5 data (alerts, screenings, SARs, calendar events, etc.)
```

#### Start Development Server

```bash
# Start dev server on port 3000 (with log capture)
bun run dev

# Lint check
bun run lint

# Type check
bunx tsc --noEmit
```

The dev server is accessible at `http://localhost:3000`. The health endpoint is at `http://localhost:3000/api/health`.

#### Default Seed Users

After running the seeder, 8 default users are available. **All passwords must be changed on first login.**

| Email | Role | Jurisdiction |
|-------|------|-------------|
| `admin@icos.ae` | admin | CBUAE |
| `mlro@icos.ae` | mlro | CBUAE |
| `ahmed@icos.ae` | mlro | CBUAE |
| `fatima@icos.ae` | compliance_manager | DFSA |
| `omar@icos.ae` | compliance_officer | CBUAE |
| `sara@icos.ae` | dept_head | FSRA |
| `khalid@icos.ae` | analyst | CBUAE |
| `board@icos.ae` | board | CBUAE |

---

### 1.2 Test / Staging Environment

#### Deploy to Vercel Preview

```bash
# Install Vercel CLI
bun add -g vercel

# Deploy to preview
vercel

# Set staging environment variables
vercel env add DATABASE_URL preview
vercel env add NEXTAUTH_SECRET preview
vercel env add NEXTAUTH_URL preview
# ... add all required env vars for preview
```

> **Important:** Vercel's ephemeral filesystem loses local SQLite data on each deployment. Use an external SQLite provider (Turso, PlanetScale, or Cloudflare D1) for staging. Update `DATABASE_URL` accordingly.

#### Deploy to Docker Staging

```bash
# Build and run with docker-compose (staging profile)
docker compose build
docker compose up -d

# Seed test data inside the container
docker compose exec icos-app bunx tsx prisma/seed.ts

# Verify
docker compose exec icos-app curl -sf http://localhost:3000/api/health
```

#### Safely Seed Test Data Without Affecting Production

1. **Use a separate SQLite database file** for staging:
   ```bash
   DATABASE_URL=file:./db/staging-test.db bun run db:push
   DATABASE_URL=file:./db/staging-test.db bunx tsx prisma/seed.ts
   ```

2. **Or use Docker volumes** — the `docker-compose.yml` isolates the database in a named volume (`icos-db`), which is independent of any host-mounted production database.

3. **Never run `bun run db:reset` against a production DATABASE_URL.**

#### Environment Variable Configuration for Staging

| Variable | Staging Value | Notes |
|----------|--------------|-------|
| `NODE_ENV` | `test` or `development` | Prevents hard exit on missing vars |
| `DATABASE_URL` | `file:./db/staging.db` | Separate file from production |
| `NEXTAUTH_SECRET` | Generate unique: `openssl rand -base64 32` | Never reuse production secret |
| `NEXTAUTH_URL` | `https://staging.your-domain.ae` | Staging URL |
| `ENABLE_PII_MASKING` | `true` | Always mask PII in staging |
| `DATA_RESIDENCY_REGION` | `me-central-1` | Maintain UAE residency |

#### Database Isolation Strategy

- **Local dev:** `file:./db/custom.db` (default, gitignored)
- **Staging:** `file:./db/staging.db` or Docker volume `icos-db`
- **Production:** `file:./db/custom.db` on persistent storage (EBS volume, dedicated SSD, etc.)
- **Vercel:** External provider required (Turso, etc.) — local SQLite is ephemeral

---

### 1.3 Production Environment

> **Reference:** See `DEPLOYMENT_CHECKLIST.md` for the full production deployment procedure.

#### Securing Environment Variables

```bash
# Generate production secrets
openssl rand -base64 32    # NEXTAUTH_SECRET (min 32 chars)
openssl rand -hex 16       # QDRANT_API_KEY
openssl rand -hex 16       # VERCEL_AUTOMATION_BYPASS_SECRET

# Set in .env (NEVER commit to version control)
cat > .env << 'ENVEOF'
NODE_ENV=production
DATABASE_URL=file:./db/custom.db
NEXTAUTH_SECRET=<generated-secret>
NEXTAUTH_URL=https://your-domain.ae
AI_GATEWAY_URL=http://localhost:8000
OLLAMA_HOST=http://localhost:11434
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=<generated-key>
ENABLE_MAKER_CHECKER=true
ENABLE_AI_CHAT=true
ENABLE_PII_MASKING=true
DATA_RESIDENCY_REGION=me-central-1
ZAI_API_KEY=<your-key>
ENVEOF

# Restrict file permissions
chmod 600 .env
```

#### Build & Run

```bash
# Production build (produces standalone output)
bun run build
# This runs: next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/

# Start production server
bun run start
# This runs: NODE_ENV=production bun .next/standalone/server.js
```

#### Reverse Proxy (Caddy) Configuration

The project includes a `Caddyfile` that reverse-proxies to the Next.js application on port 3000:

```caddyfile
your-domain.ae {
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Real-IP {remote_host}
    }
}
```

Caddy provides:
- **Automatic HTTPS** with Let's Encrypt certificates
- **HTTP/2** support
- **TLS 1.3** enforcement
- **HSTS** headers (also set by Next.js at the application level)

For Docker-based Caddy, see the `docker-compose.yml` service definition below.

#### Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Storage | 20 GB SSD | 50 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| GPU (AI) | — | NVIDIA RTX 3090/4090 or A10G |

#### Network & Firewall

```bash
# Open required ports
sudo ufw allow 80/tcp      # HTTP (Caddy)
sudo ufw allow 443/tcp     # HTTPS (Caddy)
sudo ufw allow 3000/tcp    # Next.js (internal only — do not expose publicly)
sudo ufw allow 11434/tcp   # Ollama (internal only)
sudo ufw allow 6333/tcp    # Qdrant (internal only)
sudo ufw allow 8000/tcp    # AI Gateway (internal only)
sudo ufw enable
```

---

## 2. Docker / Containerization

### Dockerfile

The Dockerfile uses a multi-stage build: a **builder** stage that installs dependencies, generates the Prisma client, and builds the Next.js standalone output; and a **runner** stage that contains only the production artifacts.

> See `/home/z/my-project/Dockerfile` for the complete file.

**Key design decisions:**
- Uses `oven/bun:1.3` as the base image (matches the project's Bun version requirement)
- `bun.lock` (not `bun.lockb`) is copied for reproducible installs
- Prisma client is generated in the builder stage
- Only standalone output, static assets, public directory, prisma schema, and database are copied to the runner
- Health check hits `/api/health` endpoint every 30 seconds

### docker-compose.yml

The compose file defines the full stack for local development or production deployment:

> See `/home/z/my-project/docker-compose.yml` for the complete file.

**Services included:**

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `icos-app` | Built from Dockerfile | 3000 | Next.js application |
| `ollama` | `ollama/ollama:latest` | 11434 | AI model inference (GPU optional) |
| `qdrant` | `qdrant/qdrant:latest` | 6333, 6334 | Vector database for RAG |
| `caddy` | `caddy:2` | 80, 443 | Reverse proxy & TLS termination |

**Volumes:**

| Volume | Mount Point | Purpose |
|--------|------------|---------|
| `icos-db` | `/app/db` | SQLite database persistence |
| `icos-uploads` | `/app/uploads` | KYC document uploads |
| `ollama_data` | `/root/.ollama` | AI model storage |
| `qdrant_data` | `/qdrant/storage` | Vector embeddings |
| `caddy_data` | `/data` | TLS certificates |
| `caddy_config` | `/config` | Caddy configuration |

**Usage:**

```bash
# Build and start all services
docker compose build
docker compose up -d

# View logs
docker compose logs -f icos-app

# Seed the database
docker compose exec icos-app bunx tsx prisma/seed.ts

# Health check
docker compose exec icos-app curl -sf http://localhost:3000/api/health

# Stop all services
docker compose down

# Stop and remove volumes (destructive)
docker compose down -v
```

### Standalone AI Stack (Without App)

For running only the on-premise AI infrastructure (Ollama + Qdrant), use the separate compose file:

```bash
docker compose -f docker-compose.ai.yml up -d
```

This is useful during development when running the Next.js app natively with `bun run dev`.

---

## 3. Environment Variables Reference

All environment variables are validated at application startup by `src/lib/env.ts` using Zod. In production, missing required variables cause an immediate `process.exit(1)`. In development, missing optional variables produce warnings with sensible defaults.

### Complete Environment Variable Table

| Variable | Required | Default (Dev) | Type | Description |
|----------|----------|---------------|------|-------------|
| `NODE_ENV` | Yes | `development` | `enum: development \| production \| test` | Runtime environment. Controls validation strictness, logging verbosity, and security posture. |
| `DATABASE_URL` | **Yes** | `file:./dev.db` | `string` | SQLite connection string. Format: `file:<path>`. Always required — app will not start without it. |
| `NEXTAUTH_SECRET` | Prod | `dev-secret-min-32-characters-long!!` | `string` | NextAuth.js signing key. Minimum 32 characters. **Must be generated with `openssl rand -base64 32` in production.** |
| `NEXTAUTH_URL` | Prod | — | `string (URL)` | Public URL of the application (e.g., `https://your-domain.ae`). Required for NextAuth.js cookie and redirect configuration. |
| `AI_GATEWAY_URL` | No | — | `string (URL)` | AI Gateway endpoint for on-premise AI inference. Example: `http://localhost:8000`. Referenced in CSP `connect-src` header. |
| `OLLAMA_HOST` | No | — | `string` | Ollama inference engine URL. Example: `http://localhost:11434`. Used by AI chat and policy RAG features. |
| `OLLAMA_URL` | No | — | `string` | Alternate Ollama URL configuration. Some modules reference this instead of `OLLAMA_HOST`. Example: `http://localhost:11434`. |
| `QDRANT_URL` | No | — | `string (URL)` | Qdrant vector database URL. Used for RAG policy wizard and semantic search. Example: `http://localhost:6333`. |
| `QDRANT_API_KEY` | No | — | `string` | Qdrant authentication key. Generate with `openssl rand -hex 16`. Required if Qdrant has API key authentication enabled. |
| `ENABLE_MAKER_CHECKER` | No | `true` | `boolean (string)` | Enable 4-eyes principle enforcement for compliance-critical operations (KYC approval, goAML filing, SAR submission). Values: `true` / `false`. |
| `ENABLE_AI_CHAT` | No | `true` | `boolean (string)` | Enable AI chat widget in the application. When `false`, the AI assistant is hidden. Values: `true` / `false`. |
| `ENABLE_PII_MASKING` | No | `true` | `boolean (string)` | Enable PII masking for CBUAE views. Masks names, Emirates IDs, phone numbers, and amounts in regulatory-facing displays. Values: `true` / `false`. |
| `DATA_RESIDENCY_REGION` | No | `me-central-1` | `string` | UAE data residency region identifier. Must remain `me-central-1` for PDPL compliance. Changing this value affects the security posture score. |
| `ZAI_API_KEY` | No | — | `string` | Z-AI SDK API key for cloud AI features (optional — on-premise AI via Ollama is the default). Used by the `z-ai-web-dev-sdk` dependency. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | No | — | `string` | Vercel deployment bypass secret. Only needed for Vercel-hosted deployments. Generate with `openssl rand -hex 16`. |

### Environment Variable Validation Flow

```
Application Start
       │
       ▼
  src/lib/env.ts
  Zod Schema Parse
       │
       ├── NODE_ENV === "production"
       │       │
       │       ├── All required vars present? ── YES ──► Continue
       │       │
       │       └── Missing required var? ──► console.error()
       │                                     process.exit(1)
       │
       └── NODE_ENV !== "production"
               │
               ├── Apply defaults for missing optional vars
               │
               └── console.warn() for any issues
                   Continue with dev defaults
```

### Security Posture Check

The `getSecurityPosture()` function in `src/lib/env.ts` evaluates the runtime security posture based on environment variable configuration:

| Check | Condition | Weight |
|-------|-----------|--------|
| HTTPS Enforced | `NODE_ENV === "production"` | Equal |
| Auth Configured | `NEXTAUTH_SECRET` is set | Equal |
| UAE Data Residency | `DATA_RESIDENCY_REGION === "me-central-1"` | Equal |
| PII Masking | `ENABLE_PII_MASKING === "true"` | Equal |
| Maker-Checker | `ENABLE_MAKER_CHECKER === "true"` | Equal |
| AI On-Premise | `AI_GATEWAY_URL` or `OLLAMA_HOST` is set | Equal |
| CSP Headers | Always `true` (set by `next.config.ts`) | Equal |
| HSTS | Always `true` (set by `next.config.ts`) | Equal |

**Scoring:** 8 checks → Score = (passed / 8) × 100. Grades: A ≥ 90, B ≥ 75, C ≥ 60, D < 60.

### CSP `connect-src` Allowlist

The `next.config.ts` Content-Security-Policy header allows outbound connections to these AI service URLs:

```
connect-src 'self' http://localhost:11434 http://localhost:8000 http://localhost:6333 ws://localhost:3003
```

If your AI services run on different hosts/ports, you must update the CSP header in `next.config.ts` to match.

### GitHub Actions CI/CD Secrets

The `.github/workflows/deploy.yml` pipeline requires these GitHub Secrets:

| Secret | Description |
|--------|-------------|
| `DATABASE_URL` | SQLite path for build-time Prisma client generation |
| `NEXTAUTH_SECRET` | NextAuth signing key for build |
| `UAE_SERVER_HOST` | Target UAE server IP/hostname |
| `UAE_SERVER_USER` | SSH user for deployment |
| `UAE_SERVER_SSH_KEY` | SSH private key for deployment |

---

## Quick Reference Card

```bash
# ═══ Setup ═══
bun install --frozen-lockfile
bun run db:generate
bun run db:push
bunx tsx prisma/seed.ts

# ═══ Development ═══
bun run dev          # http://localhost:3000
bun run lint         # ESLint check

# ═══ Production ═══
bun run build        # next build (standalone)
bun run start        # NODE_ENV=production bun .next/standalone/server.js

# ═══ Docker ═══
docker compose build
docker compose up -d
docker compose logs -f icos-app

# ═══ Health ═══
curl -sf http://localhost:3000/api/health | python3 -m json.tool

# ═══ Generate Secrets ═══
openssl rand -base64 32   # NEXTAUTH_SECRET
openssl rand -hex 16      # QDRANT_API_KEY
```
