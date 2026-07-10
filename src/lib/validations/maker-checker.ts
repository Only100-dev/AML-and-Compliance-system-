import { z } from 'zod';

export const MakerCheckerActionSchema = z.object({
  logId: z.string().min(1, 'Log ID is required'),
  checkerId: z.string().min(1, 'Checker ID is required'),
  checkerName: z.string().min(1, 'Checker name is required'),
  action: z.enum(['APPROVED', 'REJECTED']),
});

export const MakerCheckerQuerySchema = z.object({
  status: z.string().optional(),
  operationType: z.string().optional(),
  entityType: z.string().optional(),
});

export type MakerCheckerActionInput = z.infer<typeof MakerCheckerActionSchema>;
export type MakerCheckerQueryInput = z.infer<typeof MakerCheckerQuerySchema>;
