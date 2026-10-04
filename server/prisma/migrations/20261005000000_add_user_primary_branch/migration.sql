-- AlterTable: each login account has one designated (primary) shop.
-- `primaryBranchId` decides which branch the app opens after login; fallback
-- remains the user's first branch when it is NULL.
ALTER TABLE "users" ADD COLUMN "primaryBranchId" TEXT;

-- AddForeignKey
ALTER TABLE "users"
  ADD CONSTRAINT "users_primaryBranchId_fkey"
  FOREIGN KEY ("primaryBranchId") REFERENCES "branches"("_id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- AddIndex
CREATE INDEX "users_primaryBranchId_idx" ON "users"("primaryBranchId");