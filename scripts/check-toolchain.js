#!/usr/bin/env node
// Fails fast with a readable message instead of a cryptic error three minutes
// into `pnpm install`. See docs/runbooks — "clone to running in 15 minutes".
const fs = require("node:fs");
const path = require("node:path");

const nvmrcPath = path.join(__dirname, "..", ".nvmrc");
const expected = fs.readFileSync(nvmrcPath, "utf8").trim();
const actual = process.version.replace(/^v/, "");

const [expMajor] = expected.split(".");
const [actMajor] = actual.split(".");

if (expMajor !== actMajor) {
  console.warn(
    `\n[qa-platform] Warning: .nvmrc pins Node ${expected}, but this shell is running ${actual}.\n` +
      `Run "nvm use" (or your version manager's equivalent) before continuing.\n` +
      `Continuing anyway — this is a warning, not a hard failure, so sandboxed/CI\n` +
      `environments without nvm can still install.\n`,
  );
}

if (!process.env.npm_config_user_agent?.includes("pnpm")) {
  console.warn(
    "[qa-platform] Warning: this repo is managed with pnpm (see packageManager in package.json). " +
      "npm/yarn installs are not supported and will produce a divergent lockfile.",
  );
}
