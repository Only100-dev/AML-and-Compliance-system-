import { db } from '@/lib/db';
import crypto from 'crypto';

/**
 * UniversalTask — Unified "My Tasks" inbox backing store.
 *
 * Architectural Directive (P1 Step 1): The frontend "My Tasks" inbox MUST NOT
 * query 6 different entity APIs on a loop. Every backend assignment trigger
 * writes a single denormalized row into `UniversalTask`. The inbox then runs
 * ONE indexed query: `WHERE assignedToId=? AND status IN (OPEN,IN_PROGRESS)`
 * sorted by `dueDate ASC` — sub-200ms, zero N+1 joins.
 *
 * This module is the SINGLE integration point. All four P1 trigger surfaces
 * (CAP, Audit Finding, Policy Attestation, Dept-Head Circular) call these
 * helpers. Adding a new trigger surface = one function call in the relevant
 * API route. No frontend changes required.
 *
 * v7.3.0-RC1-uat-ready FIX (Blocker 2):
 *   Prior to this fix, the helper used `entityType`/`entityId` field names
 *   but the Prisma `UniversalTask` model has `taskType`/`sourceId`/
 *   `sourceEntityType` — so every call would have crashed with a Prisma
 *   validation error. The helper had ZERO callers in src/ as a result
 *   (every flow that needed an inbox row wrote to `db.universalTask.create`
 *   directly, bypassing the helper). This fix aligns the helper's input
 *   field names with the DB column names AND wires the helper into the
 *   CAP / Policy-Attestation / Dept-Head-Circular routes so those flows
 *   surface tasks in the unified inbox (verified by
 *   scripts/verify-universal-task-helper.mjs).
 *
 * Conventions (matching createAuditLog):
 *   - NEVER throw — failures are logged to stderr and swallowed so the caller's
 *     primary operation (e.g. creating a CAP) is never broken by an inbox bug.
 *   - Idempotent on (taskType, sourceId, status IN (OPEN,IN_PROGRESS)): if an
 *     active task already exists for the same source, we skip the insert
 *     rather than creating duplicates. (The model's @@unique([taskType,
 *     sourceId]) constraint also enforces this at the DB level.)
 */

export type UniversalTaskType =
  | 'ALERT'
  | 'COMPLAINT'
  | 'CAP'
  | 'SAR'
  | 'MAKER_CHECKER'
  | 'POLICY_ATTESTATION'
  | 'CIRCULAR_ACK';

export type UniversalTaskStatus =
  | 'OPEN'
  | 'IN_PROGRESS'
  | 'DONE'
  | 'CANCELLED';

export type UniversalTaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface CreateUniversalTaskInput {
  /** DB column `taskType` — ALERT | COMPLAINT | CAP | SAR | MAKER_CHECKER | POLICY_ATTESTATION | CIRCULAR_ACK */
  taskType: UniversalTaskType;
  /** DB column `sourceId` — FK to the source record (e.g. CorrectiveActionPlan.id) */
  sourceId: string;
  /** DB column `sourceEntityType` — the Prisma model name of the source (e.g. 'CorrectiveActionPlan') */
  sourceEntityType: string;
  /** DB column `sourceModule` — COMPLIANCE_ALERTS | COMPLAINTS | CAP | SAR | MAKER_CHECKER | POLICY_ATTESTATION | DEPT_ACKNOWLEDGMENT */
  sourceModule: string;
  title: string;
  description?: string;
  /** null = unassigned/pool (optional) */
  assignedToId?: string;
  assignedToName?: string;
  status?: UniversalTaskStatus;
  priority?: UniversalTaskPriority;
  dueDate?: Date;
  /** if true, the task cannot be cancelled from the inbox (e.g. SLA alerts) */
  isImmutable?: boolean;
}

/**
 * Insert a UniversalTask row. Idempotent: if an OPEN/IN_PROGRESS task already
 * exists for the same (taskType, sourceId), the existing row is returned
 * unchanged — no duplicate is created. The model's @@unique([taskType,
 * sourceId]) constraint also enforces this at the DB level.
 *
 * Non-blocking: errors are logged and swallowed. Returns the task row (or null
 * on failure) so callers MAY use the result, but never MUST.
 */
export async function createUniversalTask(
  input: CreateUniversalTaskInput
): Promise<{ id: string; status: string } | null> {
  try {
    // Idempotency: skip if an active task already exists for this source.
    const existing = await db.universalTask.findFirst({
      where: {
        taskType: input.taskType,
        sourceId: input.sourceId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      select: { id: true, status: true },
    });
    if (existing) return existing;

    // Compute a tamper-evidence hash for the task row. This chains the task
    // back to its source for regulatory audit purposes (model has `sha256Hash`
    // column for this). The hash covers the immutable identity fields.
    const hashPayload = JSON.stringify({
      taskType: input.taskType,
      sourceId: input.sourceId,
      sourceEntityType: input.sourceEntityType,
      title: input.title,
      assignedToId: input.assignedToId ?? null,
      dueDate: input.dueDate ? input.dueDate.toISOString() : null,
      sourceModule: input.sourceModule,
      createdAt: new Date().toISOString(),
    });
    const sha256Hash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    const task = await db.universalTask.create({
      data: {
        taskType: input.taskType,
        sourceId: input.sourceId,
        sourceEntityType: input.sourceEntityType,
        title: input.title,
        description: input.description ?? null,
        assignedToId: input.assignedToId ?? null,
        assignedToName: input.assignedToName ?? null,
        status: input.status ?? 'OPEN',
        priority: input.priority ?? 'MEDIUM',
        dueDate: input.dueDate ?? null,
        sourceModule: input.sourceModule,
        isImmutable: input.isImmutable ?? false,
        sha256Hash,
      },
      select: { id: true, status: true },
    });
    return task;
  } catch (err) {
    console.error('[universal-task] createUniversalTask failed:', err);
    return null;
  }
}

/**
 * Mark all OPEN/IN_PROGRESS UniversalTask rows for a given source entity as
 * DONE. Called when the underlying entity reaches a terminal state
 * (e.g. CAP → REMEDIATED/AUDIT_VERIFIED, Attestation → acknowledged,
 * CircularAcknowledgment → acknowledged).
 *
 * Optionally filter by `assignedToId` to complete only the specific assignee's
 * task (useful when an entity has multiple assignees and only one completed).
 */
export async function completeUniversalTask(opts: {
  taskType: UniversalTaskType;
  sourceId: string;
  assignedToId?: string;
}): Promise<number> {
  try {
    const result = await db.universalTask.updateMany({
      where: {
        taskType: opts.taskType,
        sourceId: opts.sourceId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
        ...(opts.assignedToId ? { assignedToId: opts.assignedToId } : {}),
      },
      data: {
        status: 'DONE',
      },
    });
    return result.count;
  } catch (err) {
    console.error('[universal-task] completeUniversalTask failed:', err);
    return 0;
  }
}

/**
 * Cancel all OPEN/IN_PROGRESS tasks for a source entity (e.g. when a CAP is
 * deleted, or an attestation is revoked). Distinct from `complete` so the
 * inbox can render a "cancelled" visual state if desired.
 */
export async function cancelUniversalTasks(opts: {
  taskType: UniversalTaskType;
  sourceId: string;
}): Promise<number> {
  try {
    const result = await db.universalTask.updateMany({
      where: {
        taskType: opts.taskType,
        sourceId: opts.sourceId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      data: { status: 'CANCELLED' },
    });
    return result.count;
  } catch (err) {
    console.error('[universal-task] cancelUniversalTasks failed:', err);
    return 0;
  }
}

/**
 * Reassign all OPEN/IN_PROGRESS tasks for a source entity to a new user.
 * Called when an entity's `assignedToId` is updated.
 */
export async function reassignUniversalTask(opts: {
  taskType: UniversalTaskType;
  sourceId: string;
  newAssignedToId: string;
  newAssignedToName?: string;
}): Promise<number> {
  try {
    const result = await db.universalTask.updateMany({
      where: {
        taskType: opts.taskType,
        sourceId: opts.sourceId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
      data: {
        assignedToId: opts.newAssignedToId,
        assignedToName: opts.newAssignedToName ?? null,
      },
    });
    return result.count;
  } catch (err) {
    console.error('[universal-task] reassignUniversalTask failed:', err);
    return 0;
  }
}
