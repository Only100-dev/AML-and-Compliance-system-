# Task ID: 9 — Policy & Procedure Management Module

**Agent:** full-stack-developer (Policy & Procedure Management Module)
**Scope:** Add 3 Prisma models + 1 API route + 1 seed script + 1 UI component to fill the internal-policy / departmental-mapping / regulatory-mapping gaps identified in the Master Brain Architecture sprint.

## What was built

### Part A — Prisma schema (prisma/schema.prisma)
Appended 3 new models to the END of the existing schema (existing models untouched):
- `PolicyVersion` — version-controlled content body for a Policy (one row per version; stores contentBody, sections JSON, changeLog, authoredBy/reviewedBy/approvedBy, status, effectiveDate). Indexed on `[policyId, version]` and `[status]`.
- `Department` — normalized insurance department with compliance ownership (name unique, displayName, headUserId, headName, complianceScope "direct"|"indirect", policyCount, activeFindings). Seeded with the 8 insurance departments.
- `ObligationPolicyMapping` — structured cross-reference between an `ExtractedObligation` (from a CBUAE circular) and an internal `Policy` (nullable policyId = MISSING). Stores coverageStatus (COVERED|PARTIAL|MISSING), gapDescription, remediationAction, owner, dueDate, status. Replaces the unstructured `GapAnalysis.missingClauses` text blob.

`bun run db:push` succeeded — Prisma Client v6.19.3 regenerated, SQLite DB in sync.

### Part B — API route (src/app/api/policy-management/route.ts)
- `GET /api/policy-management` — returns policies (with latest PolicyVersion, department ownership, per-policy coverage stats), departments, and obligation mappings (enriched with circular title + obligation action item). Supports `?department=` and `?status=` filters. RBAC: admin/mlro/compliance_manager/compliance_officer. Rate limit: READ tier.
- `POST /api/policy-management` — discriminated by `action` field:
  - `create-version` → creates a PolicyVersion (validates parent Policy exists; 404 if not)
  - `create-department` → creates a Department (409 if name already exists)
  - `create-mapping` → creates an ObligationPolicyMapping (validates obligation + policy exist; resolves circularId from obligation)
  - Creates an audit log entry for each action (`POLICY_VERSION_CREATED` / `DEPARTMENT_CREATED` / `OBLIGATION_MAPPING_CREATED`).
  - RBAC: admin/mlro/compliance_manager. Rate limit: SENSITIVE tier.
- Zod discriminated-union validation. Follows the exact patterns from `/api/policies/route.ts` and `/api/admin/ai-config/route.ts`.

### Seed script (scripts/seed-departments.ts)
Idempotent script that creates the 8 insurance departments if they don't exist: Underwriting, Claims, Brokerage, Finance, IT, Compliance, Legal, HR. Each has a realistic head name, complianceScope (direct/indirect), and description. Follows the `scripts/update-ai-model.ts` import pattern (`from '../src/lib/db'`). Run result: 8 created, 0 skipped.

### Part C — UI component (src/components/ic-os/policies/PolicyProcedureManagement.tsx)
Client component (`'use client'`) with 3 tabs, using TanStack Query to fetch `/api/policy-management`:
1. **Policy Repository** — scrollable table (max-h-96) of policies: policyNumber, title, department (with head-name ownership badge), version, status, last review date, coverage % (computed from obligation mappings). "View Content" button opens a Dialog showing the latest PolicyVersion's contentBody + parsed sections + changeLog. "Add Version" button opens a Dialog with a form (version auto-bumped, title pre-filled, Textarea for contentBody, changeLog input, authoredBy input).
2. **Departments** — responsive grid (1/2/3/4 cols) of department cards: displayName, name (mono), complianceScope badge (direct=emerald, indirect=slate), description, head name, policyCount, activeFindings.
3. **Regulatory Mapping** — scrollable table of ObligationPolicyMappings: circular title + number, obligation action item, mapped policy (or red "MISSING"), coverageStatus badge (COVERED=emerald, PARTIAL=amber, MISSING=rose), gapDescription, owner, dueDate, status. Filter by coverageStatus.

Styling follows `PoliciesSOPs.tsx` exactly: `glass-card` class, dark theme `slate-900/60` backgrounds, `text-xs/sm` sizing, emerald accent color, `Badge variant="outline"` with custom bg/text classes. Uses lucide-react icons (BookOpen, Building2, GitBranch, ShieldCheck, Link2, etc.).

## Files created
- `prisma/schema.prisma` (appended 3 models — no existing models modified)
- `src/app/api/policy-management/route.ts` (GET + POST)
- `scripts/seed-departments.ts`
- `src/components/ic-os/policies/PolicyProcedureManagement.tsx`

## Files modified (minimal, behavior-preserving)
- `src/lib/db.ts` — bumped the PrismaClient global cache key from `prisma` to `prismaV73PolicyMgmt` so the already-running dev server picks up the regenerated Prisma Client (which now includes Department/PolicyVersion/ObligationPolicyMapping delegates). Without this, `db.department` was `undefined` at runtime because the dev server's Node process had the pre-db:push `@prisma/client` module cached. This is a 1-line cache-key change; no external behavior change.

## Verification
- `bun run db:push`: ✅ succeeded (Prisma Client v6.19.3 regenerated)
- `bun run scripts/seed-departments.ts`: ✅ 8 departments created
- `bun run lint`: ✅ 0 errors, 2 pre-existing warnings (AuditTrail.tsx, TrainingCertifications.tsx — not my files). Nav check 43/43 PASS. Audit check 0 FAILs (my new `policy-management` route has audit logging detected — it does NOT appear in the WARN list).
- `GET /api/policy-management`: ✅ HTTP 200 — returns 11 policies, 8 departments, 0 mappings, stats aggregate.
- `POST /api/policy-management` (action=create-version): ✅ HTTP 201 — created PolicyVersion + POLICY_VERSION_CREATED audit log entry. Test artifact cleaned up after verification.

## Notes for downstream agents
- The `Policy.department` field is still free-text (existing data). `departmentInfo` in the API response is `null` when the free-text department string doesn't exactly match a seeded `Department.name`. The UI gracefully falls back to showing the raw string. A future normalization task could backfill `Policy.department` to match `Department.name` exactly.
- The `ObligationPolicyMapping` table is currently empty (0 rows) — mappings are expected to be created by the regulatory gap-analysis workflow (a separate module). The UI shows an empty state with guidance.
- The UI component is exported as both named (`PolicyProcedureManagement`) and default export, ready to be wired into a sidebar item / page render case.
