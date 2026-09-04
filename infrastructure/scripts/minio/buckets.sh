#!/bin/sh
# infrastructure/scripts/minio/buckets.sh
#
# Run by `minio-init` on every `compose up`. Idempotent — safe to re-run.
# Source: 08-TEAM-SYSTEMS.md §6.1.
#
# M0 scope: bucket creation, public-access lockdown, at-rest encryption, and
# the time-based ILM rules.
#
# Week 2 delta from M0: Added service account creation for three least-privilege
# roles (worker, api, lifecycle) via policy JSON files. Service accounts are only
# created if their corresponding environment variables are set (S3_WORKER_KEY,
# S3_API_KEY, S3_LIFECYCLE_KEY). This remains a no-op until those env vars are
# added, since the containers that consume these credentials (worker, browser-agent)
# don't exist until Week 4+. Until then, apps/api and apps/worker use the root
# S3_ACCESS_KEY / S3_SECRET_KEY from .env directly (fine for a single-developer
# machine, not for anything further along than M0).
set -eu

mc alias set local "$S3_ENDPOINT" "$S3_ACCESS_KEY" "$S3_SECRET_KEY"

for b in qa-artifacts qa-knowledge qa-exports qa-backups qa-tmp; do
  mc mb --ignore-existing "local/$b"
  mc anonymous set none "local/$b"
done

# Server-side encryption at rest on every bucket holding tenant data. §12.5.
mc encrypt set sse-s3 local/qa-artifacts
mc encrypt set sse-s3 local/qa-knowledge
mc encrypt set sse-s3 local/qa-exports
mc encrypt set sse-s3 local/qa-backups

# ILM is used ONLY where the rule is time-based and unconditional.
# NOTE: qa-artifacts deliberately has NO ILM rule. See §6.4.
mc ilm rule add --expire-days 1   --prefix "uploads/"   local/qa-tmp
mc ilm rule add --expire-days 7   --prefix "exports/"   local/qa-exports
mc ilm rule add --expire-days 60  --prefix "pg/daily/"  local/qa-backups
mc ilm rule add --expire-days 400 --prefix "pg/weekly/" local/qa-backups
mc version enable local/qa-backups

# Service account creation for least-privilege roles (Week 2+).
# Only created if env vars are set; no-op if unset (remains compatible with M0).
if [ -n "${S3_WORKER_KEY:-}" ] && [ -n "${S3_WORKER_SECRET:-}" ]; then
  mc admin user svcacct add local "$S3_ACCESS_KEY" \
    --access-key "$S3_WORKER_KEY" \
    --secret-key "$S3_WORKER_SECRET" \
    --policy /init/policy-worker.json
fi

if [ -n "${S3_API_KEY:-}" ] && [ -n "${S3_API_SECRET:-}" ]; then
  mc admin user svcacct add local "$S3_ACCESS_KEY" \
    --access-key "$S3_API_KEY" \
    --secret-key "$S3_API_SECRET" \
    --policy /init/policy-api.json
fi

if [ -n "${S3_LIFECYCLE_KEY:-}" ] && [ -n "${S3_LIFECYCLE_SECRET:-}" ]; then
  mc admin user svcacct add local "$S3_ACCESS_KEY" \
    --access-key "$S3_LIFECYCLE_KEY" \
    --secret-key "$S3_LIFECYCLE_SECRET" \
    --policy /init/policy-lifecycle.json
fi
