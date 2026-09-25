#!/usr/bin/env node
// Build the candidate hand-out (`starter/`) from the reference tree (`q1-starter/`).
//
// Reproducible and re-runnable: delete the output, run this, and you get the same
// skeleton. Nothing is hand-maintained twice, so the starter cannot drift from the
// reference except in the ways listed here.
//
//   node tools/strip-starter.mjs [--nonce <value>]
//
// What it does:
//   1. copies the reference, minus build output, databases and dependencies
//   2. removes every file the candidate is supposed to write, and replaces the four
//      server modules and server/routes/index.js with throwing stubs, so the process
//      still BOOTS and the shipped suites still RUN instead of dying on an import
//   3. re-stubs verifyAccessToken in server/auth.js
//   4. installs the per-candidate fixture overlay and its checker
//   5. patches load-db.js and the README, and writes .candidate-nonce

import { cpSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { patchLoader, patchCheckApi, stubVerifyAccessToken } from './lib/patch-loader.mjs';
import { fingerprint } from './templates/scripts/personalise.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'q1-starter');
const OUT = join(ROOT, 'starter');
const TPL = join(ROOT, 'tools', 'templates');

const argv = process.argv.slice(2);
const nonceArg = argv.includes('--nonce') ? argv[argv.indexOf('--nonce') + 1] : null;
const NONCE = nonceArg ?? 'starter-demo';

if (!existsSync(SRC)) {
  console.error(`tools: no reference tree at ${SRC}`);
  process.exit(1);
}

// --- 1. copy -----------------------------------------------------------------------

const EXCLUDE = /(^|\/)(node_modules|dist|test-results|playwright-report|\.git|\.idea)(\/|$)|\.db(-wal|-shm)?$/;

rmSync(OUT, { recursive: true, force: true });
cpSync(SRC, OUT, {
  recursive: true,
  filter: (from) => !EXCLUDE.test(from.replace(SRC, '')),
});

// --- 2. remove what the candidate writes, then install the stubs --------------------

const REMOVE = [
  // The candidate's own write-up. It is a deliverable, not part of the hand-out, and it
  // discusses the decisions the exercise is asking for.
  'NOTES.md',
  'web/App.jsx',
  'web/api.js',
  'web/components',
  'web/styles.css',
  'server/permissions.js',
  'server/context.js',
  'server/lifecycle.js',
  'server/audit.js',
  'server/routes',
];

for (const rel of REMOVE) rmSync(join(OUT, rel), { recursive: true, force: true });

const INSTALL = [
  ['server/context.js', 'server/context.js'],
  ['server/permissions.js', 'server/permissions.js'],
  ['server/lifecycle.js', 'server/lifecycle.js'],
  ['server/audit.js', 'server/audit.js'],
  ['server/routes/index.js', 'server/routes/index.js'],
  ['web/main.jsx', 'web/main.jsx'],
  ['scripts/personalise.js', 'scripts/personalise.js'],
  ['scripts/check-personalisation.js', 'scripts/check-personalisation.js'],
  // The graded write-up: the brief, and the two templates it points at.
  ['DISCOVERY-BRIEF.md', 'DISCOVERY-BRIEF.md'],
  ['BUILD-LOG.md', 'BUILD-LOG.md'],
  ['DECISIONS.md', 'DECISIONS.md'],
];

for (const [from, to] of INSTALL) cpSync(join(TPL, from), join(OUT, to));

// --- 3. re-stub the token verifier, 4. patch the loader ----------------------------

const authPath = join(OUT, 'server/auth.js');
writeFileSync(authPath, stubVerifyAccessToken(readFileSync(authPath, 'utf8')));

const loaderPath = join(OUT, 'scripts/load-db.js');
writeFileSync(loaderPath, patchLoader(readFileSync(loaderPath, 'utf8')));

// The shipped checker indexes into response bodies, so against a skeleton it throws and
// leaves its spawned server holding the port. Guard only; no assertion changes.
const checkApiPath = join(OUT, 'scripts/check-api.js');
writeFileSync(checkApiPath, patchCheckApi(readFileSync(checkApiPath, 'utf8')));

// --- 5. package.json scripts --------------------------------------------------------

const pkgPath = join(OUT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.scripts['personalisation'] = 'node scripts/check-personalisation.js';
pkg.scripts['fingerprint'] = 'node scripts/personalise.js';
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

// --- 5b. README section ------------------------------------------------------------

const readmePath = join(OUT, 'README.md');
const readme = readFileSync(readmePath, 'utf8');
const marker = '## Your database is personalised';
const section = `
---

${marker}

\`npm run db:reset\` loads the documented fixture **plus one organization generated for
you** from a nonce in \`.candidate-nonce\`. That organization contains:

- a role that appears in none of the documents
- a permission that appears in none of the documents
- a per-candidate baseline for that role
- a device-scoped \`allow\` and a device-scoped \`deny\` of that permission, on two
  different devices of the same org

The documented two organizations, their users, devices, grants and memberships are
untouched, so every shipped suite stays calibrated.

**This is the point.** The prose in this repository describes the model but is not the
model: the database is. Read \`roles\`, \`permissions\`, \`role_permissions\`,
\`permission_patterns\` and \`grants\` at runtime. An implementation that encodes the
documented 5-role / 19-permission matrix will pass the public suites and fail grading —
grading runs with a *different* nonce, so the values you can read in
\`scripts/personalise.js\` are not the values you will be graded on.

\`\`\`sh
npm run fingerprint       # print the overlay generated from your nonce
npm run personalisation   # exercise YOUR engine against it
\`\`\`

\`scripts/check-personalisation.js\` is a floor, not the grade. It is the same *shape* as
the graded check, with different values.

`;
const WRITE_UP = `
---

## What you must write up — 30% of the grade

Three artifacts are graded: the code (50%), \`BUILD-LOG.md\` + \`DECISIONS.md\` (30%), and a live
walkthrough (20%) drawn from your own log.

\`\`\`sh
DISCOVERY-BRIEF.md   # what the write-up has to contain. read before you start.
BUILD-LOG.md         # append as you go, and commit as you go
DECISIONS.md         # one section per decision, including the alternative you rejected
\`\`\`

The one rule that matters: **\`BUILD-LOG.md\` grows alongside the code, in its own commits.** A log
that arrives in one commit at the end is a story, and it is scored as one. Write down the moment
you were wrong while you are still wrong.

Expect to defend it live: to open the line that makes a decision, to take an alternative you
rejected, and to change your own code without assistance.
`;

if (!readme.includes(marker)) writeFileSync(readmePath, readme.replace(/\s*$/, '\n') + section);
if (!readme.includes('## What you must write up')) writeFileSync(readmePath, readme.replace(/\s*$/, '\n') + section + WRITE_UP);

writeFileSync(join(OUT, '.candidate-nonce'), `${NONCE}\n`);

// --- report ------------------------------------------------------------------------

console.log(`starter/ built from q1-starter/`);
console.log(`  removed     ${REMOVE.length} paths (every file the candidate writes)`);
console.log(`  installed   ${INSTALL.length} stubs + personalisation modules`);
console.log(`  nonce       ${NONCE}  ->  fingerprint ${fingerprint(NONCE)}`);
console.log(`  next        cd starter && npm install && npm run db:reset`);
