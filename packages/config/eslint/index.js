// packages/config/eslint/index.js — shared flat-config base.
// apps/* and packages/* extend this and add their own overrides.
const tseslint = require("typescript-eslint");
const qaPlatformPlugin = require("../eslint-rules");

/** @type {import('eslint').Linter.Config[]} */
module.exports = [
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/coverage/**", "**/storybook-static/**"],
  },
  ...tseslint.configs.recommended,
  {
    plugins: { "qa-platform": qaPlatformPlugin },
    rules: {
      "qa-platform/no-bare-prisma-client": "error",
    },
  },
  {
    // packages/domain has zero runtime dependencies beyond zod (07-TEAM-BACKEND.md
    // §1.1 layout note) — enforced here, not just by convention.
    files: ["packages/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@prisma/client", "@qa/db", "@qa/db/*", "ioredis", "bullmq"],
              message: "packages/domain must stay pure — zero I/O beyond zod. See layout note in 08-TEAM-SYSTEMS.md §1.1.",
            },
          ],
        },
      ],
    },
  },
];
