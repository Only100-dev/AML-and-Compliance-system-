import { z } from 'zod';
import { ALL_JURISDICTION_CODES } from '@/lib/constants/jurisdictions';

export const AMLAlertCreateSchema = z.object({
  alertType: z.string().min(1, 'Alert type is required'),
  description: z.string().min(1, 'Description is required'),
  riskScore: z.number().min(0).max(100).optional(),
  riskLevel: z.enum(['low', 'intermediate', 'high', 'critical']).optional(),
  assignedTo: z.string().optional(),
  createdBy: z.string().optional(),
  jurisdiction: z.enum([...ALL_JURISDICTION_CODES]).optional(),
});

export const AMLAlertActionSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
  action: z.enum(['approve', 'escalate', 'reject', 'close', 'triage']),
  userId: z.string().optional(),
  justification: z.string().optional(),
});

export type AMLAlertCreateInput = z.infer<typeof AMLAlertCreateSchema>;
export type AMLAlertActionInput = z.infer<typeof AMLAlertActionSchema>;
