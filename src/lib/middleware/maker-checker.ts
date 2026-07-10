import { db } from '@/lib/db';

export type OperationType =
  | "KYC_HIGH_RISK_APPROVAL"
  | "GOAML_SUBMIT"
  | "SANCTIONS_CLEARANCE_OVERRIDE"
  | "EMERGENCY_REVOKE"; // Pre-UAT Polish Fix #3: Emergency access revocation

/**
 * Initiate a Maker-Checker approval request for a critical compliance operation.
 * Critical operations (GOAML_SUBMIT, KYC_HIGH_RISK_APPROVAL) expire in 4 hours;
 * all others expire in 24 hours.
 */
export async function initiateMakerChecker(
  operationType: OperationType,
  entityId: string,
  entityType: string,
  makerId: string,
  makerName: string,
  payloadSnapshot: Record<string, unknown>
) {
  const isCritical =
    operationType === "GOAML_SUBMIT" ||
    operationType === "KYC_HIGH_RISK_APPROVAL" ||
    operationType === "EMERGENCY_REVOKE";

  const expiryHours = isCritical ? 4 : 24;
  const expiryTime = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

  return await db.makerCheckerLog.create({
    data: {
      operationType,
      entityId,
      entityType,
      makerId,
      makerName,
      status: "PENDING",
      expiryTime,
      payloadSnapshot: JSON.stringify(payloadSnapshot),
    },
  });
}

/**
 * Review a Maker-Checker request — approve or reject.
 * Enforces the 4-eyes principle: the checker cannot be the same person as the maker.
 * Expired requests are automatically marked and rejected.
 */
export async function reviewMakerChecker(
  logId: string,
  checkerId: string,
  checkerName: string,
  action: "APPROVED" | "REJECTED"
) {
  const log = await db.makerCheckerLog.findUnique({ where: { id: logId } });

  if (!log) {
    throw new Error("Maker-Checker log not found");
  }

  if (log.status !== "PENDING") {
    throw new Error(
      `Log already processed with status: ${log.status}. Only PENDING requests can be reviewed.`
    );
  }

  if (new Date() > log.expiryTime) {
    await db.makerCheckerLog.update({
      where: { id: logId },
      data: { status: "EXPIRED" },
    });
    throw new Error(
      "Approval request has expired. The maker must resubmit the request."
    );
  }

  if (log.makerId === checkerId) {
    throw new Error(
      "Maker and Checker cannot be the same person (4-eyes principle violation)."
    );
  }

  return await db.makerCheckerLog.update({
    where: { id: logId },
    data: {
      checkerId,
      checkerName,
      status: action,
      reviewedAt: new Date(),
    },
  });
}
