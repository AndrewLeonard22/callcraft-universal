import { z } from 'zod';

/**
 * Centralized validation schemas for the application
 * Prevents duplicate validation logic and ensures consistency
 */

// Email validation with trim and length limits
export const emailSchema = z.string()
  .trim()
  .email({ message: "Invalid email address" })
  .max(255, { message: "Email must be less than 255 characters" });

// Phone validation - basic format check
export const phoneSchema = z.string()
  .trim()
  .regex(/^[\d\s()+-]+$/, { message: "Invalid phone number format" })
  .min(10, { message: "Phone number must be at least 10 digits" })
  .max(20, { message: "Phone number must be less than 20 characters" })
  .optional()
  .or(z.literal(''));

// URL validation with protocol requirement
export const urlSchema = z.string()
  .trim()
  .url({ message: "Invalid URL format" })
  .max(2048, { message: "URL is too long" })
  .optional()
  .or(z.literal(''));

// Text field with configurable length
export const textFieldSchema = (min: number = 1, max: number = 255, fieldName: string = "Field") =>
  z.string()
    .trim()
    .min(min, { message: `${fieldName} must be at least ${min} characters` })
    .max(max, { message: `${fieldName} must be less than ${max} characters` });

// Optional text field
export const optionalTextField = (max: number = 500, fieldName: string = "Field") =>
  z.string()
    .trim()
    .max(max, { message: `${fieldName} must be less than ${max} characters` })
    .optional()
    .or(z.literal(''));

// Numeric field with range
export const numericSchema = (min: number = 0, max: number = 999999, fieldName: string = "Value") =>
  z.coerce.number()
    .min(min, { message: `${fieldName} must be at least ${min}` })
    .max(max, { message: `${fieldName} cannot exceed ${max}` })
    .optional();

// Training module validation
export const trainingModuleSchema = z.object({
  title: textFieldSchema(1, 200, "Module title"),
  description: optionalTextField(1000, "Module description"),
  category: z.string().min(1, { message: "Module type is required" }),
  service_type_id: z.string().uuid({ message: "Service type is required" }),
});

// Training section validation
export const trainingSectionSchema = z.object({
  title: textFieldSchema(1, 200, "Section title"),
  content: optionalTextField(5000, "Section content"),
});

// Training feature validation
export const trainingFeatureSchema = z.object({
  feature_name: textFieldSchema(1, 100, "Feature name"),
  feature_value: textFieldSchema(1, 200, "Feature value"),
});

// Training benefit validation
export const trainingBenefitSchema = z.object({
  benefit_text: textFieldSchema(1, 500, "Benefit text"),
  benefit_type: z.enum(['pro', 'con', 'neutral'], { message: "Invalid benefit type" }).optional(),
});

// Training video validation
export const trainingVideoSchema = z.object({
  title: textFieldSchema(1, 200, "Video title"),
  video_url: urlSchema.refine((val) => val && val.length > 0, {
    message: "Video URL is required"
  }),
  description: optionalTextField(1000, "Video description"),
});

// Quiz question validation
export const quizQuestionSchema = z.object({
  question: textFieldSchema(1, 500, "Question"),
  answer: textFieldSchema(1, 2000, "Answer"),
});

// Client creation validation
export const clientSchema = z.object({
  business_name: textFieldSchema(1, 200, "Business name"),
  owners_name: optionalTextField(100, "Owner's name"),
  sales_rep_name: optionalTextField(100, "Sales rep name"),
  sales_rep_phone: phoneSchema,
  service_area: textFieldSchema(1, 500, "Service area"),
  address: optionalTextField(500, "Address"),
  website: urlSchema,
  service_radius_miles: numericSchema(1, 500, "Service radius").optional(),
});

/**
 * Safe validation helper that returns errors in a user-friendly format
 */
export function validateWithSchema<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors: Record<string, string> = {};
  result.error.errors.forEach((error) => {
    const path = error.path.join('.');
    errors[path] = error.message;
  });
  
  return { success: false, errors };
}

/**
 * Safely parse and validate data, returning null on failure
 */
export function safeValidate<T>(schema: z.ZodSchema<T>, data: unknown): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}
