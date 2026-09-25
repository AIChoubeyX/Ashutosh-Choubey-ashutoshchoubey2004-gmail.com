#!/usr/bin/env node
// Issue a candidate hand-out: a copy of `starter/` with a nonce derived from the
// candidate's id, so no two candidates get the same personalized organization.
//
//   node tools/new-candidate.mjs <candidateId> [--out <dir>]
//
// Default output is `candidates/<candidateId>/`. The nonce is written to
// `.candidate-nonce` in that copy, which scripts/load-db.js reads. Nothing else differs
// between candidates — so a solution that reads the tables at runtime passes for all of
// them, and one that encodes the documented matrix (or the values in this repo's own
// starter-demo fixture) fails for all of them.
//
// Record the fingerprint you print here. It is how you reproduce a candidate's fixture
// later, and how you confirm at review time that grading used a different nonce.

import { cpSync, rmSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildOverlay, fingerprint } from '../tools/templates/scripts/personalise.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STARTER = join(ROOT, 'starter');

const argv = process.argv.slice(2);
const candidateId = argv.find((a) => !a.startsWith('--'));
const outArg = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : null;

if (!candidateId) {
  console.error('usage: node tools/new-candidate.mjs <candidateId> [--out <dir>]');
  process.exit(1);
}
if (!existsSync(STARTER)) {
  console.error('tools: no starter/ — run `node tools/strip-starter.mjs` first.');
  process.exit(1);
}

// The nonce is derived, not chosen: the same candidate id always yields the same
// fixture, so a re-issue is reproducible and a review can regenerate the exact DB.
const nonce = `remoteops/${candidateId}`;
const overlay = buildOverlay(nonce);
const out = outArg ?? join(ROOT, 'candidates', candidateId);

const EXCLUDE = /(^|\/)(node_modules|dist|test-results|playwright-report|\.git)(\/|$)|\.db(-wal|-shm)?$/;
rmSync(out, { recursive: true, force: true });
cpSync(STARTER, out, { recursive: true, filter: (from) => !EXCLUDE.test(from.replace(STARTER, '')) });
writeFileSync(join(out, '.candidate-nonce'), `${nonce}\n`);

// A per-candidate manifest, written OUTSIDE the hand-out, so the fixture is auditable
// without the candidate being handed a list of the values they must not hardcode.
const manifest = {
  candidateId,
  nonce,
  fingerprint: fingerprint(nonce),
  generatedAt: new Date().toISOString(),
  grading: {
    note: 'Grading MUST use a different nonce than the one shipped to the candidate.',
    role: overlay.role.key,
    roleRank: overlay.role.rank,
    permission: overlay.permission.key,
    baseline: overlay.role.baseline,
    org: `${overlay.org.name} (${overlay.org.id})`,
    allowOn: overlay.grants[0].deviceId,
    denyOn: overlay.grants[1].deviceId,
    interactAs: `${overlay.user.email} / demo1234`,
  },
};
writeFileSync(join(ROOT, 'candidates', `${candidateId}.manifest.json`), `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`hand-out written to ${out}`);
console.log(`  nonce        ${nonce}`);
console.log(`  fingerprint  ${manifest.fingerprint}`);
console.log(`  extra role   ${overlay.role.key} (rank ${overlay.role.rank})`);
console.log(`  extra perm   ${overlay.permission.key}`);
console.log(`  extra org    ${overlay.org.name}`);
console.log(`  manifest     candidates/${candidateId}.manifest.json`);
console.log(`
NOW: for grading, run the hidden tier with a DIFFERENT nonce, e.g.
  CANDIDATE_NONCE=grade/${candidateId}/$(date +%s) ...
so that the values above cannot be baked in.`);
