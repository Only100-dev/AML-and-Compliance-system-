import { z } from 'zod';

export const AlertStatusUpdateSchema = z.object({
  alertId: z.string().min(1, 'Alert ID is required'),
  newStatus: z.enum(['new', 'triage', 'investigating', 'sar_filed', 'escalated', 'closed']),
  updatedBy: z.string().optional(),
  justification: z.string().optional(),
});

export type AlertStatusUpdateInput = z.infer<typeof AlertStatusUpdateSchema>;
