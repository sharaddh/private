# Memory

## Auth & branch scope
- All login services (loginUser/staffLogin/warehouseLogin in server/src/services/auth.service.ts) MUST `include: { branches: true }` in the User.findFirst so the response carries `branchId` — the client persists it before navigation and will otherwise 500 "Missing branch scope" on the first post-login page (2026-09-08)
- `User` model uses `id`; Mongo-compat `_id` is aliased by the response serializer — code reading `user.branches[0]._id` depends on that alias (2026-09-08)
- Uncommitted local change: server/src/middleware/rateLimitStore.ts adds a Redis `isConnected()` fallback; it breaks rateLimitStore.test.ts (4 failures) in a no-Redis env. Not an open issue — pre-existing workspace change (2026-09-08)
