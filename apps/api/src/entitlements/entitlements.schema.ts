import { z } from "zod";

/**
 * Entitlements schema for validating resolved entitlements.
 * Fields are largely optional because Plan.defaults is loosely-typed Json.
 * Only validate type mismatches; missing fields are OK (plan defaults apply).
 */
export const EntitlementsSchema = z.object({
  maxProjects: z.number().positive().optional(),
  maxUsers: z.number().positive().optional(),
  maxTests: z.number().positive().optional(),
  maxExecutionsPerMonth: z.number().positive().optional(),
  maxConcurrency: z.number().nonnegative().optional(),
  maxCustomAgents: z.number().nonnegative().optional(),
  modelTiers: z.array(z.enum(["FAST", "BALANCED", "DEEP"])).optional(),
  monthlyAiBudgetUsd: z.number().nonnegative().optional(),
  artifactRetentionPassDays: z.number().positive().optional(),
  artifactRetentionFailDays: z.number().positive().optional(),
  ssoModes: z.array(z.enum(["OIDC", "SAML", "SCIM"])).optional(),
  versionPinning: z.boolean().optional(),
  auditExportDays: z.number().positive().optional(),
});

export type Entitlements = z.infer<typeof EntitlementsSchema>;
