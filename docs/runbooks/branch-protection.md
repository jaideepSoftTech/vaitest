# Branch Protection Rules

Configure the `main` branch protection rules via GitHub UI (Settings → Branches → Branch protection rules):

## Required Status Checks

Enable **Require status checks to pass before merging** and select:
- `verify` (lint · typecheck · unit · build)
- `integration` (ephemeral postgres + redis + minio)
- `security`

Do NOT include `contract`, `images`, or `isolation` as required yet — these jobs do not exist in CI yet and will deadlock every PR. They will be added to required checks in later weeks as their underlying infrastructure (OpenAPI spec, Dockerfiles, isolation harness) lands per the roadmap.

## Other Requirements

- **Require branches to be up to date before merging**: enabled (strict mode)
- **Require a pull request review before merging**: at least 1 approving review
- **Require conversation resolution before merging**: enabled
- **Require code owner reviews**: enabled (once `.github/CODEOWNERS` team handles are replaced with real GitHub team/username references)

## CODEOWNERS Setup

Before enabling code owner reviews, replace the placeholder team names in `.github/CODEOWNERS` with real GitHub team handles (e.g., `@your-org/systems`, `@your-org/backend`, `@your-org/frontend`) or individual usernames. Verify the handles resolve:

```bash
gh api repos/YOUR_ORG/YOUR_REPO/collaborators --jq '.[].login'
```

GitHub silently ignores unresolvable handles in CODEOWNERS files, so manual verification is required.
