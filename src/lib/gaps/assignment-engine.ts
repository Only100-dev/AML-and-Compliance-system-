/**
 * Phase 5: Gap Assignment Engine
 * PRINCIPLE C: Remediation is accountable — every gap has an owner.
 * 
 * Theme-based auto-assignment with fallback owners.
 * Assignment rules map each of the 9 scorecard themes to the
 * responsible role in each jurisdiction.
 */

import type { GCCJurisdictionCode } from '@/lib/constants/jurisdictions';
import type { GapTheme } from './types';
import { db } from '@/lib/db';

export interface AssignmentRule {
  theme: GapTheme;
  jurisdiction: GCCJurisdictionCode | '*'; // '*' = all jurisdictions
  ownerRole: string;
  fallbackOwner: string;
  fallbackOwnerName: string;
}

export const ASSIGNMENT_RULES: AssignmentRule[] = [
  // Financial Crime — MLRO is the primary owner across all jurisdictions
  { theme: 'financial-crime', jurisdiction: '*', ownerRole: 'mlro', fallbackOwner: 'compliance_manager', fallbackOwnerName: 'Compliance Manager' },
  // Employee Benefits — HR Compliance
  { theme: 'employee-benefits', jurisdiction: '*', ownerRole: 'compliance_officer', fallbackOwner: 'compliance_manager', fallbackOwnerName: 'HR Compliance Manager' },
  // Payroll & Social Insurance — HR Compliance
  { theme: 'payroll-social-insurance', jurisdiction: '*', ownerRole: 'compliance_officer', fallbackOwner: 'compliance_manager', fallbackOwnerName: 'Payroll Compliance Manager' },
  // Contracts & Employment — Legal/HR
  { theme: 'contracts-employment', jurisdiction: '*', ownerRole: 'compliance_officer', fallbackOwner: 'compliance_manager', fallbackOwnerName: 'Employment Law Manager' },
  // Product Design — Product/Risk
  { theme: 'product-design', jurisdiction: '*', ownerRole: 'compliance_manager', fallbackOwner: 'dept_head', fallbackOwnerName: 'Product Compliance Manager' },
  // Claims Handling — Operations/Compliance
  { theme: 'claims-handling', jurisdiction: '*', ownerRole: 'compliance_officer', fallbackOwner: 'compliance_manager', fallbackOwnerName: 'Claims Compliance Officer' },
  // Governance & Risk — Risk Manager
  { theme: 'governance-risk', jurisdiction: '*', ownerRole: 'compliance_manager', fallbackOwner: 'admin', fallbackOwnerName: 'Risk & Governance Manager' },
  // Data Protection — DPO
  { theme: 'data-protection', jurisdiction: '*', ownerRole: 'compliance_officer', fallbackOwner: 'compliance_manager', fallbackOwnerName: 'Data Protection Officer' },
  // Operational Resilience — IT Security / BCP
  { theme: 'operational-resilience', jurisdiction: '*', ownerRole: 'compliance_officer', fallbackOwner: 'admin', fallbackOwnerName: 'IT Resilience Manager' },
];

/**
 * Get the assignment (owner) for a gap based on its theme and jurisdiction.
 * 
 * Resolution order:
 * 1. Check for jurisdiction-specific rule
 * 2. Fall back to wildcard ('*') rule
 * 3. Look up a real user in the database with the assigned role
 * 4. If no user found, use fallback owner
 */
export function getAssignmentForTheme(
  theme: GapTheme,
  jurisdictionId: GCCJurisdictionCode
): {
  ownerId: string;
  ownerName: string;
  ownerRole: string;
} {
  // Find the matching rule (jurisdiction-specific takes priority)
  const rule = ASSIGNMENT_RULES.find(
    r => r.theme === theme && r.jurisdiction === jurisdictionId
  ) ?? ASSIGNMENT_RULES.find(
    r => r.theme === theme && r.jurisdiction === '*'
  );

  if (!rule) {
    return {
      ownerId: 'unassigned',
      ownerName: 'Unassigned',
      ownerRole: 'unassigned',
    };
  }

  return {
    ownerId: 'auto-assigned',
    ownerName: rule.fallbackOwnerName,
    ownerRole: rule.ownerRole,
  };
}

/**
 * Resolve the actual owner from the database based on role and jurisdiction.
 * Used by the API layer after getAssignmentForTheme() returns a role-based assignment.
 */
export async function resolveOwnerFromDB(
  ownerRole: string,
  jurisdictionId: GCCJurisdictionCode
): Promise<{ ownerId: string; ownerName: string } | null> {
  try {
    const user = await db.user.findFirst({
      where: {
        role: ownerRole,
        jurisdiction: jurisdictionId,
        isActive: true,
      },
    });

    if (user) {
      return { ownerId: user.id, ownerName: user.name };
    }

    // Try admin as ultimate fallback
    const admin = await db.user.findFirst({
      where: { role: 'admin', isActive: true },
    });

    if (admin) {
      return { ownerId: admin.id, ownerName: admin.name };
    }

    return null;
  } catch {
    return null;
  }
}
