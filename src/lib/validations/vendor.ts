import { z } from 'zod';

export const VendorCreateSchema = z.object({
  vendorName: z.string().min(1, 'Vendor name is required'),
  serviceType: z.enum(['IT_Service', 'Data_Processor', 'Consulting', 'Insurance_Broker', 'TPA', 'Other']),
  riskRating: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  riskScore: z.number().int().min(0).max(100).default(0),
  contractExpiry: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  amlStatus: z.enum(['clear', 'pending', 'flagged', 'edd_required']).default('pending'),
  dataProcessingAgreement: z.boolean().default(false),
  lastAuditDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  nextReviewDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  assignedToId: z.string().optional(),
  country: z.string().optional(),
  contractValue: z.number().positive().optional(),
  description: z.string().optional(),
});

export const VendorUpdateSchema = z.object({
  id: z.string().min(1, 'Vendor ID is required'),
  vendorName: z.string().min(1, 'Vendor name is required').optional(),
  serviceType: z.enum(['IT_Service', 'Data_Processor', 'Consulting', 'Insurance_Broker', 'TPA', 'Other']).optional(),
  riskRating: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
  contractExpiry: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  amlStatus: z.enum(['clear', 'pending', 'flagged', 'edd_required']).optional(),
  dataProcessingAgreement: z.boolean().optional(),
  lastAuditDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  nextReviewDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
  assignedToId: z.string().optional(),
  country: z.string().optional(),
  contractValue: z.number().positive().optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
  eddTriggered: z.boolean().optional(),
  eddCompletedDate: z.string().transform((v) => v ? new Date(v) : undefined).optional(),
});

export type VendorCreateInput = z.infer<typeof VendorCreateSchema>;
export type VendorUpdateInput = z.infer<typeof VendorUpdateSchema>;
