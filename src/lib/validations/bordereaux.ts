import { z } from 'zod';

// ─── Bordereaux Row Schema ──────────────────────────────────────────────────
// Validates a single row from a bordereaux CSV/Excel file
// Mandatory fields per CBUAE reporting requirements

export const BordereauxRowSchema = z.object({
  policyNumber: z.string().min(1, 'Policy number is required'),
  insuredName: z.string().min(1, 'Insured name is required'),
  premiumAED: z
    .union([z.string(), z.number()])
    .transform((v) => {
      const num = typeof v === 'string' ? parseFloat(v.replace(/,/g, '')) : v;
      if (isNaN(num)) throw new Error('Invalid premium amount');
      return num;
    })
    .refine((v) => v >= 0, 'Premium must be non-negative'),
  startDate: z
    .union([z.string(), z.date()])
    .transform((v) => {
      if (v instanceof Date) return v;
      const d = new Date(v);
      if (isNaN(d.getTime())) throw new Error('Invalid start date format');
      return d;
    }),
  endDate: z
    .union([z.string(), z.date()])
    .transform((v) => {
      if (v instanceof Date) return v;
      const d = new Date(v);
      if (isNaN(d.getTime())) throw new Error('Invalid end date format');
      return d;
    }),
  brokerId: z.string().min(1, 'Broker ID is required'),
  productType: z.string().optional().default('General'),
  emirate: z
    .enum([
      'Abu Dhabi',
      'Dubai',
      'Sharjah',
      'Ajman',
      'Umm Al Quwain',
      'Ras Al Khaimah',
      'Fujairah',
    ])
    .optional()
    .default('Dubai'),
  amlStatus: z
    .enum(['CLEARED', 'FLAGGED', 'PENDING'])
    .optional()
    .default('PENDING'),
});

export const BordereauxValidateRequestSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  fileType: z.enum(['csv', 'xlsx']).default('csv'),
  quarter: z
    .string()
    .regex(/^Q[1-4]-\d{4}$/, 'Quarter must be in format Q1-2025')
    .optional(),
  brokerId: z.string().optional(),
});

export const BordereauxSubmitSchema = z.object({
  submissionId: z.string().min(1, 'Submission ID is required'),
});

export type BordereauxRow = z.infer<typeof BordereauxRowSchema>;
export type BordereauxValidateRequest = z.infer<typeof BordereauxValidateRequestSchema>;
export type BordereauxSubmitRequest = z.infer<typeof BordereauxSubmitSchema>;

// ─── Validation Error Type ──────────────────────────────────────────────────

export interface BordereauxValidationError {
  row: number;
  field: string;
  value: string;
  message: string;
}

export interface BordereauxValidationResult {
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: BordereauxValidationError[];
  validRecords: BordereauxRow[];
  duplicatePolicyNumbers: string[];
}
