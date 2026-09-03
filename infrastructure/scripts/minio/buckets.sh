#!/bin/sh
# infrastructure/scripts/minio/buckets.sh
#
# Run by `minio-init` on every `compose up`. Idempotent — safe to re-run.
# Source: 08-TEAM-SYSTEMS.md §6.1.
#
# M0 scope: bucket creation, public-access lockdown, at-rest encryption, and
# the time-based ILM rules. NOT included yet: the `mc admin user svcacct add`
# least-privilege service accounts (policy-worker.json / policy-api.json /
# policy-lifecycle.json), because those policy documents and the
# S3_WORKER_KEY / S3_API_KEY / S3_LIFECYCLE_KEY secrets they need aren't
# defined until the worker/api containers that consume them exist. Until
# then, apps/api and apps/worker use the root S3_ACCESS_KEY / S3_SECRET_KEY
# from .env directly (fine for a single-developer machine, not for anything
# further along than M0).
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
