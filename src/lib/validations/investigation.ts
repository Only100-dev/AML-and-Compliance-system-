import { z } from 'zod';

export const investigationContextQuerySchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
});

export const investigationActionSchema = z.object({
  alertId: z.string().min(1),
  action: z.enum(['dismiss', 'escalate', 'file_sar']),
  justification: z.string().min(10, 'Justification must be at least 10 characters'),
  userId: z.string().min(1),
  userName: z.string().min(1),
});

export const aiSummarySchema = z.object({
  alertId: z.string().min(1),
  operationType: z.string().min(1),
  payloadSnapshot: z.string().min(1),
});

export type InvestigationContextQueryInput = z.infer<typeof investigationContextQuerySchema>;
export type InvestigationActionInput = z.infer<typeof investigationActionSchema>;
export type AISummaryInput = z.infer<typeof aiSummarySchema>;
