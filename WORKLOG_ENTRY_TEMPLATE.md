# IC-OS Worklog Entry Template

> **MANDATORY for all agents.** Append (do NOT overwrite) to `/home/z/my-project/worklog.md`.
> Introduced by Prevention Measure 2.4 after the P2 commit ec4c992 silently
> reverted the P1 sprint without any worklog acknowledgement (13-hour
> undetected regression). The **Regressions** section is now mandatory —
> "none" is a valid answer, silence is not.

---

## How to append a worklog entry

1. Read the LAST ~120 lines of `worklog.md` first to understand prior context
   (do not read the whole file — it is large).
2. Append your entry at the END of the file.
3. Each entry MUST start with a line containing exactly `---`.
4. Use the template below verbatim (fill in the placeholders).

## Template

```markdown
---
Task ID: <e.g. BATCH-1, PREVENT-2.1, GAP-DEEP-DIVE — matches the orchestrator's assignment>
Agent: <your agent name / role>
Task: <one-line description of what you were asked to do>

Work Log:
- <concrete step 1 — what you read, ran, or changed>
- <concrete step 2>
- <concrete step 3>
- <...>

Stage Summary:
- <key results — files created/modified, tags applied, tests run, decisions made>
- <restore point tag (if any)>
- <verification status (lint / audit / browser)>

Regressions:
- <If this work reverted, disabled, or deleted any existing functionality,
   list it here with justification. "None" is a valid answer. Silence is NOT.>
```

## Rules

1. **Append-only.** Never edit or delete a prior entry. If a prior entry is
   wrong, add a new correcting entry that references it.
2. **The `---` separator is sacred.** Every entry starts with `---` on its
   own line. This is how `grep -n '^---'` can count entries.
3. **The Regressions section is mandatory.** Even if you made no code changes
   (read-only investigation), write `Regressions: None (read-only)`.
4. **Task IDs are global.** Reuse the Task ID the orchestrator assigned you.
   If you spawned sub-tasks, suffix them (e.g. `BATCH-2-a`, `BATCH-2-b`).
5. **Be concrete.** "Fixed the bug" is useless. "Replaced `db.auditLog.create()`
   with `createAuditLog()` at src/app/api/cbuae-submission-checker/route.ts:513"
   is useful.
6. **Tag discipline.** If you applied a git tag, name it explicitly in the
   Stage Summary. Local tags may be force-moved; never force-move a pushed tag.
