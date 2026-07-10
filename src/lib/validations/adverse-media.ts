import { z } from 'zod';

export const AdverseMediaCreateSchema = z.object({
  subjectType: z.enum(['INDIVIDUAL', 'ENTITY']),
  subjectName: z.string().min(1, 'Subject name is required'),
  aka: z.string().optional(),
  nationality: z.string().optional(),
  searchConfig: z.string().optional(),
  results: z.string().optional(),
  decision: z.enum(['CLEAR', 'POTENTIAL_MATCH', 'FALSE_POSITIVE', 'CONFIRMED_MATCH']).optional(),
  rationale: z.string().optional(),
  createdBy: z.string().min(1, 'Created by is required'),
});

export const AdverseMediaUpdateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  subjectType: z.enum(['INDIVIDUAL', 'ENTITY']).optional(),
  subjectName: z.string().optional(),
  aka: z.string().optional(),
  nationality: z.string().optional(),
  searchConfig: z.string().optional(),
  results: z.string().optional(),
  decision: z.enum(['CLEAR', 'POTENTIAL_MATCH', 'FALSE_POSITIVE', 'CONFIRMED_MATCH']).optional(),
  rationale: z.string().optional(),
});

export const AdverseMediaQuerySchema = z.object({
  subjectType: z.string().optional(),
  decision: z.string().optional(),
  search: z.string().optional(),
});

export type AdverseMediaCreateInput = z.infer<typeof AdverseMediaCreateSchema>;
export type AdverseMediaUpdateInput = z.infer<typeof AdverseMediaUpdateSchema>;
export type AdverseMediaQueryInput = z.infer<typeof AdverseMediaQuerySchema>;
