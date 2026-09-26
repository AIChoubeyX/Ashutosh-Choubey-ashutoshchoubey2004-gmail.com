# Build Log

## 2026-09-26 — Local setup and Windows database-loader compatibility

### Baseline

- The starter initially failed during `npm install` because the local environment was using Node.js v24.11.1 while the starter specifies `better-sqlite3` `^11.10.0`.
- The native dependency attempted a local build and required Visual Studio/C++ tooling.
- Switched the local environment to Node.js v22.23.3 using NVM for Windows while keeping the starter dependency unchanged.

### Investigation

- Re-ran `npm install`; installation completed successfully with `better-sqlite3@11.10.0`.
- `npm run build` completed successfully.
- `npm run db:load` initially failed with a malformed Windows path:
  `C:\C:\...\q1-starter\db\schema.sql`.
- Verified that `db/schema.sql` existed with `Test-Path .\db\schema.sql`.
- Investigated `scripts/load-db.js` and found that it converted a `file:` URL using `.pathname`.
- Reproduced the URL conversion behavior and confirmed the Windows path handling issue.

### Fix

- Changed `scripts/load-db.js` to use Node's `fileURLToPath()` when converting the `file:` URL to a filesystem path.
- Kept `db/schema.sql` and `db/reference.sql` unchanged.
- Kept the supplied `better-sqlite3` version unchanged.

### Verification

- `npm install` — passed.
- `npm run build` — passed.
- `npm run db:load` — passed.
- Database successfully seeded:
  - organizations: 2
  - users: 6
  - memberships: 8
  - devices: 7
  - grants: 4
  - sessions: 2
  - audit events: 5
  - permissions: 19
  - permission patterns: 26

## 2026-09-26 — Phase 1: Secure JWT access-token verification in server/auth.js

### Baseline

- `verifyAccessToken` in `server/auth.js` required full implementation conforming strictly to `AUTH-DATA-MODEL.md §10` and `§2`.
- Ran `node scripts/check-jwt.js` to establish verification baseline across all 43 rejection and round-trip test cases.

### Implementation

- Implemented `verifyAccessToken(token, secret)` in `server/auth.js`:
  - Enforced 3-segment dot-separated format check.
  - Verified base64url JSON decoding with type safety guards ensuring header and payload are non-null objects and not arrays.
  - Pinned algorithm strictly to `alg === 'HS256'` and `typ === 'JWT'`, preventing `alg: none` and algorithm substitution attacks.
  - Computed HMAC-SHA256 over `${header}.${payload}` and validated signature using `timingSafeEqual` with buffer length guards.
  - Validated all required claims: `sub`, `org`, `role`, `pv`, `jti`, `iat`, `exp`, `iss`, `aud`.
  - Required `iss === 'remoteops'` and `aud === 'remoteops-api'`.
  - Enforced half-open time boundary for token expiry (`exp <= now` treated as expired).
  - Enforced non-empty `jti` claim.
  - Preserved `assertFresh(claims, membership)` comparing `membership.perm_version !== claims.pv` throwing `401 TOKEN_STALE`.

### Verification

- Ran `node scripts/check-jwt.js`:
  - §2: Well-formed token round-trips (6/6 checks passed).
  - §10: Malformed input rejection (9/9 checks passed).
  - §10: Algorithm confusion prevention (8/8 checks passed).
  - §10: Signature validation & timing resistance (6/6 checks passed).
  - §10 / D7: Half-open `exp <= now` validation (6/6 checks passed).
  - §10: Issuer, audience, and jti validation (6/6 checks passed).
  - §10: Refresh token bearer rejection (2/2 checks passed).
  - Result: ALL PASS — 43 passed, 0 failed.
- Ran `node scripts/check-permissions.js` (ALL PASS — 35 passed, 0 failed).
- Ran `node scripts/check-api.js` (ALL PASS — 66 passed, 0 failed).