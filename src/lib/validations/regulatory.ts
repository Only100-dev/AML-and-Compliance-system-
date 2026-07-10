import { z } from 'zod';
import { REGULATOR_CODES } from '@/lib/constants/jurisdictions';

export const RegulatoryCircularCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  regulator: z.enum([...REGULATOR_CODES]).optional(),
  circularNumber: z.string().min(1, 'Circular number is required'),
  effectiveDate: z.string().transform((v) => new Date(v)),
  summary: z.string().optional(),
  affectedDepts: z.string().optional(),
  sourceUrl: z.string().optional(),
});

export const RegulatoryCircularQuerySchema = z.object({
  regulator: z.string().optional(),
  status: z.string().optional(),
});

export type RegulatoryCircularCreateInput = z.infer<typeof RegulatoryCircularCreateSchema>;
export type RegulatoryCircularQueryInput = z.infer<typeof RegulatoryCircularQuerySchema>;
