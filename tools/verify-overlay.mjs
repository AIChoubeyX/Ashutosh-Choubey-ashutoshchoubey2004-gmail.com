#!/usr/bin/env node
// PROOF THAT THE OVERLAY IS NON-PERTURBING.
//
// The whole design of the personalisation rests on one claim: it is ADDITIVE, so every
// shipped public suite stays calibrated and keeps passing with the overlay loaded. If
// that claim is ever false, every candidate's local signal becomes a lie.
//
// This script tests the claim directly, against the REFERENCE implementation — which is
// the only tree where the suites can pass — with an overlay loaded:
//
//   1. make a scratch copy of q1-starter
//   2. drop scripts/personalise.js in, patch scripts/load-db.js, write .candidate-nonce
//   3. run all four shipped suites
//   4. assert every one still passes
//
//   node tools/verify-overlay.mjs [nonce]
//
// q1-starter itself is never modified.

import { cpSync, rmSync, existsSync, writeFileSync, readFileSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { patchLoader } from './lib/patch-loader.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'q1-starter');
const TMP = join(ROOT, '.verify-overlay');
const NONCE = process.argv[2] ?? 'verify/overlay/1';

const EXCLUDE = /(^|\/)(node_modules|test-results|playwright-report|\.git)(\/|$)|\.db(-wal|-shm)?$/;

rmSync(TMP, { recursive: true, force: true });
cpSync(SRC, TMP, { recursive: true, filter: (from) => !EXCLUDE.test(from.replace(SRC, '')) });

// Reuse the installed dependency tree rather than reinstalling.
symlinkSync(join(SRC, 'node_modules'), join(TMP, 'node_modules'), 'dir');
cpSync(join(ROOT, 'tools/templates/scripts/personalise.js'), join(TMP, 'scripts/personalise.js'));
writeFileSync(join(TMP, 'scripts/load-db.js'), patchLoader(readFileSync(join(TMP, 'scripts/load-db.js'), 'utf8')));
writeFileSync(join(TMP, '.candidate-nonce'), `${NONCE}\n`);

// Playwright's webServer passes an explicit env, so the nonce travels as a FILE. That is
// also how grading should set it: the file needs no env plumbing.
if (!existsSync(join(TMP, 'dist', 'index.html'))) {
  console.log('building the SPA once (dist/ was not present)...');
  execFileSync('npx', ['vite', 'build'], { cwd: TMP, stdio: 'ignore' });
}

const suites = [
  ['resolution engine (documented fixture)', ['scripts/check-permissions.js'], ['ALL PASS']],
  ['token verification', ['scripts/check-jwt.js'], ['ALL PASS']],
  ['HTTP contract (WITH overlay loaded)', ['scripts/check-api.js'], ['ALL PASS']],
];

let failed = 0;
console.log(`\noverlay nonce: ${NONCE}\n${'='.repeat(72)}`);

for (const [name, args, wants] of suites) {
  let out = '';
  try {
    out = execFileSync(process.execPath, args, { cwd: TMP, encoding: 'utf8' });
  } catch (err) {
    out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
  const tail = out.trim().split('\n').filter((l) => /passed|failed/i.test(l)).slice(-1)[0] ?? '(no summary)';
  const ok = wants.every((w) => out.includes(w));
  if (!ok) failed++;
  console.log(`${ok ? '  PASS ' : '  FAIL '} ${name.padEnd(44)} ${tail.trim()}`);
}

// The UI suite runs the real server against e2e.db, loaded by load-db.js, so it exercises
// the overlay too.
{
  let out = '';
  try {
    out = execFileSync('npx', ['playwright', 'test', '--reporter=line'], { cwd: TMP, encoding: 'utf8' });
  } catch (err) {
    out = `${err.stdout ?? ''}${err.stderr ?? ''}`;
  }
  const tail = out.trim().split('\n').filter((l) => /passed|failed/i.test(l)).slice(-1)[0] ?? '(no summary)';
  const ok = /\d+ passed/.test(out) && !/\d+ failed/.test(out);
  if (!ok) failed++;
  console.log(`${ok ? '  PASS ' : '  FAIL '} ${'console contract (WITH overlay loaded)'.padEnd(44)} ${tail.trim()}`);
  if (!ok) console.log(out.slice(-2000));
}

console.log('='.repeat(72));
console.log(failed === 0
  ? 'ALL SUITES STILL PASS with the overlay loaded — the overlay is additive.\n'
  : `${failed} suite(s) broke. The overlay is perturbing the documented fixture.\n`);

rmSync(TMP, { recursive: true, force: true });
process.exit(failed === 0 ? 0 : 1);
