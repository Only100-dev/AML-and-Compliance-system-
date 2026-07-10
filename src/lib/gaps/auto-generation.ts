/**
 * Phase 5: Gap Auto-Generation Engine
 * PRINCIPLE A: Proactive > Reactive — auto-generation triggers on regulatory changes,
 * control failures, and audit findings.
 */

import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit';
import { addBusinessDaysGCC } from '@/lib/fiu/business-days-gcc';
import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';
import type { GapDetectedBy, GapSeverity, GapTheme, SystemicGapDetectionResult } from './types';
import { GAP_SEVERITY_CONFIG } from './types';
import { getAssignmentForTheme } from './assignment-engine';

export type AutoGenerationTrigger = 
  | 'regulatory_change'
  | 'control_failure'
  | 'audit_finding'
  | 'missing_control';

export interface AutoGenerationInput {
  jurisdictionId: GCCJurisdictionCode;
  theme: GapTheme;
  title: string;
  description: string;
  severity: GapSeverity;
  trigger: AutoGenerationTrigger;
  triggerMetadata?: Record<string, unknown>;
  controlId?: string;
}

/**
 * Auto-generate a compliance gap from a trigger event.
 * 
 * Steps:
 * 1. Create the Gap record with auto-assigned owner and calculated due date
 * 2. Check for systemic gaps (same issue in other jurisdictions)
 * 3. If systemic, link related gaps and alert Group MLRO
 * 4. Log to WORM Audit Trail (domain: 'GOVERNANCE')
 */
export async function autoGenerateGap(input: AutoGenerationInput): Promise<{
  gapId: string;
  isSystemic: boolean;
  relatedGapIds: string[];
  affectedJurisdictions: GCCJurisdictionCode[];
}> {
  // 1. Get auto-assignment for this theme/jurisdiction
  const assignment = getAssignmentForTheme(input.theme, input.jurisdictionId);

  // 2. Calculate due date based on severity
  const dueDate = calculateDueDate(input.severity, input.jurisdictionId);

  // 3. Create the gap record
  const gap = await db.gap.create({
    data: {
      jurisdictionId: input.jurisdictionId,
      controlId: input.controlId,
      theme: input.theme,
      title: input.title,
      description: input.description,
      severity: input.severity,
      status: 'Open',
      detectedBy: mapTriggerToDetectedBy(input.trigger),
      detectionTrigger: input.triggerMetadata ? JSON.stringify(input.triggerMetadata) : null,
      ownerId: assignment.ownerId,
      ownerName: assignment.ownerName,
      ownerRole: assignment.ownerRole,
      dueDate,
      isSystemic: false,
      relatedGapIds: null,
      evidence: null,
      escalationLevel: 0,
    },
  });

  // 4. Check for systemic gaps
  const systemicResult = await detectSystemicGap({
    theme: input.theme,
    title: input.title,
    jurisdictionId: input.jurisdictionId,
    excludeGapId: gap.id,
  });

  // 5. If systemic, update all related gaps
  if (systemicResult.isSystemic) {
    const allRelatedIds = [...systemicResult.relatedGapIds, gap.id];
    
    // Update all gaps as systemic
    await Promise.all([
      db.gap.update({
        where: { id: gap.id },
        data: {
          isSystemic: true,
          relatedGapIds: JSON.stringify(allRelatedIds),
        },
      }),
      ...systemicResult.relatedGapIds.map(relatedId =>
        db.gap.update({
          where: { id: relatedId },
          data: {
            isSystemic: true,
            relatedGapIds: JSON.stringify(allRelatedIds),
          },
        })
      ),
    ]);

    // Alert Group MLRO about systemic gap
    await createAuditLog({
      userId: 'system',
      action: 'SYSTEMIC_GAP_DETECTED',
      resourceType: 'Gap',
      resourceId: gap.id,
      details: `Systemic compliance gap detected: "${input.title}" affects ${systemicResult.affectedJurisdictions.length + 1} jurisdictions (${[input.jurisdictionId, ...systemicResult.affectedJurisdictions].join(', ')}). Theme: ${input.theme}. Severity: ${input.severity}.`,
    });
  }

  // 6. Log gap creation to WORM Audit Trail
  await createAuditLog({
    userId: assignment.ownerId || 'system',
    action: 'GAP_AUTO_GENERATED',
    resourceType: 'Gap',
    resourceId: gap.id,
    details: `Auto-generated compliance gap: "${input.title}" in ${input.jurisdictionId}. Trigger: ${input.trigger}. Severity: ${input.severity}. Assigned to: ${assignment.ownerName || 'Unassigned'}. Due: ${dueDate.toISOString().split('T')[0]}.`,
  });

  return {
    gapId: gap.id,
    isSystemic: systemicResult.isSystemic,
    relatedGapIds: systemicResult.isSystemic ? [...systemicResult.relatedGapIds, gap.id] : [],
    affectedJurisdictions: systemicResult.affectedJurisdictions,
  };
}

/**
 * Detect if this gap is systemic (exists in other jurisdictions).
 * 
 * PRINCIPLE D: Cross-region intelligence. Systemic gaps (same issue in
 * multiple countries) are flagged at the group level.
 */
export async function detectSystemicGap(params: {
  theme: GapTheme;
  title: string;
  jurisdictionId: GCCJurisdictionCode;
  excludeGapId: string;
}): Promise<SystemicGapDetectionResult> {
  // Search for similar gaps in other jurisdictions
  // Use fuzzy matching on title + exact theme match
  const searchTerms = params.title.toLowerCase().split(' ').filter(w => w.length > 3);
  
  const otherGaps = await db.gap.findMany({
    where: {
      theme: params.theme,
      jurisdictionId: { not: params.jurisdictionId },
      status: { not: 'Closed' },
      id: { not: params.excludeGapId },
    },
  });

  // Simple fuzzy matching: check if key words overlap
  const relatedGaps = otherGaps.filter(gap => {
    const gapTitle = gap.title.toLowerCase();
    const matchCount = searchTerms.filter(term => gapTitle.includes(term)).length;
    return matchCount >= Math.ceil(searchTerms.length * 0.5); // At least 50% term overlap
  });

  if (relatedGaps.length > 0) {
    return {
      isSystemic: true,
      relatedGapIds: relatedGaps.map(g => g.id),
      affectedJurisdictions: [...new Set(relatedGaps.map(g => g.jurisdictionId as GCCJurisdictionCode))],
    };
  }

  return {
    isSystemic: false,
    relatedGapIds: [],
    affectedJurisdictions: [],
  };
}

/**
 * Calculate due date based on severity and jurisdiction.
 * Uses addBusinessDaysGCC() from Phase 4.
 */
function calculateDueDate(severity: GapSeverity, jurisdictionId: GCCJurisdictionCode): Date {
  const config = GAP_SEVERITY_CONFIG[severity];
  // All gap remediation uses business days (GCC weekends: Fri-Sat)
  return addBusinessDaysGCC(new Date(), config.remediationDays, jurisdictionId);
}

function mapTriggerToDetectedBy(trigger: AutoGenerationTrigger): GapDetectedBy {
  const map: Record<AutoGenerationTrigger, GapDetectedBy> = {
    regulatory_change: 'regulatory_change',
    control_failure: 'system',
    audit_finding: 'audit',
    missing_control: 'system',
  };
  return map[trigger];
}

/**
 * Escalate overdue gaps.
 * Called by the daily cron job.
 * 
 * PRINCIPLE C: Overdue gaps auto-escalate.
 */
export async function escalateOverdueGaps(): Promise<{
  escalated: number;
  errors: string[];
}> {
  const now = new Date();
  let escalated = 0;
  const errors: string[] = [];

  // Find all overdue gaps that are not Closed or already at max escalation
  const overdueGaps = await db.gap.findMany({
    where: {
      dueDate: { lt: now },
      status: { notIn: ['Closed'] },
      escalationLevel: { lt: 3 }, // Max escalation is 3
    },
  });

  for (const gap of overdueGaps) {
    try {
      const newLevel = gap.escalationLevel + 1;
      const newStatus = 'Escalated';

      await db.gap.update({
        where: { id: gap.id },
        data: {
          status: newStatus,
          escalationLevel: newLevel,
          updatedAt: new Date(),
        },
      });

      // Log escalation
      await createAuditLog({
        userId: 'system',
        action: 'GAP_ESCALATED',
        resourceType: 'Gap',
        resourceId: gap.id,
        details: `Gap "${gap.title}" escalated to level ${newLevel} in ${gap.jurisdictionId}. Due date was ${new Date(gap.dueDate!).toISOString().split('T')[0]}. Owner: ${gap.ownerName || 'Unassigned'}.`,
      });

      escalated++;
    } catch (err) {
      errors.push(`Failed to escalate gap ${gap.id}: ${err}`);
    }
  }

  return { escalated, errors };
}
