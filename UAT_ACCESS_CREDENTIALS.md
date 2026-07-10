# UAT Access Credentials — IC-OS v7.3.0-RC1

**Document Type:** UAT Access Credential Sheet
**Release:** IC-OS v7.3.0-RC1
**Audience:** All UAT Stakeholders (Compliance Manager, Department Heads, CCO/MLRO, IT/Security, Development Team)
**Classification:** UAT-Only — Do NOT distribute outside the UAT team. Production credentials are managed separately.
**Companion Documents:** `UAT_KICKOFF_BRIEF.md`, `UAT_TEST_SCENARIOS.md`, `UAT_ENVIRONMENT_RUNBOOK.md`

---

## ⚠️ Important Security Notice

The credentials in this document are **UAT-only**. They are seeded by `prisma/seed-uat.ts` and exist only in the UAT environment. They are **NOT** valid in production. Production credentials are managed through a separate, access-controlled secret store and are provisioned at deployment time.

The demo passwords (`admin123`, `mlro123`, `cm123`, `co123`, `dh123`, `board123`) are intentionally simple for UAT usability and are defined in `src/app/api/auth/[...nextauth]/route.ts`. **They must never be used in production.** The production deployment checklist (§6.2 of `UAT_KICKOFF_BRIEF.md`) requires the JWT secret to be rotated and the demo-password bypass to be disabled in production.

---

## Two Access Methods

UAT supports two access methods. **Non-technical stakeholders** (Compliance Manager, Department Heads, CCO/MLRO, Board) should use **Method A** (browser login). **IT/Security and the Development Team** should use **Method B** (API header impersonation) for direct endpoint testing.

### Method A: Browser Login (for non-technical stakeholders)

This method uses the standard NextAuth CredentialsProvider login flow. It is the recommended method for stakeholders who will test through the UI rather than calling APIs directly.

**Steps**:

1. **Open the Preview Panel** — In the development workspace, the Preview Panel is on the right side of the interface. Click the **"Open in New Tab"** button to launch the application in a separate browser tab. The application URL is `http://localhost:3000`.

2. **Navigate to the login page** — In the new browser tab, navigate to `http://localhost:3000/login`. The login form is rendered by `src/app/login/page.tsx` (using the `LoginForm` component at `src/components/auth/LoginForm.tsx`).

3. **Enter credentials** — Use the email and password from the **6 UAT Accounts Table** below. For example, the Compliance Manager logs in with:
   - **Email**: `uat-user-3@icos-test.local`
   - **Password**: `cm123`

4. **Session duration** — The session lasts **8 hours** (JWT strategy, `maxAge: 8 * 60 * 60` seconds). After 8 hours, the session expires and the user must log in again. Idle timeout is enforced separately by `src/hooks/use-idle-timeout.ts`.

5. **Role enforcement** — After login, the user's role (admin, mlro, compliance_manager, compliance_officer, dept_head, board) is encoded in the JWT. The UI and API enforce role-based access based on this claim. The `board` role has restricted operational access but full dashboard/analytics visibility.

6. **Switching accounts** — To test with a different role, log out (top-right user menu → Sign Out) and log in with the other account's credentials. There is no account-switcher shortcut — this is intentional to prevent accidental role escalation during testing.

### Method B: API Header Impersonation (for IT/Security + Dev Support)

This method bypasses the NextAuth login flow and impersonates a user directly via HTTP headers. It is the recommended method for IT/Security (verifying RBAC enforcement) and the Development Team (debugging specific endpoints). It is **faster** than Method A for repeat API testing and allows precise control over which user is making each request.

**How it works**:

- All `withRBAC`-protected endpoints require two headers:
  - `x-user-role` — the user's role (e.g., `compliance_manager`, `mlro`, `admin`)
  - `x-user-id` — the user's Prisma ID (e.g., `cmqm1payy0002orjaeg2irv2e`)
- All `authGuard`-protected endpoints work **without** headers in dev mode (synthetic admin bypass — see "Auth Architecture Notes" below) OR with NextAuth login.
- The headers are read by `src/lib/compliance/rbac.ts` (for `withRBAC` routes) and `src/lib/auth-guard.ts` (for `authGuard` routes).

**Example — list complaints as Compliance Manager**:
```bash
curl -H "x-user-role: compliance_manager" \
     -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
     http://localhost:3000/api/complaints
```

**Example — approve a GoAML SAR as MLRO**:
```bash
curl -X POST http://localhost:3000/api/goaml/approve \
     -H "Content-Type: application/json" \
     -H "x-user-role: mlro" \
     -H "x-user-id: cmqm1payx0001orjatypofwed" \
     -d '{"caseId": "cmqm..."}'
```

**Example — verify audit integrity as Compliance Manager**:
```bash
curl -H "x-user-role: compliance_manager" \
     -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
     "http://localhost:3000/api/audit/integrity?fresh=1"
```

**Important**: The `x-user-id` must match a real User row in the database (see the table below). Using a fabricated ID will cause a 401/403 error. The `x-user-role` must match the role assigned to that User row — mismatched role+ID pairs are rejected by `withRBAC`.

**Dev-mode bypass (authGuard only)**: `authGuard`-protected endpoints (in `src/lib/auth-guard.ts`) accept unauthenticated requests in dev mode (`NODE_ENV=development`) by injecting a synthetic admin user. This bypass does **NOT** apply to `withRBAC`-protected endpoints — those always require the headers. The bypass is enforced as dev-only by the CI script `scripts/check-audit.ts` (see "Auth Architecture Notes" below).

---

## 6 UAT Accounts Table

All six accounts are created by `prisma/seed-uat.ts` (idempotent — re-running the seed will skip creation if the sentinel user `uat-user-1@icos-test.local` already exists). The accounts cover all six roles in the IC-OS role hierarchy.

| # | Role | Name | Email | Password | User ID | Primary Scenarios |
|---|---|---|---|---|---|---|
| 1 | `admin` | UAT Admin User | `uat-user-1@icos-test.local` | `admin123` | `cmqm1payv0000orjafk0tql7m` | All (full access — IT/Security + Dev Support) |
| 2 | `mlro` | UAT MLRO Officer | `uat-user-2@icos-test.local` | `mlro123` | `cmqm1payx0001orjatypofwed` | Scenario 2 (GoAML approve — 4-eyes checker), Scenario 4 (audit verify — executive sign-off) |
| 3 | `compliance_manager` | UAT Compliance Manager | `uat-user-3@icos-test.local` | `cm123` | `cmqm1payy0002orjaeg2irv2e` | Scenarios 1, 3, 5 (PRIMARY TESTER — full complaint lifecycle, policy attestation creator, my-tasks inbox owner) |
| 4 | `compliance_officer` | UAT Compliance Officer | `uat-user-4@icos-test.local` | `co123` | `cmqm1payy0003orjaa6w1b10k` | Scenario 1 (complaint ack), Scenario 5 (my-tasks inbox) |
| 5 | `dept_head` | UAT Department Head | `uat-user-5@icos-test.local` | `dh123` | `cmqm1payz0004orjadlw12mp5` | Scenario 3 (policy attestation — acknowledger), circular acks, cross-dept routing |
| 6 | `board` | UAT Board Member | `uat-user-6@icos-test.local` | `board123` | `cmqm1paz00005orjac7jxcgge` | Read-only dashboards (board portal, executive analytics) |

**Quick-reference for scenario testers**:

- **Scenario 1 (Complaint Lifecycle)** — Primary: account #3 (Compliance Manager). The Compliance Manager creates, transitions, and closes complaints. Account #5 (Department Head) can be used to verify cross-department routing for complaints assigned to `DEPT-CLAIMS` or `DEPT-UNDERWRITING`.
- **Scenario 2 (GoAML Maker-Checker)** — Maker: account #3 (Compliance Manager, creates draft). Checker: account #2 (MLRO, approves — different user from maker per 4-eyes enforcement).
- **Scenario 3 (Policy Attestation)** — Creator: account #3 (Compliance Manager, distributes policy). Acknowledger: account #5 (Department Head, attests to reading).
- **Scenario 4 (Data-Room Generation)** — Primary: account #3 (Compliance Manager, generates package). PII verification: account #1 (Admin / IT-Security, runs `pii-leak-detection.mjs`).
- **Scenario 5 (My Tasks Inbox)** — Primary: account #3 (Compliance Manager, 3 tasks seeded: 2 COMPLAINT + 1 CAP). Secondary: account #4 (Compliance Officer, verify a different user sees a different task set).

---

## Auth Architecture Notes

This section documents the authentication and authorization architecture for IT/Security verification during UAT. All assertions here are verifiable by inspecting the source files referenced.

### NextAuth CredentialsProvider
- **File**: `src/app/api/auth/[...nextauth]/route.ts`
- **Strategy**: JWT (stateless — no server-side session store required)
- **Session maxAge**: 8 hours (`maxAge: 8 * 60 * 60`)
- **Provider**: CredentialsProvider (email + password)
- **Password validation**: Role-based demo passwords (`admin123`, `mlro123`, `cm123`, `co123`, `dh123`, `board123`) — these are intentionally simple for UAT and are defined in the NextAuth route file. In production, this is replaced by an identity provider integration (see `src/lib/integrations/identity-provider.ts`).

### JWT Session Strategy
- The JWT contains: `user.id`, `user.email`, `user.role`, `user.name`, `iat` (issued at), `exp` (expiration)
- The JWT is signed with `NEXTAUTH_SECRET` (must be rotated for production — see §6.2 of `UAT_KICKOFF_BRIEF.md`)
- The JWT is sent as an HTTP-only cookie named `next-auth.session-token`
- Token verification on each request is handled by NextAuth's `getServerSession`

### Role Hierarchy
The six roles form a strict hierarchy. Higher roles inherit the permissions of lower roles (with some exceptions for operational access):

```
admin > mlro > compliance_manager > compliance_officer > dept_head > board
```

- **admin** — Full system access. Used by IT/Security for verification and Dev Support for debugging. Not a business role.
- **mlro** — Money Laundering Reporting Officer. Approval authority on GoAML submissions (4-eyes checker). Full read on dashboards, audit trail, and SARs. Executive sign-off authority.
- **compliance_manager** — Primary operational role. Creates and transitions complaints, distributes policies, generates data-rooms, manages CAPs. Primary tester role in UAT.
- **compliance_officer** — Operational role. Acknowledges complaints, manages day-to-day compliance tasks. Reports to compliance_manager.
- **dept_head** — Department-level role (Legal, Underwriting, Claims). Acknowledges policies (attestation), receives circular acknowledgments, routes complaints within their department. Restricted operational access outside their department.
- **board** — Board member role. **Restricted operational access** but full dashboard and analytics visibility. Used for the Board Portal (`src/components/ic-os/board/BoardPortal.tsx`). Cannot create or transition operational records.

The role hierarchy and permission grants are defined in `src/lib/compliance/rbac.ts`. The `canViewUnifiedTasks` permission (new in v7.3.0) is granted to `compliance_officer`, `compliance_manager`, `mlro`, `dept_head`, and `admin` — **NOT** to `board` (board members use a separate dashboard view, not the operational my-tasks inbox).

### Dev-Mode Bypass (authGuard — NOT withRBAC)

Two distinct auth middlewares exist in IC-OS:

1. **`withRBAC`** (`src/lib/compliance/rbac.ts`) — Role-based access control. **ALWAYS** requires `x-user-role` and `x-user-id` headers, even in dev mode. No bypass. Used by all new v7.3.0 endpoints and most operational endpoints (complaints, goaml, tasks, audit integrity, etc.).

2. **`authGuard`** (`src/lib/auth-guard.ts`) — Authentication guard (not role-aware). In dev mode (`NODE_ENV=development`), unauthenticated requests receive a **synthetic admin** user. This allows smoke-testing legacy endpoints without logging in. In production (`NODE_ENV=production`), the bypass is disabled and all requests require a valid NextAuth session.

**The dev-mode bypass is enforced as dev-only by CI**:
- `scripts/check-audit.ts` — verifies that the authGuard bypass is gated behind `NODE_ENV=development` and would fail CI if the gate is removed.
- `scripts/check-rbac-dev-bypass.ts` — verifies that `withRBAC` does NOT have a similar bypass (the bypass is forbidden in `withRBAC`).
- `scripts/check-audit-logging.ts` — verifies that all write operations are audit-logged.

**IT/Security verification during UAT**: Run all three scripts (see `UAT_ENVIRONMENT_RUNBOOK.md` §"How to Run Security Checks") and confirm they pass. Any failure is a P0 security bug.

### PII Masking

PII masking is enforced at multiple layers:
- **Audit log layer** — `src/lib/audit.ts::createAuditLog()` calls `stripPIIFromText()` on `details` before hashing. PII patterns stripped: Emirates IDs, UAE phone numbers, IBANs, email addresses (except `@icos-test.local` test patterns), passport numbers.
- **Data-room output layer** — All PII fields in the data-room package are masked (`REDACTED` or partial masking like `***-****-****-1234`).
- **PII reveal endpoint** — `src/app/api/pii/reveal/route.ts` requires elevated permission and audit-logs every reveal (break-glass access).
- **Verification** — `scripts/pii-leak-detection.mjs` scans all API responses and database exports for raw PII patterns. Expected: 0 matches on real PII.

---

## Quick-Start Recipes

### Recipe 1: Compliance Manager tests Scenario 1 (Complaint Lifecycle) via browser

1. Open the Preview Panel → click "Open in New Tab".
2. Navigate to `http://localhost:3000/login`.
3. Log in with `uat-user-3@icos-test.local` / `cm123`.
4. Navigate to the Complaints module in the sidebar.
5. Click "New Complaint" → fill in the form → submit.
6. Verify the new complaint appears in the list with `status: NEW`.
7. Click the complaint → click "Acknowledge" → confirm.
8. Continue transitioning through `INVESTIGATING → RESOLVED → CLOSED`.
9. Navigate to the SLA Monitors module to verify SLA dashboard.
10. Navigate to the Audit Trail module to verify all transitions are logged.

### Recipe 2: IT/Security verifies RBAC enforcement via API

1. Confirm dev server is running: `curl http://localhost:3000/api/health` → 200.
2. Test valid role+ID pair:
   ```bash
   curl -H "x-user-role: compliance_manager" -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
        http://localhost:3000/api/tasks/my-tasks
   ```
   Expected: 200 with task array.
3. Test missing headers (should be rejected):
   ```bash
   curl http://localhost:3000/api/tasks/my-tasks
   ```
   Expected: 401 Unauthorized.
4. Test invalid role (mismatched with user ID):
   ```bash
   curl -H "x-user-role: mlro" -H "x-user-id: cmqm1payy0002orjaeg2irv2e" \
        http://localhost:3000/api/tasks/my-tasks
   ```
   Expected: 403 Forbidden (the user is a compliance_manager, not mlro).
5. Test board role cannot access my-tasks:
   ```bash
   curl -H "x-user-role: board" -H "x-user-id: cmqm1paz00005orjac7jxcgge" \
        http://localhost:3000/api/tasks/my-tasks
   ```
   Expected: 403 Forbidden (board does not have `canViewUnifiedTasks`).
6. Run the security-check scripts (see `UAT_ENVIRONMENT_RUNBOOK.md`).

### Recipe 3: CCO/MLRO approves a GoAML SAR via browser

1. Log in as `uat-user-2@icos-test.local` / `mlro123`.
2. Navigate to the GoAML Filing Center module.
3. Find the SAR draft created by the Compliance Manager (in Scenario 2).
4. Review the SAR narrative and supporting evidence.
5. Click "Approve" → confirm.
6. Verify the SAR status changes to `APPROVED_FOR_FILING`.
7. Click "Submit to GoAML" → confirm.
8. Verify the SAR status changes to `SUBMITTED`.
9. Navigate to the Audit Trail module → filter by `action: SAR_APPROVED` and `action: SAR_SUBMITTED` → verify both entries exist with the MLRO's user ID.

---

## FAQ

**Q: I logged in but the page shows "Access Denied". What's wrong?**
A: The role encoded in your JWT doesn't have permission for that module. Check the role hierarchy above. For example, the `board` role cannot access the My Tasks inbox (use the Board Portal instead). Log out and log in with the appropriate role's credentials.

**Q: My API request returns 401 even though I set the headers. What's wrong?**
A: Verify (a) the `x-user-id` matches a real User row in the database (use the table above), (b) the `x-user-role` matches the role assigned to that user, and (c) the headers are spelled exactly `x-user-role` and `x-user-id` (case-insensitive on most clients, but match the spec). If using `curl`, ensure the headers are passed with `-H` (not `-d`).

**Q: I want to test as a different user without logging out. Can I?**
A: Via the browser, no — NextAuth enforces one session per browser tab. Via the API (Method B), yes — just change the `x-user-role` and `x-user-id` headers on each request. This is the recommended approach for IT/Security testing.

**Q: My session expired before 8 hours. Why?**
A: The idle timeout (enforced by `src/hooks/use-idle-timeout.ts`) may have triggered. The idle timeout is shorter than the 8-hour session maxAge — check the user settings. Refreshing the page resets the idle timer.

**Q: The dev-mode bypass lets me access endpoints without logging in. Is that safe?**
A: Only in dev mode (`NODE_ENV=development`) and only on `authGuard`-protected endpoints. The `withRBAC` middleware always requires headers. The CI scripts `check-audit.ts` and `check-rbac-dev-bypass.ts` enforce this invariant — they fail CI if the dev bypass is removed from its gate or if a bypass is added to `withRBAC`. In production (`NODE_ENV=production`), the dev bypass is disabled entirely.

**Q: Can I use these credentials in production?**
A: **NO.** These are UAT-only credentials seeded by `prisma/seed-uat.ts`. They do not exist in the production database. Production credentials are managed through a separate, access-controlled secret store. See §6.2 of `UAT_KICKOFF_BRIEF.md`.

---

**UAT Access Credentials — End of Document**
