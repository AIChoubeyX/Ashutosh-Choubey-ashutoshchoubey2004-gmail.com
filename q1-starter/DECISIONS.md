# Decisions

## Decision: Use fileURLToPath for database fixture paths on Windows

### Chosen

Use Node.js `fileURLToPath()` when converting the `file:` URL used by `scripts/load-db.js` into a filesystem path.

### Why

The existing implementation used:

```js
new URL(p, import.meta.url).pathname