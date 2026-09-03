-- 010_roles.sql
-- Owner: BE-1 (authored), SE-1 (executed in CI + both staging regions).
-- Idempotent, safe to re-run. See 07-TEAM-BACKEND.md §1.5 and
-- 08-TEAM-SYSTEMS.md §3.2 for the full rationale.
--
-- Three roles, two independent boundaries:
--   qa_migrate : DDL. BYPASSRLS. Never used by a running process.
--   qa_app     : API + workers. RLS ENFORCED. CRUD on tenant tables.
--   qa_agent   : agent runtime. RLS ENFORCED. Read-mostly, and carries BOTH
--                restrictions — cannot write the repository (the
--                AI/deterministic boundary) and cannot read across tenants
--                (the isolation boundary).
--
-- Passwords come from `current_setting('qa.<x>_password')`, set via SET LOCAL
-- from the KMS-resolved secret in real environments. Locally, `pnpm db:migrate`
-- sources them from .env (QA_MIGRATE_PASSWORD / QA_APP_PASSWORD / QA_AGENT_PASSWORD)
-- so a fresh clone works with zero manual secret setup. qa_migrate's password
-- never appears in apps/api's or apps/worker's environment — see §3.2's
-- warning about that credential.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qa_migrate') THEN
    EXECUTE format('CREATE ROLE qa_migrate LOGIN BYPASSRLS PASSWORD %L',
                   current_setting('qa.migrate_password'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qa_app') THEN
    EXECUTE format('CREATE ROLE qa_app LOGIN PASSWORD %L',
                   current_setting('qa.app_password'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'qa_agent') THEN
    EXECUTE format('CREATE ROLE qa_agent LOGIN PASSWORD %L',
                   current_setting('qa.agent_password'));
  END IF;
END $$;

-- None of the three is a superuser and none has BYPASSRLS except qa_migrate.
-- Asserted in CI; see database/sql/checks/ (§3.6).
ALTER ROLE qa_app     NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
ALTER ROLE qa_agent   NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS NOREPLICATION;
ALTER ROLE qa_migrate NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION;

-- Tables are owned by qa_migrate. FORCE ROW LEVEL SECURITY (011) is what
-- makes ownership irrelevant to policy enforcement for anyone who is not
-- qa_migrate.
ALTER SCHEMA public OWNER TO qa_migrate;

REVOKE ALL ON SCHEMA public FROM PUBLIC, qa_app, qa_agent;
GRANT  USAGE ON SCHEMA public TO qa_app, qa_agent;
