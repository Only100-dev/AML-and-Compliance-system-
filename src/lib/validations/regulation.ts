import { z } from 'zod';
import { REGULATOR_CODES } from '@/lib/constants/jurisdictions';

export const RegulationCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  type: z.enum(['Final Circular', 'Draft Consultation Paper', 'Standard/Code', 'Fee Approval Requirement', 'Guidance Note']).optional(),
  referenceNumber: z.string().optional(),
  issuer: z.enum([...REGULATOR_CODES]).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  publicationDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  effectiveDate: z.string().transform((v) => new Date(v)),
  nextReviewDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  consultationDeadline: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  complianceStatus: z.enum(['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT', 'PENDING', 'NOT_STARTED']).optional(),
  assignedTo: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  implementationConsiderations: z.string().optional(),
  consultationFeedbackStatus: z.enum(['Not Started', 'Drafting', 'Submitted', 'Ignored']).optional(),
  feedbackSubmissionDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  attachments: z.string().optional(), // JSON string of attachment objects
  internalNotes: z.string().optional(),
  sourceUrl: z.string().url().optional().or(z.literal('')),
});

export const RegulationUpdateSchema = z.object({
  id: z.string().min(1, 'Regulation ID is required'),
  title: z.string().min(1, 'Title is required').optional(),
  type: z.enum(['Final Circular', 'Draft Consultation Paper', 'Standard/Code', 'Fee Approval Requirement', 'Guidance Note']).optional(),
  referenceNumber: z.string().optional(),
  issuer: z.enum([...REGULATOR_CODES]).optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  publicationDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  effectiveDate: z.string().transform((v) => new Date(v)).optional(),
  nextReviewDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  consultationDeadline: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  complianceStatus: z.enum(['COMPLIANT', 'PARTIAL', 'NON_COMPLIANT', 'PENDING', 'NOT_STARTED']).optional(),
  assignedTo: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  implementationConsiderations: z.string().optional(),
  consultationFeedbackStatus: z.enum(['Not Started', 'Drafting', 'Submitted', 'Ignored']).optional(),
  feedbackSubmissionDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  attachments: z.string().optional(),
  internalNotes: z.string().optional(),
  sourceUrl: z.string().url().optional().or(z.literal('')),
});

export type RegulationCreateInput = z.infer<typeof RegulationCreateSchema>;
export type RegulationUpdateInput = z.infer<typeof RegulationUpdateSchema>;
