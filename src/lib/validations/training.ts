import { z } from 'zod';

export const TrainingCourseCreateSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  category: z.string().min(1, 'Category is required'),
  provider: z.string().optional(),
  durationHours: z.number().optional(),
  isMandatory: z.boolean().optional(),
  targetAudience: z.string().optional(),
  certification: z.boolean().optional(),
  validForMonths: z.number().optional(),
  status: z.string().optional(),
  // ─── AML & Compliance Enhancement Fields ────────────────────────────────
  domain: z.string().optional(),
  regsCovered: z.array(z.string()).optional(),         // JSON-stringified on server
  linkedPolicies: z.array(z.string()).optional(),       // JSON-stringified on server
  criticality: z.enum(['High', 'Medium', 'Low']).optional(),
  roleBreakdown: z.record(z.string(), z.object({ completed: z.number(), total: z.number() })).optional(), // JSON-stringified on server
  isOnboardingMandatory: z.boolean().optional(),
  onboardingSLADays: z.number().optional(),
});

export const TrainingEnrollmentCreateSchema = z.object({
  courseId: z.string().min(1, 'Course ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  userName: z.string().min(1, 'User name is required'),
  department: z.string().min(1, 'Department is required'),
  status: z.string().optional(),
  enrolledAt: z.string().transform((v) => new Date(v)).optional(),
  completedAt: z.string().transform((v) => new Date(v)).optional(),
  expiryDate: z.string().transform((v) => new Date(v)).optional(),
  score: z.number().optional(),
  certificateUrl: z.string().optional(),
  // ─── AML & Compliance Enhancement Fields ────────────────────────────────
  isOnboarding: z.boolean().optional(),
  hireDate: z.string().transform((v) => new Date(v)).optional(),
  assessmentPassed: z.boolean().optional(),
  roleGroup: z.string().optional(),
});

const CourseFieldsPartial = TrainingCourseCreateSchema.omit({ title: true, category: true }).partial();
const EnrollmentFieldsPartial = TrainingEnrollmentCreateSchema.omit({ courseId: true, userId: true, userName: true, department: true }).partial();

export const TrainingUpdateSchema = z.object({
  id: z.string().min(1, 'ID is required'),
  type: z.enum(['course', 'enrollment']).optional(),
}).and(
  z.union([CourseFieldsPartial, EnrollmentFieldsPartial])
);

export const TrainingQuerySchema = z.object({
  type: z.enum(['courses', 'enrollments']).optional(),
  category: z.string().optional(),
  status: z.string().optional(),
});

export type TrainingCourseCreateInput = z.infer<typeof TrainingCourseCreateSchema>;
export type TrainingEnrollmentCreateInput = z.infer<typeof TrainingEnrollmentCreateSchema>;
export type TrainingUpdateInput = z.infer<typeof TrainingUpdateSchema>;
export type TrainingQueryInput = z.infer<typeof TrainingQuerySchema>;
