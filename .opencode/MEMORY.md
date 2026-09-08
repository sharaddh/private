# Memory

## Auth & branch scope
- All login services (loginUser/staffLogin/warehouseLogin in server/src/services/auth.service.ts) MUST `include: { branches: true }` in the User.findFirst so the response carries `branchId` — the client persists it before navigation and will otherwise 500 "Missing branch scope" on the first post-login page (2026-09-08)
- `User` model uses `id`; Mongo-compat `_id` is aliased by the response serializer — code reading `user.branches[0]._id` depends on that alias (2026-09-08)
- `opencode-skills/` is a standalone clone of `osmontero/opencode-skills.git` (own `.git`, own remote) and is gitignored — never `git add` it, gitlink would be broken (2026-09-08)
- `order.create` on the workspace transaction needs `stockItems` wrapped as `{ create: [...] }` (client sends a flat `[{sku, quantity}]` array); `decrementStockForOrder` must get the raw `body.order`, not the created row (Prisma omits relations unless `include`d) (2026-09-08)
