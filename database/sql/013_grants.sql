-- 013_grants.sql
-- Owner: BE-1 (authored), SE-1 (executed). Runs after RLS is enabled+forced
-- (011) and policies exist (012), so a grant is never live before the policy
-- that constrains it. See 08-TEAM-SYSTEMS.md §3.2.

-- ---------------------------------------------------------------- qa_app
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO qa_app;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO qa_app;

-- The platform's own control-plane tables are not writable by the app role.
-- Rollout promotion and version authoring go through the operator path,
-- which connects as qa_migrate under an audited grant.
REVOKE INSERT, UPDATE, DELETE ON system_agent_versions, agent_rollouts, plans,
                                  agent_tool_catalog FROM qa_app;
GRANT  SELECT                  ON system_agent_versions, agent_rollouts, plans,
                                  agent_tool_catalog TO qa_app;

-- audit_logs is append-only for everyone.
REVOKE UPDATE, DELETE ON audit_logs FROM qa_app, qa_agent;

-- ---------------------------------------------------------------- qa_agent
GRANT SELECT ON ALL TABLES IN SCHEMA public TO qa_agent;

GRANT INSERT ON agent_runs, agent_actions, ai_proposals, embeddings,
                execution_events, usage_records TO qa_agent;

-- Column-scoped UPDATE so a run can close itself out. An agent run that
-- cannot record its own completion is permanently QUEUED.
GRANT UPDATE (status, output, error, output_tokens, input_tokens, cached_tokens,
              cost_usd, finished_at, started_at)
  ON agent_runs TO qa_agent;

-- Deliberately absent: any INSERT/UPDATE/DELETE on the test repository,
-- issues, executions, artifacts, or ANY tenancy/identity/entitlement table.
REVOKE ALL ON tests, test_steps, test_versions, test_preconditions,
              test_validations, test_dependencies, test_tags, test_data_sets,
              issues, issue_tests, issue_comments, issue_history, issue_artifacts,
              folders, executions, execution_tests, execution_steps, artifacts,
              organizations, plans, org_entitlements, users, memberships,
              project_members, identity_providers, domain_claims, invitations,
              support_access_grants, agents, agent_tool_grants,
              tenant_agent_pins, refresh_tokens
  FROM qa_agent;

GRANT SELECT ON tests, test_steps, test_versions, test_preconditions,
                test_validations, test_dependencies, test_tags, test_data_sets,
                issues, issue_tests, issue_comments, issue_history, issue_artifacts,
                folders, executions, execution_tests, execution_steps, artifacts,
                agents, agent_tool_grants, org_entitlements
  TO qa_agent;

-- Never readable by the agent runtime at all: credentials, tokens, IdP config.
REVOKE ALL ON app_credentials, refresh_tokens, identity_providers FROM qa_agent;

-- Future tables must not silently become writable — or, for the agent,
-- silently become readable at all beyond SELECT.
ALTER DEFAULT PRIVILEGES FOR ROLE qa_migrate IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO qa_app;
ALTER DEFAULT PRIVILEGES FOR ROLE qa_migrate IN SCHEMA public
  GRANT SELECT ON TABLES TO qa_agent;
ALTER DEFAULT PRIVILEGES FOR ROLE qa_migrate IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO qa_app;
