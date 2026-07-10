import { z } from 'zod';
// No jurisdiction constants needed — goAML is UAE-specific, but amount field
// is jurisdiction-currency aware (AED, SAR, BHD, QAR, OMR, KWD)

export const GoAMLFilingCreateSchema = z.object({
  reportType: z.enum(['STR', 'SAR', 'CTR', 'IFT', 'PNMR']),
  referenceNumber: z.string().min(1, 'Reference number is required'),
  subjectName: z.string().min(1, 'Subject name is required'),
  // Jurisdiction-currency aware amount (e.g., AED, SAR, BHD, QAR, OMR, KWD)
  amount: z.number().optional(),
  amountAED: z.number().optional(), // @deprecated Use 'amount' instead — kept for backwards compatibility
  filingStatus: z.enum(['DRAFT', 'PENDING_APPROVAL', 'SUBMITTED_TO_FIU', 'ACKNOWLEDGED']).optional(),
  xmlPayload: z.string().optional(),
  fiuAcknowledgementId: z.string().optional(),
  submittedAt: z.string().transform((v) => new Date(v)).optional(),
  makerId: z.string().optional(),
  makerName: z.string().optional(),
});

export const GoAMLFilingUpdateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  reportType: z.enum(['STR', 'SAR', 'CTR', 'IFT', 'PNMR']).optional(),
  referenceNumber: z.string().optional(),
  subjectName: z.string().optional(),
  // Jurisdiction-currency aware amount (e.g., AED, SAR, BHD, QAR, OMR, KWD)
  amount: z.number().optional(),
  amountAED: z.number().optional(), // @deprecated Use 'amount' instead — kept for backwards compatibility
  filingStatus: z.enum(['DRAFT', 'PENDING_APPROVAL', 'SUBMITTED_TO_FIU', 'ACKNOWLEDGED']).optional(),
  xmlPayload: z.string().optional(),
  fiuAcknowledgementId: z.string().optional(),
  submittedAt: z.string().transform((v) => new Date(v)).optional(),
  makerId: z.string().optional(),
  makerName: z.string().optional(),
});

export const GoAMLFilingQuerySchema = z.object({
  reportType: z.string().optional(),
  filingStatus: z.string().optional(),
  search: z.string().optional(),
});

export type GoAMLFilingCreateInput = z.infer<typeof GoAMLFilingCreateSchema>;
export type GoAMLFilingUpdateInput = z.infer<typeof GoAMLFilingUpdateSchema>;
export type GoAMLFilingQueryInput = z.infer<typeof GoAMLFilingQuerySchema>;
