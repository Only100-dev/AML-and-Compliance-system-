/**
 * IC-OS Cross-Module Navigation Hooks & Unified Case Linking
 * Phase 1 Regulatory Critical Enhancement
 *
 * Provides cross-module navigation, unified case linking, and
 * entity escalation functions that connect the various compliance
 * modules (AML, KYC, SAR, Sanctions, Claims, Policies, etc.).
 *
 * Key features:
 *   - ModuleLink interface for entity-to-entity relationships
 *   - MODULE_NAV_MAP for navigable module connections
 *   - CrossModuleLinker class for linking and navigating entities
 *   - Escalation functions: alert → SAR, claim → SIU, KYC → screening
 *   - createComplianceCaseFromAlert for unified case creation
 *
 * Regulatory basis:
 *   - FDL 10/2025 Art. 13-15 (Internal reporting, MLRO, controls)
 *   - CR 134/2025 Art. 18-20 (Internal procedures, policies)
 *   - CBUAE Notice 3551/2021 S3.1-S3.2 (Governance, MLRO function)
 */

import { z } from 'zod';
import { db } from '@/lib/db';
import { checkPermission } from './rbac';
import type { ComplianceRole } from './rbac';
import { setAuditContext, clearAuditContext, createManualAuditLog } from './audit-middleware';
import { checkTippingOffRisk } from './tipping-off';
import { generateAuditHash } from './audit-middleware';

// ─── Types ──────────────────────────────────────────────────────────────────────

export type ComplianceModule =
  | 'aml'
  | 'kyc_individual'
  | 'kyc_corporate'
  | 'kyc_vasp'
  | 'sar'
  | 'sanctions'
  | 'goaml'
  | 'claims'
  | 'policies'
  | 'audits'
  | 'training'
  | 'regulatory'
  | 'evidence'
  | 'risk_assessment'
  | 'vendor_dd'
  | 'legal';

export type LinkType =
  | 'escalation'
  | 'related'
  | 'originates_from'
  | 'triggers'
  | 'supports'
  | 'supersedes'
  | 'references'
  | 'investigated_in'
  | 'reported_in'
  | 'compliance_requirement';

export interface ModuleLink {
  /** Source module where the link originates */
  sourceModule: ComplianceModule;
  /** Entity ID in the source module */
  sourceEntityId: string;
  /** Target module being linked to */
  targetModule: ComplianceModule;
  /** Entity ID in the target module */
  targetEntityId: string;
  /** Type of relationship between the entities */
  linkType: LinkType;
  /** Timestamp of when the link was created */
  createdAt: Date;
  /** User who created the link */
  createdBy: string;
  /** Optional regulatory reference for this link */
  regulatoryRef?: string;
  /** Optional notes explaining the link */
  notes?: string;
}

export interface NavigationTarget {
  module: ComplianceModule;
  entityId: string;
  label: string;
  route: string;
  linkType: LinkType;
}

// ─── Zod Schemas ────────────────────────────────────────────────────────────────

export const ModuleLinkSchema = z.object({
  sourceModule: z.enum([
    'aml', 'kyc_individual', 'kyc_corporate', 'kyc_vasp',
    'sar', 'sanctions', 'goaml', 'claims', 'policies', 'audits',
    'training', 'regulatory', 'evidence', 'risk_assessment',
    'vendor_dd', 'legal',
  ]),
  sourceEntityId: z.string().min(1),
  targetModule: z.enum([
    'aml', 'kyc_individual', 'kyc_corporate', 'kyc_vasp',
    'sar', 'sanctions', 'goaml', 'claims', 'policies', 'audits',
    'training', 'regulatory', 'evidence', 'risk_assessment',
    'vendor_dd', 'legal',
  ]),
  targetEntityId: z.string().min(1),
  linkType: z.enum([
    'escalation', 'related', 'originates_from', 'triggers',
    'supports', 'supersedes', 'references', 'investigated_in',
    'reported_in', 'compliance_requirement',
  ]),
  createdBy: z.string().min(1),
  regulatoryRef: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Module Navigation Map ──────────────────────────────────────────────────────

/**
 * Defines which modules can navigate to which other modules.
 * This drives the cross-module navigation UI and determines
 * valid escalation and linking paths.
 */
export const MODULE_NAV_MAP: Record<ComplianceModule, {
  label: string;
  route: string;
  navigableTargets: {
    module: ComplianceModule;
    linkTypes: LinkType[];
    label: string;
    description: string;
  }[];
}> = {
  aml: {
    label: 'AML Alerts & Triage',
    route: '/aml',
    navigableTargets: [
      { module: 'sar', linkTypes: ['escalation', 'triggers'], label: 'Escalate to SAR', description: 'Escalate alert to a SAR case per FDL 10/2025 Art. 8' },
      { module: 'sanctions', linkTypes: ['related', 'triggers'], label: 'View Sanctions Screening', description: 'View or initiate sanctions screening for the alert subject' },
      { module: 'kyc_individual', linkTypes: ['related', 'references'], label: 'View Individual KYC', description: 'View the KYC record for the alert subject' },
      { module: 'kyc_corporate', linkTypes: ['related', 'references'], label: 'View Corporate KYC', description: 'View the corporate KYC record for the alert subject' },
      { module: 'kyc_vasp', linkTypes: ['related', 'references'], label: 'View VASP KYC', description: 'View the VASP KYC record for the alert subject' },
      { module: 'goaml', linkTypes: ['reported_in', 'triggers'], label: 'Create goAML Filing', description: 'Create a goAML filing (STR/SAR/CTR) from this alert' },
      { module: 'claims', linkTypes: ['related'], label: 'View Related Claims', description: 'View claims related to this alert' },
      { module: 'evidence', linkTypes: ['supports'], label: 'View Evidence', description: 'View or upload evidence related to this alert' },
      { module: 'legal', linkTypes: ['investigated_in'], label: 'View Legal Cases', description: 'View legal cases related to this alert' },
    ],
  },
  kyc_individual: {
    label: 'Individual KYC',
    route: '/kyc/individual',
    navigableTargets: [
      { module: 'sanctions', linkTypes: ['triggers'], label: 'Screen for Sanctions', description: 'Initiate sanctions screening for this individual' },
      { module: 'aml', linkTypes: ['triggers', 'related'], label: 'View AML Alerts', description: 'View AML alerts associated with this individual' },
      { module: 'sar', linkTypes: ['related'], label: 'View SAR Cases', description: 'View SAR cases involving this individual' },
      { module: 'policies', linkTypes: ['compliance_requirement'], label: 'View Applicable Policies', description: 'View policies applicable to this KYC profile' },
      { module: 'risk_assessment', linkTypes: ['references'], label: 'View Risk Assessment', description: 'View risk assessment for this individual' },
    ],
  },
  kyc_corporate: {
    label: 'Corporate KYC',
    route: '/kyc/corporate',
    navigableTargets: [
      { module: 'sanctions', linkTypes: ['triggers'], label: 'Screen for Sanctions', description: 'Initiate sanctions screening for this entity' },
      { module: 'aml', linkTypes: ['triggers', 'related'], label: 'View AML Alerts', description: 'View AML alerts associated with this entity' },
      { module: 'sar', linkTypes: ['related'], label: 'View SAR Cases', description: 'View SAR cases involving this entity' },
      { module: 'kyc_individual', linkTypes: ['related'], label: 'View UBO KYC', description: 'View individual KYC records for UBOs' },
      { module: 'policies', linkTypes: ['compliance_requirement'], label: 'View Applicable Policies', description: 'View policies applicable to this corporate profile' },
      { module: 'risk_assessment', linkTypes: ['references'], label: 'View Risk Assessment', description: 'View risk assessment for this entity' },
    ],
  },
  kyc_vasp: {
    label: 'VASP KYC',
    route: '/kyc/vasp',
    navigableTargets: [
      { module: 'sanctions', linkTypes: ['triggers'], label: 'Screen for Sanctions', description: 'Initiate sanctions screening for this VASP' },
      { module: 'aml', linkTypes: ['triggers', 'related'], label: 'View AML Alerts', description: 'View AML alerts associated with this VASP' },
      { module: 'sar', linkTypes: ['related'], label: 'View SAR Cases', description: 'View SAR cases involving this VASP' },
      { module: 'risk_assessment', linkTypes: ['references'], label: 'View Risk Assessment', description: 'View risk assessment for this VASP' },
    ],
  },
  sar: {
    label: 'SAR Cases',
    route: '/sar',
    navigableTargets: [
      { module: 'aml', linkTypes: ['originates_from'], label: 'View Source Alert', description: 'View the originating AML alert' },
      { module: 'goaml', linkTypes: ['reported_in'], label: 'View goAML Filing', description: 'View or create the goAML filing for this SAR' },
      { module: 'kyc_individual', linkTypes: ['references'], label: 'View Subject KYC', description: 'View the KYC record for the SAR subject' },
      { module: 'kyc_corporate', linkTypes: ['references'], label: 'View Subject Corporate KYC', description: 'View the corporate KYC for the SAR subject' },
      { module: 'sanctions', linkTypes: ['related'], label: 'View Sanctions Screening', description: 'View sanctions screening for the SAR subject' },
      { module: 'evidence', linkTypes: ['supports'], label: 'View Evidence', description: 'View or upload evidence supporting this SAR' },
    ],
  },
  sanctions: {
    label: 'Sanctions Screening',
    route: '/sanctions',
    navigableTargets: [
      { module: 'aml', linkTypes: ['triggers', 'related'], label: 'Create AML Alert', description: 'Create an AML alert from a sanctions match' },
      { module: 'kyc_individual', linkTypes: ['references'], label: 'View Individual KYC', description: 'View the KYC record for the screened individual' },
      { module: 'kyc_corporate', linkTypes: ['references'], label: 'View Corporate KYC', description: 'View the KYC record for the screened entity' },
      { module: 'sar', linkTypes: ['escalation'], label: 'Escalate to SAR', description: 'Escalate a confirmed match to a SAR case' },
      { module: 'legal', linkTypes: ['investigated_in'], label: 'View Legal Cases', description: 'View legal cases related to this screening' },
    ],
  },
  goaml: {
    label: 'goAML Filing Center',
    route: '/goaml',
    navigableTargets: [
      { module: 'sar', linkTypes: ['originates_from'], label: 'View SAR Case', description: 'View the SAR case for this filing' },
      { module: 'aml', linkTypes: ['originates_from'], label: 'View Source Alert', description: 'View the source AML alert' },
    ],
  },
  claims: {
    label: 'Claims Portals',
    route: '/claims',
    navigableTargets: [
      { module: 'aml', linkTypes: ['triggers'], label: 'Create AML Alert', description: 'Create an AML alert from a suspicious claim' },
      { module: 'legal', linkTypes: ['investigated_in'], label: 'View Legal Cases', description: 'View legal cases related to this claim' },
      { module: 'evidence', linkTypes: ['supports'], label: 'View Evidence', description: 'View evidence for this claim' },
      { module: 'policies', linkTypes: ['compliance_requirement'], label: 'View Applicable Policies', description: 'View policies applicable to this claim' },
    ],
  },
  policies: {
    label: 'Policies & SOPs',
    route: '/policies',
    navigableTargets: [
      { module: 'regulatory', linkTypes: ['compliance_requirement'], label: 'View Regulations', description: 'View regulations that this policy addresses' },
      { module: 'training', linkTypes: ['compliance_requirement'], label: 'View Training', description: 'View training related to this policy' },
      { module: 'audits', linkTypes: ['references'], label: 'View Audits', description: 'View audits that reviewed this policy' },
    ],
  },
  audits: {
    label: 'Compliance Audits',
    route: '/audits',
    navigableTargets: [
      { module: 'policies', linkTypes: ['references'], label: 'View Policies', description: 'View policies reviewed in this audit' },
      { module: 'evidence', linkTypes: ['supports'], label: 'View Evidence', description: 'View audit evidence' },
      { module: 'regulatory', linkTypes: ['compliance_requirement'], label: 'View Regulations', description: 'View regulations that triggered this audit' },
    ],
  },
  training: {
    label: 'Training & Certifications',
    route: '/training',
    navigableTargets: [
      { module: 'policies', linkTypes: ['compliance_requirement'], label: 'View Related Policies', description: 'View policies that require this training' },
    ],
  },
  regulatory: {
    label: 'CBUAE Regulatory Tracker',
    route: '/regulatory',
    navigableTargets: [
      { module: 'policies', linkTypes: ['compliance_requirement'], label: 'View Policies', description: 'View policies addressing this regulation' },
      { module: 'audits', linkTypes: ['references'], label: 'View Audits', description: 'View audits related to this regulation' },
    ],
  },
  evidence: {
    label: 'Evidence War Room',
    route: '/evidence',
    navigableTargets: [
      { module: 'aml', linkTypes: ['supports'], label: 'View AML Alert', description: 'View the AML alert this evidence supports' },
      { module: 'sar', linkTypes: ['supports'], label: 'View SAR Case', description: 'View the SAR case this evidence supports' },
      { module: 'claims', linkTypes: ['supports'], label: 'View Claim', description: 'View the claim this evidence supports' },
      { module: 'audits', linkTypes: ['supports'], label: 'View Audit', description: 'View the audit this evidence supports' },
    ],
  },
  risk_assessment: {
    label: 'Risk Assessment',
    route: '/risk',
    navigableTargets: [
      { module: 'policies', linkTypes: ['compliance_requirement'], label: 'View Policies', description: 'View policies related to this risk assessment' },
      { module: 'aml', linkTypes: ['references'], label: 'View AML Alerts', description: 'View alerts related to this risk domain' },
    ],
  },
  vendor_dd: {
    label: 'Vendor Due Diligence',
    route: '/vendor-dd',
    navigableTargets: [
      { module: 'risk_assessment', linkTypes: ['references'], label: 'View Risk Assessment', description: 'View risk assessment for this vendor' },
      { module: 'sanctions', linkTypes: ['triggers'], label: 'Screen for Sanctions', description: 'Screen this vendor for sanctions' },
    ],
  },
  legal: {
    label: 'Legal Advisory',
    route: '/legal',
    navigableTargets: [
      { module: 'claims', linkTypes: ['related'], label: 'View Related Claims', description: 'View claims related to this legal case' },
      { module: 'aml', linkTypes: ['related'], label: 'View AML Alerts', description: 'View AML alerts related to this legal case' },
      { module: 'evidence', linkTypes: ['supports'], label: 'View Evidence', description: 'View evidence for this legal case' },
    ],
  },
};

// ─── CrossModuleLinker Class ────────────────────────────────────────────────────

/**
 * CrossModuleLinker provides methods for linking, navigating, and
 * managing relationships between entities across compliance modules.
 *
 * All linking operations are audited for regulatory traceability.
 */
export class CrossModuleLinker {
  private userId: string;
  private userRole: ComplianceRole;

  constructor(userId: string, userRole: ComplianceRole) {
    this.userId = userId;
    this.userRole = userRole;
  }

  /**
   * Create a link between two entities across modules.
   * Validates the link against MODULE_NAV_MAP and persists it
   * in the ComplianceCase linked entity arrays.
   */
  async linkEntities(
    source: { module: ComplianceModule; entityId: string },
    target: { module: ComplianceModule; entityId: string },
    linkType: LinkType,
    notes?: string
  ): Promise<ModuleLink> {
    // Validate that this link is permitted in the navigation map
    const sourceMap = MODULE_NAV_MAP[source.module];
    const isPermitted = sourceMap.navigableTargets.some(
      (t) => t.module === target.module && t.linkTypes.includes(linkType)
    );

    if (!isPermitted) {
      throw new Error(
        `Invalid cross-module link: ${source.module} → ${target.module} with linkType "${linkType}" is not permitted. ` +
        `Check MODULE_NAV_MAP for valid navigation paths.`
      );
    }

    const link: ModuleLink = {
      sourceModule: source.module,
      sourceEntityId: source.entityId,
      targetModule: target.module,
      targetEntityId: target.entityId,
      linkType,
      createdAt: new Date(),
      createdBy: this.userId,
      notes,
    };

    // Audit the link creation
    setAuditContext({
      userId: this.userId,
      regulatoryRef: 'FDL 10/2025 Art. 15; CR 134/2025 Art. 20',
    });

    await createManualAuditLog({
      userId: this.userId,
      action: 'CROSS_MODULE_LINK',
      resource: `${source.module}_${target.module}`,
      resourceId: `${source.entityId}_${target.entityId}`,
      details: `Linked ${source.module}/${source.entityId} → ${target.module}/${target.entityId} (${linkType})${notes ? `. Notes: ${notes}` : ''}`,
      ipAddress: undefined,
    });

    clearAuditContext();

    // Update the linked entities in ComplianceCase if applicable
    await this.persistLink(link);

    return link;
  }

  /**
   * Get all entities linked to a given entity across modules.
   * Returns navigation targets with routing information.
   */
  async getLinkedEntities(
    entityId: string,
    module: ComplianceModule
  ): Promise<NavigationTarget[]> {
    const targets: NavigationTarget[] = [];

    // Query ComplianceCase for linked entities
    const cases = await db.complianceCase.findMany({
      where: {
        OR: [
          { linkedAlertIds: { contains: entityId } },
          { linkedKYCIds: { contains: entityId } },
          { linkedSARIds: { contains: entityId } },
          { linkedSanctionsIds: { contains: entityId } },
          { linkedPolicyIds: { contains: entityId } },
          { linkedCaseIds: { contains: entityId } },
        ],
      },
    });

    for (const complianceCase of cases) {
      // Parse linked entity arrays and create navigation targets
      const parsedAlerts = this.safeParseJSON<string[]>(complianceCase.linkedAlertIds);
      const parsedKYC = this.safeParseJSON<string[]>(complianceCase.linkedKYCIds);
      const parsedSARs = this.safeParseJSON<string[]>(complianceCase.linkedSARIds);
      const parsedSanctions = this.safeParseJSON<string[]>(complianceCase.linkedSanctionsIds);
      const parsedPolicies = this.safeParseJSON<string[]>(complianceCase.linkedPolicyIds);
      const parsedLegalCases = this.safeParseJSON<string[]>(complianceCase.linkedCaseIds);

      if (parsedAlerts) {
        for (const alertId of parsedAlerts) {
          if (alertId !== entityId) {
            targets.push({
              module: 'aml',
              entityId: alertId,
              label: `AML Alert: ${alertId}`,
              route: `/aml?id=${alertId}`,
              linkType: 'related',
            });
          }
        }
      }

      if (parsedKYC) {
        for (const kycId of parsedKYC) {
          if (kycId !== entityId) {
            targets.push({
              module: 'kyc_individual',
              entityId: kycId,
              label: `KYC: ${kycId}`,
              route: `/kyc?id=${kycId}`,
              linkType: 'related',
            });
          }
        }
      }

      if (parsedSARs) {
        for (const sarId of parsedSARs) {
          if (sarId !== entityId) {
            targets.push({
              module: 'sar',
              entityId: sarId,
              label: `SAR Case: ${sarId}`,
              route: `/sar?id=${sarId}`,
              linkType: 'related',
            });
          }
        }
      }

      if (parsedSanctions) {
        for (const screeningId of parsedSanctions) {
          if (screeningId !== entityId) {
            targets.push({
              module: 'sanctions',
              entityId: screeningId,
              label: `Sanctions: ${screeningId}`,
              route: `/sanctions?id=${screeningId}`,
              linkType: 'related',
            });
          }
        }
      }

      if (parsedPolicies) {
        for (const policyId of parsedPolicies) {
          if (policyId !== entityId) {
            targets.push({
              module: 'policies',
              entityId: policyId,
              label: `Policy: ${policyId}`,
              route: `/policies?id=${policyId}`,
              linkType: 'compliance_requirement',
            });
          }
        }
      }

      if (parsedLegalCases) {
        for (const caseId of parsedLegalCases) {
          if (caseId !== entityId) {
            targets.push({
              module: 'legal',
              entityId: caseId,
              label: `Legal Case: ${caseId}`,
              route: `/legal?id=${caseId}`,
              linkType: 'related',
            });
          }
        }
      }
    }

    return targets;
  }

  /**
   * Generate navigation information for a target module and entity.
   * Returns the route and metadata needed for cross-module navigation.
   */
  navigateToModule(
    targetModule: ComplianceModule,
    entityId: string
  ): NavigationTarget {
    const mapEntry = MODULE_NAV_MAP[targetModule];
    return {
      module: targetModule,
      entityId,
      label: mapEntry.label,
      route: `${mapEntry.route}?id=${entityId}`,
      linkType: 'related',
    };
  }

  // ─── Private Helpers ────────────────────────────────────────────────────

  /**
   * Persist a cross-module link by updating the ComplianceCase
   * linked entity arrays.
   */
  private async persistLink(link: ModuleLink): Promise<void> {
    // Find or create a ComplianceCase that contains the source entity
    const sourceField = this.getLinkedFieldForModule(link.sourceModule);
    const targetField = this.getLinkedFieldForModule(link.targetModule);

    if (!sourceField || !targetField) return;

    // Try to find an existing case containing the source entity
    const existingCases = await db.complianceCase.findMany();
    let targetCase = existingCases.find((c) => {
      const linkedIds = this.safeParseJSON<string[]>(c[sourceField as keyof typeof c] as string);
      return linkedIds?.includes(link.sourceEntityId);
    });

    if (!targetCase) {
      // Create a new compliance case
      const caseNumber = `CC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
      targetCase = await db.complianceCase.create({
        data: {
          caseNumber,
          title: `Compliance Case: ${link.sourceModule} → ${link.targetModule}`,
          caseType: this.getCaseTypeForModules(link.sourceModule, link.targetModule),
          status: 'open',
          priority: 'normal',
          riskLevel: 'medium',
          jurisdiction: 'CBUAE',
          description: `Auto-generated compliance case linking ${link.sourceModule}/${link.sourceEntityId} to ${link.targetModule}/${link.targetEntityId}`,
          [sourceField]: JSON.stringify([link.sourceEntityId]),
          [targetField]: JSON.stringify([link.targetEntityId]),
          assignedToId: this.userId,
          assignedToName: this.userId,
        },
      });
    } else {
      // Add the target entity to the existing case
      const existingTargetIds = this.safeParseJSON<string[]>(
        (targetCase as Record<string, unknown>)[targetField] as string
      ) ?? [];

      if (!existingTargetIds.includes(link.targetEntityId)) {
        existingTargetIds.push(link.targetEntityId);
        await db.complianceCase.update({
          where: { id: targetCase.id },
          data: {
            [targetField]: JSON.stringify(existingTargetIds),
          },
        });
      }
    }
  }

  /**
   * Map a compliance module to the ComplianceCase linked entity field.
   */
  private getLinkedFieldForModule(module: ComplianceModule): string | null {
    const mapping: Partial<Record<ComplianceModule, string>> = {
      aml: 'linkedAlertIds',
      kyc_individual: 'linkedKYCIds',
      kyc_corporate: 'linkedKYCIds',
      kyc_vasp: 'linkedKYCIds',
      sar: 'linkedSARIds',
      sanctions: 'linkedSanctionsIds',
      policies: 'linkedPolicyIds',
      legal: 'linkedCaseIds',
    };
    return mapping[module] ?? null;
  }

  /**
   * Determine the case type based on the source and target modules.
   */
  private getCaseTypeForModules(
    source: ComplianceModule,
    target: ComplianceModule
  ): string {
    if (source === 'aml' || target === 'aml') return 'aml_investigation';
    if (source === 'sanctions' || target === 'sanctions') return 'sanctions_review';
    if (source === 'kyc_individual' || source === 'kyc_corporate' || source === 'kyc_vasp') return 'kyc_escalation';
    if (source === 'claims' || target === 'claims') return 'fraud_investigation';
    return 'regulatory_inquiry';
  }

  /**
   * Safely parse a JSON string, returning null on failure.
   */
  private safeParseJSON<T>(json: string | null | undefined): T | null {
    if (!json) return null;
    try {
      return JSON.parse(json) as T;
    } catch {
      return null;
    }
  }
}

// ─── Escalation Functions ───────────────────────────────────────────────────────

/**
 * Create a unified compliance case from an AML alert.
 * Links the alert to a new ComplianceCase with appropriate type and priority.
 *
 * Regulatory basis: FDL 10/2025 Art. 13-15
 */
export async function createComplianceCaseFromAlert(
  alertId: string,
  userId: string,
  userRole: ComplianceRole
): Promise<{ caseId: string; caseNumber: string }> {
  // Permission check
  if (!checkPermission(userRole, 'canCreateComplianceCase')) {
    throw new Error(
      `Role "${userRole}" does not have permission to create compliance cases. ` +
      `Required: compliance_officer, compliance_manager, mlro, or admin.`
    );
  }

  // Fetch the alert
  const alert = await db.aMLAlert.findUnique({ where: { id: alertId } });
  if (!alert) {
    throw new Error(`AML Alert with id "${alertId}" not found.`);
  }

  // Create compliance case
  const caseNumber = `CC-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  const riskLevel = alert.riskLevel ?? 'medium';

  const complianceCase = await db.complianceCase.create({
    data: {
      caseNumber,
      title: `AML Investigation: ${alert.alertType} — ${alert.caseId}`,
      caseType: 'aml_investigation',
      status: 'open',
      priority: riskLevel === 'critical' ? 'urgent' : riskLevel === 'high' ? 'high' : 'normal',
      riskLevel,
      jurisdiction: alert.jurisdiction ?? 'CBUAE',
      description: alert.description,
      linkedAlertIds: JSON.stringify([alertId]),
      assignedToId: userId,
      assignedToName: userId,
    },
  });

  // Audit the case creation
  await createManualAuditLog({
    userId,
    action: 'CREATE_COMPLIANCE_CASE_FROM_ALERT',
    resource: 'ComplianceCase',
    resourceId: complianceCase.id,
    details: `Created compliance case ${caseNumber} from AML alert ${alert.caseId}. Risk level: ${riskLevel}.`,
  });

  return { caseId: complianceCase.id, caseNumber };
}

/**
 * Escalate an AML alert to a SAR case.
 * Creates a new SARCase with 30-day filing deadline per FDL 10/2025 Art. 8.
 *
 * Includes tipping-off risk check before proceeding.
 */
export async function escalateToSAR(
  alertId: string,
  userId: string,
  userRole: ComplianceRole
): Promise<{ sarCaseId: string; caseNumber: string; filingDeadline: Date }> {
  // Permission check — SAR filing requires MLRO or admin
  if (!checkPermission(userRole, 'canFileSAR')) {
    throw new Error(
      `Role "${userRole}" does not have permission to escalate to SAR. ` +
      `Required: mlro or admin. Regulatory ref: FDL 10/2025 Art. 8.`
    );
  }

  // Fetch the alert
  const alert = await db.aMLAlert.findUnique({ where: { id: alertId } });
  if (!alert) {
    throw new Error(`AML Alert with id "${alertId}" not found.`);
  }

  // Tipping-off risk check
  const tippingOffCheck = checkTippingOffRisk({
    action: 'ESCALATE_TO_SAR',
    targetType: 'alert',
    targetId: alertId,
    userId,
    userRole,
  });

  if (tippingOffCheck.blocked) {
    throw new Error(
      `TIPPING-OFF RISK: Cannot escalate alert to SAR. ${tippingOffCheck.blockReason ?? 'Risk detected.'}`
    );
  }

  // Calculate filing deadline: 30 calendar days per FDL 10/2025 Art. 8
  const triggerDate = new Date();
  const filingDeadline = new Date(triggerDate);
  filingDeadline.setDate(filingDeadline.getDate() + 30);

  // Create SAR case
  const caseNumber = `SAR-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

  const sarCase = await db.sARCase.create({
    data: {
      caseNumber,
      alertId,
      filingDeadline,
      triggerDate,
      daysRemaining: 30,
      status: 'DRAFT',
      tippingOffWarning: true,
      subjectName: alert.description?.slice(0, 200) ?? 'Unknown Subject',
      subjectType: 'INDIVIDUAL',
      jurisdiction: alert.jurisdiction ?? 'CBUAE',
      riskLevel: alert.riskLevel ?? 'high',
      createdById: userId,
    },
  });

  // Update the AML alert status
  await db.aMLAlert.update({
    where: { id: alertId },
    data: { status: 'sar_filed' },
  });

  // Link to or create a compliance case
  const linker = new CrossModuleLinker(userId, userRole);
  await linker.linkEntities(
    { module: 'aml', entityId: alertId },
    { module: 'sar', entityId: sarCase.id },
    'escalation',
    `Escalated AML alert ${alert.caseId} to SAR case ${caseNumber}`
  );

  // Audit the escalation
  await createManualAuditLog({
    userId,
    action: 'ESCALATE_TO_SAR',
    resource: 'SARCase',
    resourceId: sarCase.id,
    details: `Escalated AML alert ${alert.caseId} to SAR case ${caseNumber}. Filing deadline: ${filingDeadline.toISOString()}. Per FDL 10/2025 Art. 8.`,
  });

  return {
    sarCaseId: sarCase.id,
    caseNumber,
    filingDeadline,
  };
}

/**
 * Escalate a claim to SIU (Special Investigations Unit).
 * Creates a compliance case and links the claim for fraud investigation.
 *
 * Regulatory basis: FDL 10/2025 Art. 13-15; CBUAE Notice 3551/2021 S3.2
 */
export async function escalateToSIU(
  claimId: string,
  userId: string,
  userRole: ComplianceRole
): Promise<{ caseId: string; caseNumber: string }> {
  // Permission check
  if (!checkPermission(userRole, 'canCreateComplianceCase')) {
    throw new Error(
      `Role "${userRole}" does not have permission to escalate to SIU. ` +
      `Required: compliance_officer, compliance_manager, mlro, or admin.`
    );
  }

  // Fetch the claim
  const claim = await db.claim.findUnique({ where: { id: claimId } });
  if (!claim) {
    throw new Error(`Claim with id "${claimId}" not found.`);
  }

  // Create compliance case for SIU investigation
  const caseNumber = `SIU-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();

  const complianceCase = await db.complianceCase.create({
    data: {
      caseNumber,
      title: `SIU Investigation: Claim ${claim.claimNumber} — Fraud Score ${claim.fraudScore}`,
      caseType: 'fraud_investigation',
      status: 'open',
      priority: claim.siuFlagged ? 'urgent' : claim.priority === 'urgent' ? 'urgent' : 'high',
      riskLevel: claim.fraudScore > 0.7 ? 'critical' : claim.fraudScore > 0.4 ? 'high' : 'medium',
      jurisdiction: claim.jurisdiction ?? 'CBUAE',
      description: `SIU escalation for claim ${claim.claimNumber}. Fraud score: ${claim.fraudScore}. Amount: AED ${claim.amount}. ${claim.description}`,
    },
  });

  // Update the claim status
  await db.claim.update({
    where: { id: claimId },
    data: { siuFlagged: true, status: 'investigation' },
  });

  // Audit the escalation
  await createManualAuditLog({
    userId,
    action: 'ESCALATE_TO_SIU',
    resource: 'ComplianceCase',
    resourceId: complianceCase.id,
    details: `Escalated claim ${claim.claimNumber} to SIU. Fraud score: ${claim.fraudScore}. Case: ${caseNumber}.`,
  });

  return { caseId: complianceCase.id, caseNumber };
}

/**
 * Link a KYC record to a sanctions screening event.
 * Creates the cross-module link and updates both records.
 *
 * Regulatory basis: FDL 10/2025 Art. 7, 9, 18; CR 134/2025 Art. 5-9, 25-26
 */
export async function linkKYCToScreening(
  kycId: string,
  screeningId: string,
  userId: string,
  userRole: ComplianceRole,
  kycType: 'individual' | 'corporate' | 'vasp' = 'individual'
): Promise<{ linked: boolean; linkId: string }> {
  // Permission check
  if (!checkPermission(userRole, 'canScreenSanctions')) {
    throw new Error(
      `Role "${userRole}" does not have permission to link KYC to sanctions screening. ` +
      `Required: compliance_officer, compliance_manager, mlro, or admin.`
    );
  }

  // Determine the KYC module
  const kycModule: ComplianceModule =
    kycType === 'corporate' ? 'kyc_corporate' :
    kycType === 'vasp' ? 'kyc_vasp' :
    'kyc_individual';

  // Create the cross-module link
  const linker = new CrossModuleLinker(userId, userRole);
  const link = await linker.linkEntities(
    { module: kycModule, entityId: kycId },
    { module: 'sanctions', entityId: screeningId },
    'triggers',
    `Linked ${kycType} KYC record to sanctions screening`
  );

  // Audit the link
  await createManualAuditLog({
    userId,
    action: 'LINK_KYC_TO_SCREENING',
    resource: 'SanctionsScreening',
    resourceId: screeningId,
    details: `Linked ${kycType} KYC ${kycId} to sanctions screening ${screeningId}. Per FDL 10/2025 Art. 7, 18.`,
  });

  return { linked: true, linkId: `${kycId}_${screeningId}` };
}

// ─── Navigation Utility Functions ───────────────────────────────────────────────

/**
 * Get all valid navigation targets from a given module.
 */
export function getNavigationTargets(
  sourceModule: ComplianceModule
): NavigationTarget[] {
  const mapEntry = MODULE_NAV_MAP[sourceModule];
  return mapEntry.navigableTargets.map((target) => ({
    module: target.module,
    entityId: '', // Will be populated at runtime
    label: target.label,
    route: MODULE_NAV_MAP[target.module].route,
    linkType: target.linkTypes[0], // Use the first link type as primary
  }));
}

/**
 * Get the module route for a given module.
 */
export function getModuleRoute(module: ComplianceModule): string {
  return MODULE_NAV_MAP[module].route;
}

/**
 * Get the module label for a given module.
 */
export function getModuleLabel(module: ComplianceModule): string {
  return MODULE_NAV_MAP[module].label;
}

/**
 * Check if a navigation path from one module to another is valid.
 */
export function isValidNavigationPath(
  source: ComplianceModule,
  target: ComplianceModule,
  linkType?: LinkType
): boolean {
  const sourceMap = MODULE_NAV_MAP[source];
  return sourceMap.navigableTargets.some(
    (t) =>
      t.module === target &&
      (linkType ? t.linkTypes.includes(linkType) : true)
  );
}
