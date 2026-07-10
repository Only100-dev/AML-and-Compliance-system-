import { z } from 'zod';

export const LaborComplianceCreateSchema = z.object({
  requirement: z.string().min(1, 'Requirement is required'),
  category: z.string().optional(),
  authority: z.string().optional(),
  complianceStatus: z.enum(['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT', 'PENDING']).optional(),
  dueDate: z.string().transform((v) => new Date(v)).optional(),
  assignedTo: z.string().optional(),
  details: z.string().optional(),
  quotaType: z.string().optional(),
  currentCount: z.number().optional(),
  requiredCount: z.number().optional(),
  lastVerified: z.string().transform((v) => new Date(v)).optional(),
});

export const LaborComplianceUpdateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  requirement: z.string().optional(),
  category: z.string().optional(),
  authority: z.string().optional(),
  complianceStatus: z.enum(['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT', 'PENDING']).optional(),
  dueDate: z.string().transform((v) => new Date(v)).optional(),
  assignedTo: z.string().optional(),
  details: z.string().optional(),
  quotaType: z.string().optional(),
  currentCount: z.number().optional(),
  requiredCount: z.number().optional(),
  lastVerified: z.string().transform((v) => new Date(v)).optional(),
});

export const LaborComplianceQuerySchema = z.object({
  category: z.string().optional(),
  status: z.string().optional(),
  authority: z.string().optional(),
});

export type LaborComplianceCreateInput = z.infer<typeof LaborComplianceCreateSchema>;
export type LaborComplianceUpdateInput = z.infer<typeof LaborComplianceUpdateSchema>;
export type LaborComplianceQueryInput = z.infer<typeof LaborComplianceQuerySchema>;
