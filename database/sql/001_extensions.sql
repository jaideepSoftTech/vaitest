-- 001_extensions.sql
-- Prepended first: every later file (roles, RLS, HNSW indexes) depends on
-- one of these existing. Idempotent.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- trigram search, 006_indexes_trgm_hnsw.sql
CREATE EXTENSION IF NOT EXISTS "vector";    -- pgvector, embeddings.vector + HNSW index
