// Rewrites q1-starter's scripts/load-db.js so it applies the per-candidate overlay.
//
// Kept as a patch rather than a replacement file on purpose: upstream changes to the
// loader keep flowing through, and if an anchor ever moves, this fails loudly instead
// of silently shipping a starter whose fixture is not personalised.

const IMPORT_ANCHOR = "import { hashPassword } from '../server/auth.js';";
const LOAD_ANCHOR = '\nload();\n';
const CLOSE_ANCHOR = 'db.close();';

export function patchLoader(src) {
  for (const [name, anchor] of [['import', IMPORT_ANCHOR], ['load()', LOAD_ANCHOR], ['db.close()', CLOSE_ANCHOR]]) {
    if (!src.includes(anchor)) {
      throw new Error(
        `tools: cannot patch scripts/load-db.js — anchor "${name}" not found.\n` +
        `Upstream changed. Update tools/lib/patch-loader.mjs before packaging.`
      );
    }
  }

  let out = src.replace(
    IMPORT_ANCHOR,
    `${IMPORT_ANCHOR}\nimport { readNonce, buildOverlay, applyOverlay, describeOverlay } from './personalise.js';`
  );

  out = out.replace(
    LOAD_ANCHOR,
    `${LOAD_ANCHOR}\n// --- per-candidate overlay ---------------------------------------------\n` +
    `// ADDITIVE: it adds one organization and never touches the documented two, so the\n` +
    `// shipped public suites stay calibrated with or without it. No nonce -> no overlay,\n` +
    `// which reproduces the documented fixture exactly.\n` +
    `const overlay = buildOverlay(readNonce());\n` +
    `if (overlay) applyOverlay(db, overlay, { passwordHash: hashPassword });\n`
  );

  out = out.replace(CLOSE_ANCHOR, `if (overlay) console.log(describeOverlay(overlay));\n\n${CLOSE_ANCHOR}`);

  return out;
}

/** Replace the implemented verifyAccessToken with the stub the candidate must fill in. */export function stubVerifyAccessToken(src) {
  const start = src.indexOf('export function verifyAccessToken(token, secret) {');
  if (start === -1) throw new Error('tools: verifyAccessToken not found in server/auth.js');

  const endMarker = '\n  return claims;\n}';
  const end = src.indexOf(endMarker, start);
  if (end === -1) throw new Error('tools: end of verifyAccessToken not found; refusing to splice');

  const stub = [
    'export function verifyAccessToken(token, secret) {',
    '  // YOURS TO WRITE. Every failure mode listed above must be a 401 UNAUTHENTICATED.',
    '  // `node scripts/check-jwt.js` is the public suite for this function.',
    '  throw Object.assign(',
    "    new Error('TODO: server/auth.js — verifyAccessToken() is yours to write (AUTH-DATA-MODEL.md §10).'),",
    "    { code: 'NOT_IMPLEMENTED' }",
    '  );',
    '}',
  ].join('\n');

  return src.slice(0, start) + stub + src.slice(end + endMarker.length);
}

// scripts/check-api.js indexes straight into response bodies (dana.body.orgs.map(...)),
// which is fine against a working API and throws an uncaught TypeError against a
// skeleton. When it throws, the `server.kill()` at the bottom of the file never runs and
// the spawned server is left holding its port.
//
// This guard takes the server down on an abort. It adds NO assertions and changes none:
// the checks in the starter are byte-identical to the reference suite.
const CHECK_API_ANCHOR = 'let pass = 0, fail = 0;';

export function patchCheckApi(src) {
  if (!src.includes(CHECK_API_ANCHOR)) {
    throw new Error('tools: cannot patch scripts/check-api.js — anchor not found.');
  }
  const guard = [
    '// Abort cleanly: if a check below throws (an unimplemented API returns a body with no',
    '// fields on it), take the server down with us instead of leaving it holding the port.',
    "for (const event of ['uncaughtException', 'unhandledRejection']) {",
    '  process.on(event, (err) => {',
    '    console.error(`\\n  aborted: ${err?.message ?? err}`);',
    '    server.kill();',
    '    process.exit(1);',
    '  });',
    '}',
    '',
  ].join('\n');
  return src.replace(CHECK_API_ANCHOR, guard + CHECK_API_ANCHOR);
}
