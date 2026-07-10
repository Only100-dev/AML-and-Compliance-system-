import { z } from 'zod';

export const EvidenceQuerySchema = z.object({
  inspectionId: z.string().optional(),
});

export type EvidenceQueryInput = z.infer<typeof EvidenceQuerySchema>;
