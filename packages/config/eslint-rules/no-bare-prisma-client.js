// packages/config/eslint-rules/no-bare-prisma-client.js
//
// "A developer physically cannot write an unscoped query without deleting a
// rule in a reviewed PR." — 07-TEAM-BACKEND.md §1.3. This ships Week 1,
// before any feature code exists, so there is never a migration period
// where half the codebase is exempt.
//
// Configured as `error`, with `--max-warnings 0` in CI, plus a CI grep that
// fails the build on any `eslint-disable` naming this rule anywhere outside
// packages/db.
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow importing the raw Prisma client outside packages/db. Use withTenant/withPlatform from @qa/db.",
    },
    messages: {
      bare:
        "Import { withTenant } from @qa/db instead. The bare Prisma client is not " +
        "tenant-scoped; a query issued through it bypasses app.current_org_id and " +
        "returns zero rows at best and another tenant's rows at worst.",
    },
    schema: [],
  },
  create(ctx) {
    const filename = ctx.getFilename();
    // packages/db is the only place allowed to touch the raw client.
    if (/[\\/]packages[\\/]db[\\/]src[\\/]/.test(filename)) return {};
    const BANNED = new Set(["@prisma/client", "@qa/db/src/tenant-context", ".prisma/client"]);
    return {
      ImportDeclaration(node) {
        const src = node.source.value;
        if (BANNED.has(src) || /tenant-context$/.test(src) || /prisma-client/.test(src)) {
          // Type-only imports of generated model types are fine and common.
          if (node.importKind === "type") return;
          ctx.report({ node, messageId: "bare" });
        }
      },
      // Also catches `const { PrismaClient } = require('@prisma/client')`.
      CallExpression(node) {
        if (node.callee.name === "require" && BANNED.has(node.arguments[0]?.value)) {
          ctx.report({ node, messageId: "bare" });
        }
      },
    };
  },
};
