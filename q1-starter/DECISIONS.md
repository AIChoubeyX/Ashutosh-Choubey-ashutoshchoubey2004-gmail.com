# Decisions

## Decision: Use fileURLToPath for database fixture paths on Windows

### Chosen

Use Node.js `fileURLToPath()` when converting the `file:` URL used by `scripts/load-db.js` into a filesystem path.

### Why

The existing implementation used:

```js
new URL(p, import.meta.url).pathname
```

On Windows, this produces a leading forward slash before the drive letter (e.g. `/C:/path`), causing SQLite file resolution to fail. Node's standard `fileURLToPath` produces valid platform-specific native paths across Windows and POSIX environments.

### What I rejected

Hardcoding string slicing or path replacements (e.g. `.slice(1)`), which is fragile and breaks on Unix/macOS platforms.

---

## Decision: Pin HS256 algorithm and perform strict claim validation with constant-time signature verification for access tokens

### Chosen

In `server/auth.js`, enforce HS256 algorithm pinning (`alg === 'HS256'` and `typ === 'JWT'`), structural JSON parsing guards, constant-time HMAC-SHA256 signature verification via `timingSafeEqual()`, half-open expiration check (`exp <= now`), strict issuer (`iss === 'remoteops'`) and audience (`aud === 'remoteops-api'`) matching, and validation of all required claims (`sub`, `org`, `role`, `pv`, `jti`, `iat`, `exp`, `iss`, `aud`). Membership permission version (`pv`) staleness is verified during request context establishment via `assertFresh()`, yielding `401 TOKEN_STALE` on mismatch.

### Why

Per AUTH-DATA-MODEL.md §10 and §2:
- Trusting the algorithm declared in the JWT header exposes the system to `alg: none` and algorithm-substitution attacks (e.g. HS512/RS256 key confusion).
- Expiration check must treat `exp === now` as expired (half-open window `[iat, exp)`).
- Comparing signatures using `===` or `==` introduces timing side-channels; using `timingSafeEqual` over fixed-length buffers prevents timing attacks.
- Access tokens convey identity inputs (`sub`, `org`, `role`, `pv`), not resolved permissions, ensuring that permission changes (which bump `pv`) immediately trigger re-authentication via `TOKEN_STALE` without relying on long-lived client tokens.
- Running `node scripts/check-jwt.js` verifies all 43 test cases including malformed tokens, algorithm confusion, invalid signatures, expired tokens, missing/bad claims, and opaque refresh tokens.

### What I rejected

- Trusting JWT header `alg` dynamically or relying on third-party JWT libraries that could permit algorithm switching or permissive claim parsing.
- Treating JWT roles directly as authorization capabilities without per-request membership and permission resolution.
- Permitting non-object payloads or headers.

### What would change my mind

If asymmetric token signing (e.g., RS256/EdDSA) is required in a multi-service federated architecture with separate identity providers, algorithm pinning would need to support specified public key schemes, but for RemoteOps' single-service HMAC design, pinning strictly to HS256 is the safest and most minimal architecture.