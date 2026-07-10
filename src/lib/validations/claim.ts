import { z } from 'zod';
import { ALL_JURISDICTION_CODES } from '@/lib/constants/jurisdictions';

export const ClaimCreateSchema = z.object({
  policyNumber: z.string().min(1, 'Policy number is required'),
  claimType: z.string().min(1, 'Claim type is required'),
  claimantName: z.string().min(1, 'Claimant name is required'),
  description: z.string().optional(),
  amount: z.number().min(0, 'Amount must be positive').optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedAdjuster: z.string().optional(),
  jurisdiction: z.enum([...ALL_JURISDICTION_CODES]).optional(),
});

export type ClaimCreateInput = z.infer<typeof ClaimCreateSchema>;
