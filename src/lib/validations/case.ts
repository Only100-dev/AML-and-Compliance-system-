import { z } from 'zod';
import { ALL_JURISDICTION_CODES } from '@/lib/constants/jurisdictions';

export const LegalCaseCreateSchema = z.object({
  caseNumber: z.string().min(1, 'Case number is required'),
  title: z.string().min(1, 'Title is required'),
  caseType: z.string().min(1, 'Case type is required'),
  status: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedCounsel: z.string().optional(),
  department: z.string().optional(),
  description: z.string().optional(),
  filingDate: z.string().transform((v) => new Date(v)).optional(),
  nextHearing: z.string().transform((v) => new Date(v)).optional(),
  resolutionDate: z.string().transform((v) => new Date(v)).optional(),
  jurisdiction: z.enum([...ALL_JURISDICTION_CODES]).optional(),
  aiSummary: z.string().optional(),
});

export const LegalCaseUpdateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  caseNumber: z.string().optional(),
  title: z.string().optional(),
  caseType: z.string().optional(),
  status: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  assignedCounsel: z.string().optional(),
  department: z.string().optional(),
  description: z.string().optional(),
  filingDate: z.string().transform((v) => new Date(v)).optional(),
  nextHearing: z.string().transform((v) => new Date(v)).optional(),
  resolutionDate: z.string().transform((v) => new Date(v)).optional(),
  jurisdiction: z.enum([...ALL_JURISDICTION_CODES]).optional(),
  aiSummary: z.string().optional(),
});

export const LegalCaseQuerySchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  priority: z.string().optional(),
  jurisdiction: z.string().optional(),
  search: z.string().optional(),
});

export type LegalCaseCreateInput = z.infer<typeof LegalCaseCreateSchema>;
export type LegalCaseUpdateInput = z.infer<typeof LegalCaseUpdateSchema>;
export type LegalCaseQueryInput = z.infer<typeof LegalCaseQuerySchema>;
