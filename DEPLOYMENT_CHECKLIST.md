# IC-OS Production Deployment Checklist

> **Version:** v7.2 Phase 6 — Production Deployment
> **Framework:** Next.js 16 with App Router (standalone output mode)
> **Runtime:** Bun
> **Database:** SQLite via Prisma ORM
> **Auth:** NextAuth.js v4
> **Regulatory Framework:** FDL 10/2025, CR 134/2025, CBUAE Notice 3551/2021, goAML v4.2, UAE PDPL
> **Last Updated:** Phase 6 Final

---

## 1. Pre-Deployment Prerequisites

### 1.1 Runtime & Tooling

```bash
# Verify Bun is installed (v1.1+ required)
bun --version

# If not installed:
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version

# Verify Node.js is available (for Prisma compatibility)
node --version   # v18+ recommended

# Verify Git
git --version
```

### 1.2 Server Requirements

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Storage | 20 GB SSD | 50 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| GPU (AI) | — | NVIDIA RTX 3090/4090 or A10G |

### 1.3 Network & Firewall

```bash
# Open required ports
sudo ufw allow 80/tcp      # HTTP (Caddy reverse proxy)
sudo ufw allow 443/tcp     # HTTPS (Caddy reverse proxy)
sudo ufw allow 3000/tcp    # Next.js application (internal)
sudo ufw allow 11434/tcp   # Ollama (AI inference — internal only)
sudo ufw allow 6333/tcp    # Qdrant (vector DB — internal only)
sudo ufw allow 8000/tcp    # AI Gateway (internal only)
sudo ufw enable

# Verify UAE data residency: all services must run in me-central-1 region
# Block all outbound traffic to non-UAE endpoints for PDPL compliance
```

### 1.4 Clone & Install Dependencies

```bash
# Clone the repository
git clone <REPO_URL> /opt/convertEase-platform
cd /opt/convertEase-platform

# Install dependencies
bun install --frozen-lockfile

# Generate Prisma client
bunx prisma generate
```

### 1.5 Process Manager (PM2)

```bash
# Install PM2 globally
npm install -g pm2

# Verify
pm2 --version
```

---

## 2. Environment Variable Setup

### 2.1 Create `.env` File

```bash
cat > .env << 'ENVEOF'
# ═══════════════════════════════════════════════════════════════════
# IC-OS Production Environment Variables
# ═══════════════════════════════════════════════════════════════════

# ── Runtime ────────────────────────────────────────────────────────
NODE_ENV=production

# ── Database (REQUIRED — app will not start without this) ─────────
DATABASE_URL=file:./db/custom.db

# ── NextAuth.js (REQUIRED in production) ──────────────────────────
NEXTAUTH_SECRET=<generate-with-openssl-rand-base64-32>
NEXTAUTH_URL=https://your-domain.ae

# ── AI Infrastructure (On-Premise — UAE Data Residency) ───────────
AI_GATEWAY_URL=http://localhost:8000
OLLAMA_HOST=http://localhost:11434
OLLAMA_URL=http://localhost:11434
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=<your-secure-api-key>

# ── Feature Flags ─────────────────────────────────────────────────
ENABLE_MAKER_CHECKER=true
ENABLE_AI_CHAT=true
ENABLE_PII_MASKING=true

# ── UAE Data Residency ────────────────────────────────────────────
DATA_RESIDENCY_REGION=me-central-1

# ── Z-AI SDK (optional — for cloud AI features) ──────────────────
ZAI_API_KEY=<your-zai-api-key>

# ── Vercel Automation (optional — for Vercel deployments) ─────────
VERCEL_AUTOMATION_BYPASS_SECRET=<your-bypass-secret>
ENVEOF
```

### 2.2 Generate Secure Secrets

```bash
# Generate NEXTAUTH_SECRET (minimum 32 characters)
openssl rand -base64 32

# Generate QDRANT_API_KEY
openssl rand -hex 16

# Generate VERCEL_AUTOMATION_BYPASS_SECRET
openssl rand -hex 16
```

### 2.3 Verify Environment

```bash
# The app validates env vars at startup via Zod (src/lib/env.ts).
# In production, missing REQUIRED vars will cause process.exit(1).
# In development, missing vars produce warnings with defaults.

# Quick check — start the app briefly and watch for validation errors:
NODE_ENV=production bun .next/standalone/server.js &
sleep 3
# If the process exits, check the console for:
#   "❌ IC-OS Environment Validation Failed (Production)"
# Fix any listed issues, then continue.
kill %1 2>/dev/null
```

---

## 3. Database Migration & Seeding (Production)

### 3.1 Push Schema to Database

```bash
# Push Prisma schema to SQLite (creates/updates tables)
bun run db:push

# Expected output:
#   🚀  Your database is now in sync with your Prisma schema.

# Verify schema was applied
bunx prisma db pull --print 2>/dev/null | head -20
```

### 3.2 Generate Prisma Client

```bash
# Ensure Prisma client is generated (required after schema changes)
bun run db:generate
# or:
bunx prisma generate
```

### 3.3 Seed the Database

```bash
# Run the comprehensive seeder
bunx tsx prisma/seed.ts

# Expected output:
#   🌱 Seeding IC-OS database...
#   Clearing existing data...
#   ✅ All existing data cleared.
#   Seeding Users...
#   Seeding RegulatoryCirculars...
#   Seeding GapAnalyses...
#   Seeding AMLAlerts...
#   ...
#   ✅ Seeding complete.
```

### 3.4 Verify Seed Data

```bash
# Check that the 8 default users were created
bunx prisma studio &
# Or query directly:
sqlite3 db/custom.db "SELECT email, role FROM User ORDER BY role;"
```

**Expected 8 users:**

| Email | Role | Must Change Password |
|-------|------|---------------------|
| `admin@icos.ae` | admin | ⚠️ YES — first login |
| `mlro@icos.ae` | mlro | ⚠️ YES — first login |
| `ahmed@icos.ae` | mlro | ⚠️ YES — first login |
| `fatima@icos.ae` | compliance_manager | ⚠️ YES — first login |
| `omar@icos.ae` | compliance_officer | ⚠️ YES — first login |
| `sara@icos.ae` | dept_head | ⚠️ YES — first login |
| `khalid@icos.ae` | analyst | ⚠️ YES — first login |
| `board@icos.ae` | board | ⚠️ YES — first login |

> ⚠️ **CRITICAL:** Change all default passwords immediately after first deployment.

### 3.5 Backup the Seeded Database

```bash
# Create a backup before going live
cp db/custom.db db/custom.db.seed-backup-$(date +%Y%m%d%H%M%S)

# Verify backup
ls -la db/custom.db*
```

---

## 4. Build Commands

### 4.1 Lint Check

```bash
bun run lint
# Expected: 0 errors, 0 warnings
```

### 4.2 Type Check

```bash
bunx tsc --noEmit
# Expected: 0 errors (continue-on-error in CI)
```

### 4.3 Production Build

```bash
# Build with standalone output mode
bun run build

# What this does (from package.json):
#   next build                              → Compiles Next.js app
#   cp -r .next/static .next/standalone/.next/  → Copies static assets to standalone output
#   cp -r public .next/standalone/          → Copies public folder to standalone output
```

### 4.4 Verify Build Output

```bash
# Check standalone output exists
ls -la .next/standalone/
# Should contain: server.js, .next/, public/, node_modules/

# Verify server.js exists
test -f .next/standalone/server.js && echo "✅ Build OK" || echo "❌ Build FAILED"

# Check static assets
ls -la .next/standalone/.next/static/

# Check public folder
ls -la .next/standalone/public/
```

### 4.5 Start Production Server

```bash
# Start the standalone server
bun run start

# Which runs:
#   NODE_ENV=production bun .next/standalone/server.js

# Or manually with custom port:
# PORT=3000 NODE_ENV=production bun .next/standalone/server.js
```

---

## 5. Deployment Options

### 5.1 Docker Standalone (Recommended for On-Premise UAE)

#### 5.1.1 Create Dockerfile

```bash
cat > Dockerfile << 'DOCKERFILE'
# ── Stage 1: Build ─────────────────────────────────────────────
FROM oven/bun:1 AS builder
WORKDIR /app

# Install dependencies first (cache layer)
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Generate Prisma client
RUN bunx prisma generate

# Build Next.js standalone output
RUN bun run build

# ── Stage 2: Production ────────────────────────────────────────
FROM oven/bun:1-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/db ./db

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start
CMD ["bun", "server.js"]
DOCKERFILE
```

#### 5.1.2 Create Docker Compose (Full Stack)

```bash
cat > docker-compose.yml << 'COMPOSE'
version: '3.8'

services:
  # IC-OS Application
  icos-app:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: icos-app
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=file:./db/custom.db
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - AI_GATEWAY_URL=http://ollama:8000
      - OLLAMA_HOST=http://ollama:11434
      - OLLAMA_URL=http://ollama:11434
      - QDRANT_URL=http://qdrant:6333
      - QDRANT_API_KEY=${QDRANT_API_KEY}
      - ENABLE_MAKER_CHECKER=true
      - ENABLE_AI_CHAT=true
      - ENABLE_PII_MASKING=true
      - DATA_RESIDENCY_REGION=me-central-1
    volumes:
      - icos_db:/app/db
      - icos_uploads:/app/uploads
    depends_on:
      ollama:
        condition: service_healthy
      qdrant:
        condition: service_healthy
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  # Ollama: AI Model Inference
  ollama:
    image: ollama/ollama:latest
    container_name: icos-ollama
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
    environment:
      - OLLAMA_HOST=0.0.0.0
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:11434/api/tags"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s

  # Qdrant: Vector Database
  qdrant:
    image: qdrant/qdrant:latest
    container_name: icos-qdrant
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_data:/qdrant/storage
    environment:
      - QDRANT__SERVICE__API_KEY=${QDRANT_API_KEY}
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Caddy: Reverse Proxy & TLS Termination
  caddy:
    image: caddy:2
    container_name: icos-caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - icos-app
    restart: unless-stopped

volumes:
  icos_db:
  icos_uploads:
  ollama_data:
  qdrant_data:
  caddy_data:
  caddy_config:
COMPOSE
```

#### 5.1.3 Build & Run Docker

```bash
# Build the Docker image
docker compose build

# Start all services
docker compose up -d

# Verify all containers are running
docker compose ps

# Check application health
curl -s http://localhost:3000/api/health | python3 -m json.tool

# View logs
docker compose logs -f icos-app
```

#### 5.1.4 Seed Database in Docker

```bash
# Run seed inside the running container
docker compose exec icos-app bunx tsx prisma/seed.ts

# Verify seed
docker compose exec icos-app sqlite3 db/custom.db \
  "SELECT email, role FROM User ORDER BY role;"
```

### 5.2 Vercel Deployment

#### 5.2.1 Prerequisites

```bash
# Install Vercel CLI
bun add -g vercel

# Login
vercel login
```

#### 5.2.2 Configure for Vercel

```bash
# Note: Vercel does NOT support standalone output mode.
# Temporarily adjust next.config.ts for Vercel:
#   - Remove `output: "standalone"` from next.config.ts
#   - Vercel handles build output automatically

# Set environment variables in Vercel dashboard or CLI:
vercel env add DATABASE_URL production
vercel env add NEXTAUTH_SECRET production
vercel env add NEXTAUTH_URL production
vercel env add AI_GATEWAY_URL production
vercel env add OLLAMA_HOST production
vercel env add OLLAMA_URL production
vercel env add QDRANT_URL production
vercel env add QDRANT_API_KEY production
vercel env add ENABLE_MAKER_CHECKER production
vercel env add ENABLE_AI_CHAT production
vercel env add ENABLE_PII_MASKING production
vercel env add DATA_RESIDENCY_REGION production
vercel env add ZAI_API_KEY production
vercel env add VERCEL_AUTOMATION_BYPASS_SECRET production
vercel env add NODE_ENV production

# ⚠️ IMPORTANT: For Vercel, use an external SQLite provider
# (Turso, PlanetScale, or Cloudflare D1) since Vercel's
# ephemeral filesystem will lose local SQLite data.
# Update DATABASE_URL accordingly.
```

#### 5.2.3 Deploy

```bash
# Deploy to preview
vercel

# Deploy to production
vercel --prod

# Verify
curl -s https://your-app.vercel.app/api/health | python3 -m json.tool
```

### 5.3 AWS Deployment (EC2 + UAE Region)

#### 5.3.1 Launch EC2 Instance

```bash
# Use AWS CLI or Console:
# Region: me-central-1 (UAE)
# AMI: Ubuntu 22.04 LTS
# Instance: t3.medium (minimum) / t3.xlarge (recommended)
# Storage: 50 GB gp3 SSD
# Security Group: Allow ports 22, 80, 443 from 0.0.0.0/0
#                 Allow port 3000 from localhost only

# SSH into instance
ssh -i ~/.aws/your-key.pem ubuntu@<EC2-PUBLIC-IP>
```

#### 5.3.2 Setup on EC2

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Install PM2
npm install -g pm2

# Clone repository
git clone <REPO_URL> /opt/convertEase-platform
cd /opt/convertEase-platform

# Install dependencies
bun install --frozen-lockfile

# Create .env file (see Section 2.1)
nano .env

# Push database schema
bun run db:push

# Seed database
bunx tsx prisma/seed.ts

# Build
bun run build
```

#### 5.3.3 Start with PM2

```bash
# Start the application with PM2
NODE_ENV=production pm2 start bun --name "convertEase-app" -- run start

# Save PM2 process list (auto-restart on reboot)
pm2 save
pm2 startup

# Verify
pm2 status
pm2 logs convertEase-app
```

#### 5.3.4 Setup Caddy Reverse Proxy

```bash
# Install Caddy
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | \
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | \
  sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy

# Configure Caddyfile for your domain
cat > /etc/caddy/Caddyfile << 'CADDY'
your-domain.ae {
    reverse_proxy localhost:3000 {
        header_up Host {host}
        header_up X-Forwarded-For {remote_host}
        header_up X-Forwarded-Proto {scheme}
        header_up X-Real-IP {remote_host}
    }
}
CADDY

# Start Caddy
sudo systemctl restart caddy
sudo systemctl enable caddy
```

---

## 6. Post-Deployment Verification

### 6.1 Health Check

```bash
# Check the health endpoint
curl -s https://your-domain.ae/api/health | python3 -m json.tool

# Expected response structure:
# {
#   "status": "healthy",          ← Must be "healthy" or "degraded"
#   "version": "6.0.0",
#   "region": "me-central-1",     ← Must match UAE region
#   "dataResidency": "UAE",
#   "security": {
#     "score": 88,                ← Should be ≥ 75 for production
#     "grade": "B"                ← Should be A or B
#   },
#   "services": {
#     "database": {
#       "status": "connected"     ← Must be "connected"
#     }
#   }
# }

# Quick health status check (returns 503 if unhealthy)
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://your-domain.ae/api/health)
if [ "$HEALTH" = "200" ]; then
  echo "✅ Health check PASSED (HTTP $HEALTH)"
else
  echo "❌ Health check FAILED (HTTP $HEALTH)"
  exit 1
fi
```

### 6.2 Security Headers Verification

```bash
# Verify all 8 security headers are present
curl -sI https://your-domain.ae | grep -iE '(strict-transport|x-frame|x-content-type|x-xss|referrer-policy|permissions-policy|content-security|x-dns)'

# Expected headers:
#   Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
#   X-Frame-Options: DENY
#   X-Content-Type-Options: nosniff
#   X-XSS-Protection: 1; mode=block
#   Referrer-Policy: strict-origin-when-cross-origin
#   Permissions-Policy: camera=(), microphone=(), geolocation=(), browsing-topics=()
#   Content-Security-Policy: default-src 'self'; ...
#   X-DNS-Prefetch-Control: on
```

### 6.3 Default User Login Verification

```bash
# Verify admin and MLRO accounts exist
curl -s https://your-domain.ae/api/health | python3 -c "
import json, sys
data = json.load(sys.stdin)
print(f'Status: {data[\"status\"]}')
print(f'Security Score: {data[\"security\"][\"score\"]}/100 ({data[\"security\"][\"grade\"]})')
print(f'Region: {data[\"region\"]}')
print(f'DB Status: {data[\"services\"][\"database\"][\"status\"]}')
"
```

### 6.4 Smoke Test (Full E2E)

```bash
# ⚠️  Refer to the comprehensive smoke test checklist:
#     SMOKE_TEST_CHECKLIST.md
#
# Key smoke tests to run immediately after deployment:

# 1. Health endpoint returns healthy
curl -sf https://your-domain.ae/api/health > /dev/null && echo "✅ Health OK" || echo "❌ Health FAIL"

# 2. Homepage loads (HTTP 200)
curl -sf -o /dev/null https://your-domain.ae && echo "✅ Homepage OK" || echo "❌ Homepage FAIL"

# 3. AML API returns data
curl -sf https://your-domain.ae/api/aml > /dev/null && echo "✅ AML API OK" || echo "❌ AML API FAIL"

# 4. Dashboard API returns data
curl -sf https://your-domain.ae/api/dashboard > /dev/null && echo "✅ Dashboard API OK" || echo "❌ Dashboard API FAIL"

# 5. Security headers present
HSTS=$(curl -sI https://your-domain.ae | grep -ci "strict-transport-security")
XFRAME=$(curl -sI https://your-domain.ae | grep -ci "x-frame-options.*DENY")
[ "$HSTS" -ge 1 ] && [ "$XFRAME" -ge 1 ] && echo "✅ Security Headers OK" || echo "❌ Security Headers FAIL"

# 6. Database connectivity (via health endpoint)
DB_STATUS=$(curl -s https://your-domain.ae/api/health | python3 -c "import json,sys; print(json.load(sys.stdin)['services']['database']['status'])")
[ "$DB_STATUS" = "connected" ] && echo "✅ Database OK" || echo "❌ Database FAIL"

# 7. UAE Data Residency enforced
REGION=$(curl -s https://your-domain.ae/api/health | python3 -c "import json,sys; print(json.load(sys.stdin)['region'])")
[ "$REGION" = "me-central-1" ] && echo "✅ UAE Data Residency OK" || echo "❌ Data Residency FAIL"
```

### 6.5 Full Smoke Test Checklist

> **Reference:** See `SMOKE_TEST_CHECKLIST.md` for the complete 20-module, 100+ item checklist covering:
>
> - Module 1: Admin & User Management
> - Module 2: KYC Onboarding
> - Module 3: Maker-Checker (4-Eyes Principle)
> - Module 4: AML & Sanctions
> - Module 5: goAML Filing
> - Module 6: Adverse Media Screening
> - Module 7: Regulatory Intelligence
> - Module 8: Claims Portals (4-Persona)
> - Module 9: Training & Effectiveness
> - Module 10: Compliance Audits
> - Module 11: Command Center & Analytics
> - Module 12: Evidence War Room
> - Module 13: Legal Advisory
> - Module 14: Policies & SOPs
> - Module 15: CBUAE Quarterly Reporting
> - Module 16: CBUAE Submission Checker
> - Module 17: AI Agent Management
> - Module 18: AML Self-Assessment
> - Module 19: Security Center
> - Module 20: Audit Trail
> - Cross-Module Integration Tests
> - Export & Reporting Tests
> - Security & Compliance Tests
> - Performance Tests
> - Accessibility & Responsiveness

### 6.6 AI Infrastructure Verification (If Applicable)

```bash
# Check Ollama is running
curl -sf http://localhost:11434/api/tags > /dev/null && echo "✅ Ollama OK" || echo "⚠️ Ollama not configured"

# Check Qdrant is running
curl -sf http://localhost:6333/healthz > /dev/null && echo "✅ Qdrant OK" || echo "⚠️ Qdrant not configured"

# Check AI Gateway (if configured)
curl -sf http://localhost:8000/health > /dev/null && echo "✅ AI Gateway OK" || echo "⚠️ AI Gateway not configured"
```

---

## 7. Rollback Procedure

### 7.1 Quick Rollback (PM2 / Bare Metal)

```bash
# Step 1: Identify current version
cd /opt/convertEase-platform
git log --oneline -1

# Step 2: Stop the application
pm2 stop convertEase-app

# Step 3: Roll back to previous Git commit
git log --oneline -10  # Find the commit to roll back to
git checkout <PREVIOUS_STABLE_COMMIT>

# Step 4: Reinstall dependencies
bun install --frozen-lockfile

# Step 5: Rebuild
bunx prisma generate
bun run build

# Step 6: Restart
pm2 restart convertEase-app

# Step 7: Verify
curl -sf http://localhost:3000/api/health > /dev/null && echo "✅ Rollback successful" || echo "❌ Rollback failed"
```

### 7.2 Docker Rollback

```bash
# Step 1: List previous Docker images
docker images | grep icos-app

# Step 2: Roll back to previous image version
docker compose down
docker tag icos-app:previous icos-app:current  # If you tagged previous
# OR: Roll back Git and rebuild
git checkout <PREVIOUS_STABLE_COMMIT>
docker compose build --no-cache
docker compose up -d

# Step 3: Verify
curl -sf http://localhost:3000/api/health | python3 -m json.tool
```

### 7.3 Database Rollback

```bash
# If you need to roll back the database to a pre-seed state:

# Step 1: Stop the application
pm2 stop convertEase-app

# Step 2: Restore database backup
DB_BACKUP=$(ls -t db/custom.db.seed-backup-* | head -1)
cp "$DB_BACKUP" db/custom.db
echo "Restored from: $DB_BACKUP"

# Step 3: Push the schema for the target version
git checkout <PREVIOUS_STABLE_COMMIT>
bunx prisma generate
bun run db:push

# Step 4: Rebuild and restart
bun run build
pm2 restart convertEase-app
```

### 7.4 Vercel Rollback

```bash
# List deployments
vercel ls

# Roll back to previous deployment
vercel rollback <DEPLOYMENT_URL>

# Or promote a previous preview deployment to production
vercel --prod <PREVIOUS_DEPLOYMENT_URL>
```

### 7.5 Emergency Kill Switch

```bash
# If the application is causing issues and needs immediate shutdown:

# PM2
pm2 stop convertEase-app
pm2 delete convertEase-app

# Docker
docker compose down --remove-orphans

# Bare process
pkill -f "bun.*server.js"
pkill -f "next.*start"

# Verify port 3000 is free
lsof -i :3000 || echo "Port 3000 is free"
```

---

## Appendix A: Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Runtime environment: `production` / `development` / `test` |
| `DATABASE_URL` | Yes | `file:./dev.db` | SQLite connection string |
| `NEXTAUTH_SECRET` | Prod | — | NextAuth.js signing key (min 32 chars) |
| `NEXTAUTH_URL` | Prod | — | Public URL of the application |
| `AI_GATEWAY_URL` | No | — | AI Gateway endpoint (on-premise) |
| `OLLAMA_HOST` | No | — | Ollama inference engine URL |
| `OLLAMA_URL` | No | — | Ollama URL (alternate config) |
| `QDRANT_URL` | No | — | Qdrant vector database URL |
| `QDRANT_API_KEY` | No | — | Qdrant authentication key |
| `ENABLE_MAKER_CHECKER` | No | `true` | Enable 4-eyes principle enforcement |
| `ENABLE_AI_CHAT` | No | `true` | Enable AI chat widget |
| `ENABLE_PII_MASKING` | No | `true` | Enable PII masking for CBUAE views |
| `DATA_RESIDENCY_REGION` | No | `me-central-1` | UAE data residency region |
| `ZAI_API_KEY` | No | — | Z-AI SDK API key (cloud features) |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | No | — | Vercel deployment bypass secret |

## Appendix B: Security Headers Reference

The following headers are configured in `next.config.ts` and applied to all routes:

| Header | Value | Purpose |
|--------|-------|---------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS (2 years) |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-XSS-Protection` | `1; mode=block` | XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), browsing-topics=()` | Disable browser features |
| `Content-Security-Policy` | `default-src 'self'; ...` | Resource loading policy |
| `X-DNS-Prefetch-Control` | `on` | Enable DNS prefetching |

## Appendix C: Health Check Response Format

```json
{
  "status": "healthy",
  "timestamp": "2025-01-20T10:30:00.000Z",
  "version": "6.0.0",
  "phase": "Phase 6 — Production Readiness",
  "uptime": 3600,
  "region": "me-central-1",
  "dataResidency": "UAE",
  "compliance": {
    "pdpl": true,
    "cbuae": true,
    "cspHeaders": true,
    "hsts": true
  },
  "services": {
    "database": {
      "status": "connected",
      "latencyMs": 5,
      "provider": "SQLite"
    },
    "aiGateway": {
      "status": "available",
      "url": "http://localhost:8000"
    },
    "ollama": {
      "status": "available",
      "url": "http://localhost:11434"
    }
  },
  "security": {
    "score": 88,
    "grade": "B",
    "checks": {
      "httpsEnforced": true,
      "authConfigured": true,
      "dataResidencyUAE": true,
      "piiMaskingEnabled": true,
      "makerCheckerEnabled": true,
      "aiOnPremise": true,
      "cspHeadersActive": true,
      "hstsActive": true
    }
  },
  "performance": {
    "healthCheckLatencyMs": 12
  }
}
```

## Appendix D: CI/CD Pipeline Reference

The GitHub Actions pipeline (`.github/workflows/deploy.yml`) performs:

1. **Quality Gate:** `bun install` → `bun run lint` → `bunx tsc --noEmit`
2. **Build:** `bun run build` (with `DATABASE_URL` and `NEXTAUTH_SECRET` secrets)
3. **Deploy:** SSH to UAE server → `git pull` → `bun install` → `prisma db push` → `bun run build` → `pm2 restart`
4. **Verification:** `curl http://localhost:3000/api/health`

Required GitHub Secrets:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `UAE_SERVER_HOST`
- `UAE_SERVER_USER`
- `UAE_SERVER_SSH_KEY`

---

**All checklist items must be verified before declaring production deployment complete.**
**Any failures must be documented with a JIRA/issue ticket and resolved before launch.**
