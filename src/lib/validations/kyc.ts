import { z } from 'zod';

export const CorporateKYCCreateSchema = z.object({
  legalName: z.string().min(1, 'Legal name is required'),
  tradeLicenseNo: z.string().min(1, 'Trade license number is required'),
  trn: z.string().optional(),
  legalForm: z.enum(['LLC', 'PJSC', 'Free Zone', 'Sole Proprietorship', 'Branch']).optional(),
  uboIdentified: z.boolean().optional(),
  uboDetails: z.string().optional(),
  pepInManagement: z.boolean().optional(),
  riskScore: z.number().min(0).max(100).optional(),
  riskRating: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  status: z.enum(['DRAFT', 'PENDING_MAKER_CHECKER', 'APPROVED', 'REJECTED']).optional(),
  makerId: z.string().optional(),
  makerName: z.string().optional(),
});

export const IndividualKYCCreateSchema = z.object({
  fullName: z.string().min(1, 'Full name is required'),
  emiratesId: z.string().optional(),
  passportNo: z.string().min(1, 'Passport number is required'),
  nationality: z.string().min(1, 'Nationality is required'),
  isPep: z.boolean().optional(),
  riskRating: z.enum(['STANDARD', 'HIGH']).optional(),
  eddRequired: z.boolean().optional(),
  status: z.enum(['DRAFT', 'PENDING_MAKER_CHECKER', 'APPROVED', 'REJECTED']).optional(),
  makerId: z.string().optional(),
  makerName: z.string().optional(),
});

const CorporateFieldsPartial = CorporateKYCCreateSchema.omit({ legalName: true, tradeLicenseNo: true }).partial();
const IndividualFieldsPartial = IndividualKYCCreateSchema.omit({ fullName: true, passportNo: true, nationality: true }).partial();

export const KYCUpdateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  type: z.enum(['corporate', 'individual']),
}).and(
  z.union([CorporateFieldsPartial, IndividualFieldsPartial])
);

export const KYCQuerySchema = z.object({
  type: z.enum(['corporate', 'individual']).optional(),
  status: z.string().optional(),
  riskRating: z.string().optional(),
  isPep: z.string().optional(),
  search: z.string().optional(),
});

export type CorporateKYCCreateInput = z.infer<typeof CorporateKYCCreateSchema>;
export type IndividualKYCCreateInput = z.infer<typeof IndividualKYCCreateSchema>;
export type KYCUpdateInput = z.infer<typeof KYCUpdateSchema>;
export type KYCQueryInput = z.infer<typeof KYCQuerySchema>;
