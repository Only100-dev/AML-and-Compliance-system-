import { z } from 'zod';

export const PolicyCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  policyNumber: z.string().min(1, 'Policy number is required'),
  category: z.string().min(1, 'Category is required'),
  version: z.string().optional(),
  status: z.enum(['draft', 'under_review', 'approved', 'published', 'archived']).optional(),
  department: z.string().min(1, 'Department is required'),
  owner: z.string().min(1, 'Owner is required'),
  reviewDate: z.string().transform((v) => new Date(v)).optional(),
  approvalDate: z.string().transform((v) => new Date(v)).optional(),
  approvedBy: z.string().optional(),
  documentUrl: z.string().optional(),
});

export type PolicyCreateInput = z.infer<typeof PolicyCreateSchema>;
