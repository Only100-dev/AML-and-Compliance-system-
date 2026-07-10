import { z } from 'zod';
import { FIU_CONTEXT_MODULES } from '@/lib/constants/jurisdictions';

export const AIChatMessageSchema = z.object({
  message: z.string().min(1, 'Message is required').max(5000, 'Message must be 5000 characters or less'),
  userId: z.string().optional(),
  contextModule: z.enum([...FIU_CONTEXT_MODULES]).optional(),
  sessionId: z.string().optional(),
});

export const AITaskSchema = z.object({
  task: z.enum(['generate-goaml', 'gap-analysis', 'risk-score']),
  data: z.record(z.string(), z.unknown()),
});

export type AIChatMessageInput = z.infer<typeof AIChatMessageSchema>;
export type AITaskInput = z.infer<typeof AITaskSchema>;
