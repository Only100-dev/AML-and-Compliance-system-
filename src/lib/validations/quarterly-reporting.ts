import { z } from 'zod';

export const QuarterlyReportCreateSchema = z.object({
  quarter: z.string().min(1, 'Quarter is required'),
  year: z.number().min(2000, 'Year must be 2000 or later'),
  entityName: z.string().min(1, 'Entity name is required'),
  totalPolicies: z.number().optional(),
  totalPremium: z.number().optional(), // Jurisdiction-currency aware
  totalPremiumAED: z.number().optional(), // @deprecated Use 'totalPremium' instead — kept for backwards compatibility
  activePolicies: z.number().optional(),
  cancellationRate: z.number().optional(),
});

export const QuarterlyReportQuerySchema = z.object({
  quarter: z.string().optional(),
  status: z.string().optional(),
  type: z.enum(['reports', 'records']).optional(),
});

export type QuarterlyReportCreateInput = z.infer<typeof QuarterlyReportCreateSchema>;
export type QuarterlyReportQueryInput = z.infer<typeof QuarterlyReportQuerySchema>;
