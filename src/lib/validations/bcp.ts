import { z } from 'zod';

export const BCPCreateSchema = z.object({
  planType: z.enum(['BCP', 'DRP', 'Incident_Response', 'Crisis_Communication']),
  title: z.string().min(1, 'Title is required'),
  version: z.string().default('1.0'),
  status: z.enum(['Active', 'Draft', 'Under_Review', 'Archived']).default('Draft'),
  lastTestedDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  nextTestDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  testFrequency: z.enum(['quarterly', 'semi-annual', 'annual', 'biennial']).default('annual'),
  documentUrl: z.string().optional(),
  owner: z.string().optional(),
  department: z.string().optional(),
  rtoHours: z.number().int().positive().optional(),
  rpoHours: z.number().int().positive().optional(),
  description: z.string().optional(),
});

export const BCPUpdateSchema = z.object({
  id: z.string().min(1, 'Plan ID is required'),
  planType: z.enum(['BCP', 'DRP', 'Incident_Response', 'Crisis_Communication']).optional(),
  title: z.string().min(1, 'Title is required').optional(),
  version: z.string().optional(),
  status: z.enum(['Active', 'Draft', 'Under_Review', 'Archived']).optional(),
  lastTestedDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  nextTestDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  testFrequency: z.enum(['quarterly', 'semi-annual', 'annual', 'biennial']).optional(),
  documentUrl: z.string().optional(),
  owner: z.string().optional(),
  department: z.string().optional(),
  rtoHours: z.number().int().positive().optional(),
  rpoHours: z.number().int().positive().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type BCPCreateInput = z.infer<typeof BCPCreateSchema>;
export type BCPUpdateInput = z.infer<typeof BCPUpdateSchema>;
