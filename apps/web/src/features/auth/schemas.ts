// apps/web/src/features/auth/schemas.ts
//
// Client-side form validation schemas using Zod. Constraints match the backend
// (04-API-CONTRACTS.md) exactly.

import { z } from "zod";

const EMAIL_SCHEMA = z.string().email("Invalid email address");
const PASSWORD_SCHEMA = z
  .string()
  .min(12, "Password must be at least 12 characters");
const NAME_SCHEMA = z.string().min(1, "Name is required").max(255);
const ORG_NAME_SCHEMA = z.string().min(1, "Organization name is required").max(255);
const ORG_SLUG_SCHEMA = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with hyphens")
  .max(63);
const DATA_REGION_SCHEMA = z.enum(["US", "EU"]);

export const signupSchema = z.object({
  email: EMAIL_SCHEMA,
  password: PASSWORD_SCHEMA,
  name: NAME_SCHEMA,
  orgName: ORG_NAME_SCHEMA,
  orgSlug: ORG_SLUG_SCHEMA.optional(),
  dataRegion: DATA_REGION_SCHEMA,
});

export type SignupFormData = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: EMAIL_SCHEMA,
  password: PASSWORD_SCHEMA,
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export type VerifyEmailFormData = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: EMAIL_SCHEMA,
});

export type ResendVerificationFormData = z.infer<typeof resendVerificationSchema>;

export const acceptInviteSchema = z.object({
  token: z.string().min(1, "Token is required"),
  password: PASSWORD_SCHEMA.optional(),
  name: NAME_SCHEMA.optional(),
});

export type AcceptInviteFormData = z.infer<typeof acceptInviteSchema>;

export const createOrgSchema = z.object({
  orgName: ORG_NAME_SCHEMA,
  orgSlug: ORG_SLUG_SCHEMA.optional(),
  dataRegion: DATA_REGION_SCHEMA,
});

export type CreateOrgFormData = z.infer<typeof createOrgSchema>;

// Utility: derive a kebab-case slug from org name
export function deriveSlug(orgName: string): string {
  return orgName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // remove non-alphanumeric except space and hyphen
    .replace(/\s+/g, "-") // spaces to hyphens
    .replace(/-+/g, "-") // collapse multiple hyphens
    .replace(/^-|-$/g, ""); // trim leading/trailing hyphens
}
