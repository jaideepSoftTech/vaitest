-- 014_usage_records_nulls_not_distinct.sql
-- The fix documented in schema.prisma's comment on UsageRecord (Week-1
-- schema defect #4, 07-TEAM-BACKEND.md §1.9): Prisma's @@unique generates a
-- NULLS DISTINCT index, so an org-level usage row (projectId/agentKey/
-- modelTier all NULL) never conflicts with itself and every metering write
-- INSERTs a new row instead of accumulating. Metering holes are
-- unbackfillable, so this is a Week 1 blocker, not a later cleanup.
--
-- Runs after Prisma's generated CREATE TABLE (which creates the NULLS
-- DISTINCT version) and drops/recreates it. The metering writer uses a
-- hand-written INSERT … ON CONFLICT … DO UPDATE SET value = value +
-- EXCLUDED.value rather than Prisma's upsert.

ALTER TABLE usage_records
  DROP CONSTRAINT IF EXISTS usage_records_org_id_project_id_metric_agent_key_model_tier_r;

CREATE UNIQUE INDEX IF NOT EXISTS usage_records_org_project_metric_agent_tier_day_key
  ON usage_records (org_id, project_id, metric, agent_key, model_tier, recorded_on)
  NULLS NOT DISTINCT;
