import { z } from 'zod';
import { ALL_JURISDICTION_CODES } from '@/lib/constants/jurisdictions';

export const ComplianceAuditCreateSchema = z.object({
  auditNumber: z.string().min(1, 'Audit number is required'),
  title: z.string().min(1, 'Title is required'),
  auditType: z.string().optional(),
  status: z.string().optional(),
  scheduledDate: z.string().transform((v) => new Date(v)).optional(),
  completedDate: z.string().transform((v) => new Date(v)).optional(),
  leadAuditor: z.string().optional(),
  scope: z.string().optional(),
  findings: z.string().optional(),
  remediationStatus: z.string().optional(),
  remediationDueDate: z.string().transform((v) => new Date(v)).optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  jurisdiction: z.enum([...ALL_JURISDICTION_CODES]).optional(),
  department: z.string().optional(),
});

export const ComplianceAuditUpdateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  auditNumber: z.string().optional(),
  title: z.string().optional(),
  auditType: z.string().optional(),
  status: z.string().optional(),
  scheduledDate: z.string().transform((v) => new Date(v)).optional(),
  completedDate: z.string().transform((v) => new Date(v)).optional(),
  leadAuditor: z.string().optional(),
  scope: z.string().optional(),
  findings: z.string().optional(),
  remediationStatus: z.string().optional(),
  remediationDueDate: z.string().transform((v) => new Date(v)).optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  jurisdiction: z.enum([...ALL_JURISDICTION_CODES]).optional(),
  department: z.string().optional(),
});

export const ComplianceAuditQuerySchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  riskLevel: z.string().optional(),
  jurisdiction: z.string().optional(),
});

export type ComplianceAuditCreateInput = z.infer<typeof ComplianceAuditCreateSchema>;
export type ComplianceAuditUpdateInput = z.infer<typeof ComplianceAuditUpdateSchema>;
export type ComplianceAuditQueryInput = z.infer<typeof ComplianceAuditQuerySchema>;
