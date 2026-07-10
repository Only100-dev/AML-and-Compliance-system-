/**
 * P2 Step 1 — Complaint State Machine.
 *
 * Strict, guarded transitions per CBUAE consumer-protection regulations.
 *
 *   NEW → ACKNOWLEDGED → INVESTIGATING → RESOLVED → CLOSED
 *                                          ↘ ESCALATED_TO_OMBUDSMAN
 *
 * Guards:
 *   * → RESOLVED              : resolutionNotes must be non-empty.
 *   * → ESCALATED_TO_OMBUDSMAN: escalationReason must be non-empty.
 *   RESOLVED → CLOSED         : terminal ack (sets closedAt).
 *   CLOSED                    : terminal — no further transitions.
 *   ESCALATED_TO_OMBUDSMAN    : terminal — no further transitions (regulator owns it).
 */

export type ComplaintStatus =
  | 'NEW'
  | 'ACKNOWLEDGED'
  | 'INVESTIGATING'
  | 'RESOLVED'
  | 'CLOSED'
  | 'ESCALATED_TO_OMBUDSMAN';

export const COMPLAINT_STATUSES: ComplaintStatus[] = [
  'NEW',
  'ACKNOWLEDGED',
  'INVESTIGATING',
  'RESOLVED',
  'CLOSED',
  'ESCALATED_TO_OMBUDSMAN',
];

/** Allowed forward transitions. Terminal states map to empty arrays. */
export const VALID_COMPLAINT_TRANSITIONS: Record<ComplaintStatus, ComplaintStatus[]> = {
  NEW: ['ACKNOWLEDGED', 'INVESTIGATING', 'ESCALATED_TO_OMBUDSMAN'],
  ACKNOWLEDGED: ['INVESTIGATING', 'RESOLVED', 'ESCALATED_TO_OMBUDSMAN'],
  INVESTIGATING: ['RESOLVED', 'ESCALATED_TO_OMBUDSMAN'],
  RESOLVED: ['CLOSED', 'ESCALATED_TO_OMBUDSMAN'],
  CLOSED: [],
  ESCALATED_TO_OMBUDSMAN: [],
};

export interface TransitionGuardResult {
  ok: boolean;
  code?: string;
  message?: string;
}

/**
 * Validate a proposed status transition including field guards.
 */
export function validateComplaintTransition(
  fromStatus: string,
  toStatus: string,
  fields: { resolutionNotes?: string | null; escalationReason?: string | null },
): TransitionGuardResult {
  const from = fromStatus as ComplaintStatus;
  const to = toStatus as ComplaintStatus;

  if (!COMPLAINT_STATUSES.includes(to)) {
    return {
      ok: false,
      code: 'INVALID_STATUS',
      message: `Unknown target status "${toStatus}". Valid: ${COMPLAINT_STATUSES.join(', ')}`,
    };
  }

  if (from === to) {
    return { ok: false, code: 'NO_OP', message: 'Status unchanged.' };
  }

  const allowed = VALID_COMPLAINT_TRANSITIONS[from] ?? [];
  if (!allowed.includes(to)) {
    return {
      ok: false,
      code: 'INVALID_TRANSITION',
      message: `Forbidden transition: ${from} → ${to}. Allowed from ${from}: ${allowed.length ? allowed.join(', ') : 'none (terminal state)'}.`,
    };
  }

  // Field guards
  if (to === 'RESOLVED' && (!fields.resolutionNotes || fields.resolutionNotes.trim().length === 0)) {
    return {
      ok: false,
      code: 'RESOLUTION_NOTES_REQUIRED',
      message: 'Cannot transition to RESOLVED without resolutionNotes. (CBUAE consumer-protection requirement.)',
    };
  }

  if (to === 'ESCALATED_TO_OMBUDSMAN' && (!fields.escalationReason || fields.escalationReason.trim().length === 0)) {
    return {
      ok: false,
      code: 'ESCALATION_REASON_REQUIRED',
      message: 'Cannot escalate to the Ombudsman without an escalationReason.',
    };
  }

  return { ok: true };
}
