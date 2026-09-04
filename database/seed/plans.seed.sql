-- Seed script for core plans table.
-- Run via: psql $DATABASE_URL -f database/seed/plans.seed.sql
-- Or: DATABASE_URL=postgresql://... psql -f database/seed/plans.seed.sql
--
-- This script inserts the three core plans (starter, pro, enterprise) with
-- reasonable defaults. This is a one-time bootstrapping operation; subsequent
-- plan changes should go through the application layer or manual SQL updates.

INSERT INTO plans (id, key, name, defaults, tier_models, is_public, created_at, updated_at)
VALUES
  (
    gen_random_uuid(),
    'starter',
    'Starter',
    '{
      "maxProjects": 5,
      "maxUsers": 5,
      "maxTests": 100,
      "maxExecutionsPerMonth": 1000,
      "maxConcurrency": 1,
      "maxCustomAgents": 0,
      "modelTiers": ["FAST"],
      "monthlyAiBudgetUsd": 10,
      "artifactRetentionPassDays": 30,
      "artifactRetentionFailDays": 90,
      "ssoModes": ["OIDC"],
      "versionPinning": false,
      "auditExportDays": 30
    }'::json,
    '{}'::json,
    true,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'pro',
    'Professional',
    '{
      "maxProjects": 50,
      "maxUsers": 20,
      "maxTests": 1000,
      "maxExecutionsPerMonth": 10000,
      "maxConcurrency": 5,
      "maxCustomAgents": 5,
      "modelTiers": ["FAST", "BALANCED"],
      "monthlyAiBudgetUsd": 100,
      "artifactRetentionPassDays": 60,
      "artifactRetentionFailDays": 180,
      "ssoModes": ["OIDC", "SAML"],
      "versionPinning": true,
      "auditExportDays": 90
    }'::json,
    '{}'::json,
    true,
    now(),
    now()
  ),
  (
    gen_random_uuid(),
    'enterprise',
    'Enterprise',
    '{
      "maxProjects": null,
      "maxUsers": null,
      "maxTests": null,
      "maxExecutionsPerMonth": null,
      "maxConcurrency": 20,
      "maxCustomAgents": null,
      "modelTiers": ["FAST", "BALANCED", "DEEP"],
      "monthlyAiBudgetUsd": 1000,
      "artifactRetentionPassDays": 365,
      "artifactRetentionFailDays": 365,
      "ssoModes": ["OIDC", "SAML", "SCIM"],
      "versionPinning": true,
      "auditExportDays": 365
    }'::json,
    '{}'::json,
    false,
    now(),
    now()
  )
ON CONFLICT (key) DO NOTHING; -- Idempotent: skip if already exists.
