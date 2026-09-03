#!/usr/bin/env node
// Parses .env.example for declared variables and greps the tree for
// process.env.X references. Fails when either side has an entry the other
// lacks. Deliberately dependency-free so it runs before `pnpm install`.
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..");
const ENV_EXAMPLE = path.join(ROOT, ".env.example");
const SCAN_DIRS = ["apps", "packages", "database"];
const IGNORE = /node_modules|\.next|dist|coverage|\.turbo/;

function declaredVars() {
  const text = fs.readFileSync(ENV_EXAMPLE, "utf8");
  const names = new Set();
  for (const line of text.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=/);
    if (m) names.add(m[1]);
  }
  return names;
}

function walk(dir, files = []) {
  if (IGNORE.test(dir)) return files;
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (IGNORE.test(full)) continue;
    if (entry.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(full);
  }
  return files;
}

function referencedVars() {
  const names = new Set();
  const re = /process\.env\.([A-Z0-9_]+)/g;
  for (const dir of SCAN_DIRS) {
    for (const file of walk(path.join(ROOT, dir))) {
      const text = fs.readFileSync(file, "utf8");
      let m;
      while ((m = re.exec(text))) names.add(m[1]);
    }
  }
  return names;
}

const declared = declaredVars();
const referenced = referencedVars();

const missingFromExample = [...referenced].filter((v) => !declared.has(v));
const missingFromCode = [...declared].filter(
  (v) => !referenced.has(v) && !["NODE_ENV", "CI"].includes(v),
);

if (missingFromExample.length) {
  console.error("Referenced in code but missing from .env.example:", missingFromExample);
}
if (missingFromCode.length) {
  console.warn("Declared in .env.example but never referenced (ok if reserved):", missingFromCode);
}
if (missingFromExample.length) process.exit(1);
console.log("[qa-platform] env:check passed.");
