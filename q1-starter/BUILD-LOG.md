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