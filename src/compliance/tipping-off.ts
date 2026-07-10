/**
 * IC-OS Tipping-Off Prohibition System
 * Phase 1 Regulatory Critical Enhancement
 *
 * Implements the tipping-off prohibition per FDL 10/2025 Art. 12
 * and CR 134/2025 Art. 17.
 *
 * "Tipping-off" is the act of disclosing to the subject of a SAR (or any
 * third party) that a report has been or will be filed with the FIU, or
 * that an investigation is being or may be carried out. This constitutes
 * a criminal offence under UAE law.
 *
 * Key features:
 *   - Full legal warning text constant
 *   - Risk analysis of alert/SAR data for tipping-off indicators
 *   - Action validation against tipping-off prohibition
 *   - SAR confidentiality level enforcement
 *   - Risk indicator detection engine
 */

import { z } from 'zod';
import { getTippingOffWarning } from './regulatory-refs';

// ─── SAR Confidentiality Levels ─────────────────────────────────────────────────

export type SARConfidentialityLevel = 'CONFIDENTIAL' | 'RESTRICTED' | 'SECRET';

export const SAR_CONFIDENTIALITY_LEVELS: Record<SARConfidentialityLevel, {
  label: string;
  description: string;
  accessRoles: string[];
  handlingRequirements: string[];
}> = {
  CONFIDENTIAL: {
    label: 'CONFIDENTIAL',
    description: 'Standard SAR confidentiality. Access limited to MLRO, compliance team, and authorised personnel only.',
    accessRoles: ['mlro', 'compliance_manager', 'compliance_officer', 'admin'],
    handlingRequirements: [
      'Store in encrypted repository only',
      'Do not discuss in open office areas',
      'Access logged with full audit trail',
      'Must not be included in general correspondence',
    ],
  },
  RESTRICTED: {
    label: 'RESTRICTED',
    description: 'Heightened confidentiality for SARs involving PEPs, significant sums, or ongoing investigations. Access limited to MLRO and senior compliance only.',
    accessRoles: ['mlro', 'compliance_manager', 'admin'],
    handlingRequirements: [
      'All CONFIDENTIAL requirements apply',
      'Additional access approval required per view',
      'No printed copies without MLRO authorisation',
      'Discussion only in secure, access-controlled environments',
      'Mandatory read-receipt and time-limited access',
    ],
  },
  SECRET: {
    label: 'SECRET',
    description: 'Maximum confidentiality for SARs involving national security, terrorism financing, or active law enforcement cooperation. Access limited to MLRO and board only.',
    accessRoles: ['mlro', 'admin'],
    handlingRequirements: [
      'All RESTRICTED requirements apply',
      'Access requires dual-authorisation (MLRO + one other)',
      'Digital watermarking on all documents',
      'No external transmission without MLRO and legal counsel approval',
      'Mandatory destruction schedule for physical copies',
      'Breach notification within 1 hour to MLRO',
    ],
  },
};

// ─── Tipping-Off Warning ────────────────────────────────────────────────────────

/**
 * Full legal warning text for the tipping-off prohibition.
 * Must be displayed whenever a user accesses SAR-related data
 * or attempts an action that could constitute tipping-off.
 */
export const TIPPING_OFF_WARNING: string = getTippingOffWarning();

// ─── Tipping-Off Risk Indicators ────────────────────────────────────────────────

export type TippingOffRiskLevel = 'none' | 'low' | 'medium' | 'high' | 'critical';

export interface TippingOffRiskIndicator {
  id: string;
  category: 'communication' | 'system_action' | 'data_access' | 'workflow' | 'document';
  description: string;
  riskLevel: TippingOffRiskLevel;
  regulatoryRef: string;
  detectionRule: string;
}

/**
 * Comprehensive list of tipping-off risk indicators.
 * These patterns help detect actions that could constitute or facilitate tipping-off.
 */
export const TIPPING_OFF_RISK_INDICATORS: TippingOffRiskIndicator[] = [
  {
    id: 'TIP-001',
    category: 'communication',
    description: 'User attempts to send communication (email, letter, SMS) to the SAR subject or their representative',
    riskLevel: 'critical',
    regulatoryRef: 'FDL 10/2025 Art. 12; CR 134/2025 Art. 17',
    detectionRule: 'action=SEND_COMMUNICATION AND data.recipient MATCHES sar.subject',
  },
  {
    id: 'TIP-002',
    category: 'communication',
    description: 'User attempts to notify the SAR subject that their account is under review',
    riskLevel: 'critical',
    regulatoryRef: 'FDL 10/2025 Art. 12; CR 134/2025 Art. 17',
    detectionRule: 'action=NOTIFY AND data.subjectId MATCHES sar.subjectId AND data.reason CONTAINS "review|investigation|SAR"',
  },
  {
    id: 'TIP-003',
    category: 'workflow',
    description: 'User attempts to close an account while a SAR is pending or under investigation without MLRO approval',
    riskLevel: 'high',
    regulatoryRef: 'FDL 10/2025 Art. 12; CBUAE Notice 3551/2021 S6.2',
    detectionRule: 'action=CLOSE_ACCOUNT AND linkedSAR.status IN [DRAFT, PENDING_REVIEW, APPROVED_FOR_FILING]',
  },
  {
    id: 'TIP-004',
    category: 'data_access',
    description: 'Non-compliance user accesses SAR case file without legitimate business need',
    riskLevel: 'high',
    regulatoryRef: 'FDL 10/2025 Art. 12; CR 134/2025 Art. 17',
    detectionRule: 'action=VIEW_SAR AND user.role NOT IN [mlro, compliance_manager, compliance_officer, admin]',
  },
  {
    id: 'TIP-005',
    category: 'document',
    description: 'User attempts to include SAR reference or details in customer-facing correspondence',
    riskLevel: 'critical',
    regulatoryRef: 'FDL 10/2025 Art. 12; CR 134/2025 Art. 17',
    detectionRule: 'action=CREATE_DOCUMENT AND data.recipientType=customer AND data.content CONTAINS sarKeywords',
  },
  {
    id: 'TIP-006',
    category: 'system_action',
    description: 'User attempts to export or download SAR data to an unsecured location',
    riskLevel: 'high',
    regulatoryRef: 'FDL 10/2025 Art. 11; CR 134/2025 Art. 16',
    detectionRule: 'action=EXPORT AND data.entityType=SAR AND data.destination NOT IN approvedLocations',
  },
  {
    id: 'TIP-007',
    category: 'communication',
    description: 'User discusses SAR filing status with front-office or business-line personnel not involved in the case',
    riskLevel: 'high',
    regulatoryRef: 'FDL 10/2025 Art. 12; CR 134/2025 Art. 17',
    detectionRule: 'action=SHARE_INFO AND data.infoType=SAR AND data.recipientRole NOT IN [mlro, compliance_manager, compliance_officer, admin]',
  },
  {
    id: 'TIP-008',
    category: 'workflow',
    description: 'Transaction is blocked or refused specifically because of SAR filing, potentially alerting the subject',
    riskLevel: 'medium',
    regulatoryRef: 'FDL 10/2025 Art. 12; CBUAE Notice 3551/2021 S6.2',
    detectionRule: 'action=BLOCK_TRANSACTION AND data.reason CONTAINS "SAR|suspicious|investigation"',
  },
  {
    id: 'TIP-009',
    category: 'data_access',
    description: 'User with SAR access shares screen or copies data in presence of unauthorised persons',
    riskLevel: 'medium',
    regulatoryRef: 'FDL 10/2025 Art. 12; CR 134/2025 Art. 17',
    detectionRule: 'action=SCREEN_SHARE AND data.contentContains=sarKeywords AND data.viewerCount > authorisedViewers',
  },
  {
    id: 'TIP-010',
    category: 'document',
    description: 'Enhanced due diligence request to the customer references the SAR or suspicious activity',
    riskLevel: 'critical',
    regulatoryRef: 'FDL 10/2025 Art. 12; CR 134/2025 Art. 17',
    detectionRule: 'action=REQUEST_EDD AND data.customerId MATCHES sar.subjectId AND data.requestText CONTAINS sarKeywords',
  },
];

// ─── Zod Schemas ────────────────────────────────────────────────────────────────

export const TippingOffCheckSchema = z.object({
  action: z.string().min(1),
  targetType: z.enum(['alert', 'sar', 'kyc', 'sanctions', 'case', 'general']),
  targetId: z.string().min(1),
  userId: z.string().min(1),
  userRole: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
  linkedSARIds: z.array(z.string()).optional(),
  subjectId: z.string().optional(),
  recipientId: z.string().optional(),
  recipientType: z.enum(['subject', 'representative', 'internal', 'external', 'regulatory', 'other']).optional(),
  communicationMethod: z.enum(['email', 'letter', 'sms', 'phone', 'in_person', 'system']).optional(),
});

export type TippingOffCheck = z.infer<typeof TippingOffCheckSchema>;

// ─── Risk Analysis ──────────────────────────────────────────────────────────────

export interface TippingOffRiskAssessment {
  riskLevel: TippingOffRiskLevel;
  indicators: TippingOffRiskIndicator[];
  warnings: string[];
  blocked: boolean;
  blockReason?: string;
  regulatoryRefs: string[];
  recommendedActions: string[];
}

/**
 * Analyze alert/SAR data for tipping-off risks.
 * This is the primary risk detection function that should be called
 * before any action involving SAR-related data.
 */
export function checkTippingOffRisk(check: TippingOffCheck): TippingOffRiskAssessment {
  const result: TippingOffRiskAssessment = {
    riskLevel: 'none',
    indicators: [],
    warnings: [],
    blocked: false,
    regulatoryRefs: [],
    recommendedActions: [],
  };

  // ── Rule 1: Communication to SAR subject ──────────────────────────────────
  if (
    check.recipientId &&
    check.recipientType &&
    (check.recipientType === 'subject' || check.recipientType === 'representative') &&
    (check.targetType === 'sar' || check.targetType === 'alert') &&
    check.recipientId === check.subjectId
  ) {
    const indicator = TIPPING_OFF_RISK_INDICATORS.find((i) => i.id === 'TIP-001')!;
    result.indicators.push(indicator);
    result.riskLevel = 'critical';
    result.blocked = true;
    result.blockReason =
      `CRITICAL: Attempting to communicate with the SAR subject (${check.recipientId}) ` +
      `constitutes tipping-off per FDL 10/2025 Art. 12. This action is BLOCKED.`;
    result.regulatoryRefs.push('FDL 10/2025 Art. 12', 'CR 134/2025 Art. 17');
    result.recommendedActions.push(
      'Do NOT contact the SAR subject or their representative',
      'Report this attempt to the MLRO immediately',
      'Document the incident in the compliance case file'
    );
  }

  // ── Rule 2: Notification to subject about review/investigation ────────────
  if (
    check.action.toUpperCase().includes('NOTIFY') &&
    check.recipientId === check.subjectId &&
    check.data
  ) {
    const reasonStr = String(check.data.reason ?? check.data.message ?? '').toLowerCase();
    const tippingKeywords = ['review', 'investigation', 'sar', 'suspicious', 'report', 'fiu', 'compliance'];
    const hasTippingKeyword = tippingKeywords.some((kw) => reasonStr.includes(kw));

    if (hasTippingKeyword) {
      const indicator = TIPPING_OFF_RISK_INDICATORS.find((i) => i.id === 'TIP-002')!;
      result.indicators.push(indicator);
      result.riskLevel = 'critical';
      result.blocked = true;
      result.blockReason =
        `CRITICAL: Notification to SAR subject contains tipping-off language. ` +
        `This action is BLOCKED per FDL 10/2025 Art. 12.`;
      result.regulatoryRefs.push('FDL 10/2025 Art. 12', 'CR 134/2025 Art. 17');
      result.recommendedActions.push(
        'Remove all references to SAR, investigation, or suspicious activity from the communication',
        'If the communication is required for business purposes, use neutral language that does not reference the SAR'
      );
    }
  }

  // ── Rule 3: Closing account linked to pending SAR ─────────────────────────
  if (
    check.action.toUpperCase().includes('CLOSE') &&
    check.action.toUpperCase().includes('ACCOUNT') &&
    check.linkedSARIds &&
    check.linkedSARIds.length > 0
  ) {
    const indicator = TIPPING_OFF_RISK_INDICATORS.find((i) => i.id === 'TIP-003')!;
    result.indicators.push(indicator);
    result.riskLevel = escalateRisk(result.riskLevel, 'high');
    result.warnings.push(
      `Account closure while SAR is pending may alert the subject. ` +
      `MLRO approval required before proceeding. ` +
      `(${check.linkedSARIds.length} linked SAR(s): ${check.linkedSARIds.join(', ')})`
    );
    result.regulatoryRefs.push('FDL 10/2025 Art. 12', 'CBUAE Notice 3551/2021 S6.2');
    result.recommendedActions.push(
      'Obtain MLRO written approval before closing the account',
      'Consider whether the account closure would alert the subject to the SAR filing',
      'If closure is required by other regulations, document the necessity and MLRO approval'
    );
  }

  // ── Rule 4: Non-compliance user accessing SAR ─────────────────────────────
  const complianceRoles = ['mlro', 'compliance_manager', 'compliance_officer', 'admin'];
  if (
    (check.targetType === 'sar' || check.targetType === 'alert') &&
    !complianceRoles.includes(check.userRole.toLowerCase())
  ) {
    const indicator = TIPPING_OFF_RISK_INDICATORS.find((i) => i.id === 'TIP-004')!;
    result.indicators.push(indicator);
    result.riskLevel = escalateRisk(result.riskLevel, 'high');
    result.warnings.push(
      `User role "${check.userRole}" is not authorised to access SAR data. ` +
      `Access restricted to compliance team per FDL 10/2025 Art. 12.`
    );
    result.regulatoryRefs.push('FDL 10/2025 Art. 12', 'CR 134/2025 Art. 17');
    result.recommendedActions.push(
      'Verify the user has a legitimate business need before granting access',
      'If access is required, obtain MLRO approval and log the access reason',
      'Ensure the user has completed SAR confidentiality training'
    );
  }

  // ── Rule 5: Customer-facing document with SAR content ─────────────────────
  if (
    check.recipientType === 'external' ||
    (check.data && check.data.recipientType === 'customer')
  ) {
    const contentStr = JSON.stringify(check.data ?? {}).toLowerCase();
    const sarKeywords = ['sar', 'suspicious activity', 'suspicious transaction', 'fiu', 'financial intelligence', 'investigation', 'goaml'];
    const hasSarKeyword = sarKeywords.some((kw) => contentStr.includes(kw));

    if (hasSarKeyword) {
      const indicator = TIPPING_OFF_RISK_INDICATORS.find((i) => i.id === 'TIP-005')!;
      result.indicators.push(indicator);
      result.riskLevel = escalateRisk(result.riskLevel, 'critical');
      result.blocked = true;
      result.blockReason =
        `CRITICAL: Customer-facing document contains SAR-related keywords. ` +
        `This constitutes tipping-off per FDL 10/2025 Art. 12. Action BLOCKED.`;
      result.regulatoryRefs.push('FDL 10/2025 Art. 12', 'CR 134/2025 Art. 17');
      result.recommendedActions.push(
        'Remove all SAR-related content from the document',
        'Use neutral language that does not reference suspicious activity or investigations',
        'Have the document reviewed by the compliance team before sending'
      );
    }
  }

  // ── Rule 6: EDD request referencing SAR ───────────────────────────────────
  if (
    check.action.toUpperCase().includes('EDD') ||
    check.action.toUpperCase().includes('ENHANCED_DUE_DILIGENCE') ||
    check.action.toUpperCase().includes('REQUEST_EDD')
  ) {
    if (check.recipientId === check.subjectId) {
      const contentStr = JSON.stringify(check.data ?? {}).toLowerCase();
      const tippingKeywords = ['sar', 'suspicious', 'investigation', 'report'];
      const hasTippingKeyword = tippingKeywords.some((kw) => contentStr.includes(kw));

      if (hasTippingKeyword) {
        const indicator = TIPPING_OFF_RISK_INDICATORS.find((i) => i.id === 'TIP-010')!;
        result.indicators.push(indicator);
        result.riskLevel = escalateRisk(result.riskLevel, 'critical');
        result.blocked = true;
        result.blockReason =
          `CRITICAL: EDD request to SAR subject contains tipping-off language. ` +
          `Action BLOCKED per FDL 10/2025 Art. 12.`;
        result.regulatoryRefs.push('FDL 10/2025 Art. 12', 'CR 134/2025 Art. 17');
        result.recommendedActions.push(
          'Use standard EDD request templates that do not reference the SAR',
          'Frame the request as routine periodic review',
          'Have the communication reviewed by the MLRO before sending'
        );
      }
    }
  }

  // ── Rule 7: Sharing SAR info with non-compliance personnel ────────────────
  if (
    check.action.toUpperCase().includes('SHARE') &&
    check.data &&
    String(check.data.infoType ?? '').toUpperCase() === 'SAR'
  ) {
    const recipientRoles = String(check.data.recipientRole ?? '').toLowerCase();
    if (!complianceRoles.includes(recipientRoles)) {
      const indicator = TIPPING_OFF_RISK_INDICATORS.find((i) => i.id === 'TIP-007')!;
      result.indicators.push(indicator);
      result.riskLevel = escalateRisk(result.riskLevel, 'high');
      result.warnings.push(
        `Sharing SAR information with non-compliance personnel "${recipientRoles}" may constitute tipping-off.`
      );
      result.regulatoryRefs.push('FDL 10/2025 Art. 12', 'CR 134/2025 Art. 17');
      result.recommendedActions.push(
        'Limit SAR information sharing to compliance team members only',
        'If sharing is required for operational reasons, use anonymised summaries',
        'Obtain MLRO approval before any cross-departmental sharing'
      );
    }
  }

  // ── Default: Any SAR-related action gets at least a warning ───────────────
  if (
    (check.targetType === 'sar' || check.targetType === 'alert') &&
    result.riskLevel === 'none'
  ) {
    result.riskLevel = 'low';
    result.warnings.push(
      'You are accessing SAR-related data. Remember the tipping-off prohibition per FDL 10/2025 Art. 12.'
    );
    result.regulatoryRefs.push('FDL 10/2025 Art. 12', 'CR 134/2025 Art. 17');
    result.recommendedActions.push(
      'Handle this information with strict confidentiality',
      'Do not discuss with anyone outside the authorised compliance team',
      'Report any suspected tipping-off to the MLRO immediately'
    );
  }

  return result;
}

// ─── Exported Functions ──────────────────────────────────────────────────────────

/**
 * Generate the tipping-off warning text.
 * Returns the full legal warning per FDL 10/2025 Art. 12.
 */
export function generateTippingOffWarning(): string {
  return TIPPING_OFF_WARNING;
}

/**
 * Validate whether a proposed action complies with the tipping-off prohibition.
 * Returns a validation result with pass/fail status and detailed analysis.
 */
export function validateTippingOffCompliance(
  action: string,
  data: Record<string, unknown>
): {
  compliant: boolean;
  riskAssessment: TippingOffRiskAssessment;
  warning: string | null;
  requiredActions: string[];
} {
  const check: TippingOffCheck = {
    action,
    targetType: (data.targetType as TippingOffCheck['targetType']) ?? 'general',
    targetId: String(data.targetId ?? 'unknown'),
    userId: String(data.userId ?? 'unknown'),
    userRole: String(data.userRole ?? 'unknown'),
    data,
    linkedSARIds: data.linkedSARIds as string[] | undefined,
    subjectId: data.subjectId as string | undefined,
    recipientId: data.recipientId as string | undefined,
    recipientType: data.recipientType as TippingOffCheck['recipientType'],
    communicationMethod: data.communicationMethod as TippingOffCheck['communicationMethod'],
  };

  const riskAssessment = checkTippingOffRisk(check);

  return {
    compliant: !riskAssessment.blocked && riskAssessment.riskLevel !== 'critical',
    riskAssessment,
    warning: riskAssessment.warnings.length > 0
      ? riskAssessment.warnings.join('\n\n')
      : null,
    requiredActions: riskAssessment.recommendedActions,
  };
}

/**
 * Determine the appropriate SAR confidentiality level based on the case characteristics.
 */
export function determineSARConfidentialityLevel(params: {
  involvesPEP: boolean;
  involvesTF: boolean;
  involvesNationalSecurity: boolean;
  amountAED: number;
  linkedToActiveInvestigation: boolean;
}): SARConfidentialityLevel {
  // SECRET: National security, terrorism financing, or active law enforcement cooperation
  if (params.involvesNationalSecurity || params.involvesTF) {
    return 'SECRET';
  }

  // RESTRICTED: PEPs, significant amounts, or active investigations
  if (
    params.involvesPEP ||
    params.amountAED >= 1_000_000 ||
    params.linkedToActiveInvestigation
  ) {
    return 'RESTRICTED';
  }

  // CONFIDENTIAL: Standard SAR
  return 'CONFIDENTIAL';
}

/**
 * Get the list of roles that can access SAR data at a given confidentiality level.
 */
export function getSARAccessRoles(level: SARConfidentialityLevel): string[] {
  return SAR_CONFIDENTIALITY_LEVELS[level].accessRoles;
}

/**
 * Check if a given role is authorised to access SAR data at a given confidentiality level.
 */
export function canAccessSARData(role: string, level: SARConfidentialityLevel): boolean {
  return SAR_CONFIDENTIALITY_LEVELS[level].accessRoles.includes(role.toLowerCase());
}

// ─── Internal Helpers ────────────────────────────────────────────────────────────

/**
 * Escalate the risk level: returns the higher of the two levels.
 */
function escalateRisk(current: TippingOffRiskLevel, proposed: TippingOffRiskLevel): TippingOffRiskLevel {
  const order: TippingOffRiskLevel[] = ['none', 'low', 'medium', 'high', 'critical'];
  const currentIndex = order.indexOf(current);
  const proposedIndex = order.indexOf(proposed);
  return proposedIndex > currentIndex ? proposed : current;
}
