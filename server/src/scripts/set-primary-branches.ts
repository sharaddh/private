import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";

dotenv.config();

const prisma = new PrismaClient();

/**
 * One-time operational script: assigns each login account its fixed shop.
 *
 * Matches the production owner accounts the app currently ships with:
 *   mayank  -> Anand Nagar
 *   bablu   -> DD Nagar
 *   rajesh  -> Thatipur
 *   hariom  -> Falka bajar
 *   prakash -> Govindpuri
 *
 * Later logins (owner or staff) open the app on `primaryBranchId` instead of
 * the account's first branch. Run with: npm run set-primary-branches
 */
const MAPPING: Record<string, string> = {
  mayank: "Anand Nagar",
  bablu: "DD Nagar",
  rajesh: "Thatipur",
  hariom: "Falka bajar",
  prakash: "Govindpuri",
};

async function main() {
  const users = await prisma.user.findMany({
    where: { username: { in: Object.keys(MAPPING) } },
    include: { branches: true },
  });

  let updated = 0;
  for (const user of users) {
    const branchName = MAPPING[user.username];
    const branch = user.branches.find((b) => b.name === branchName) || null;
    if (!branch) {
      console.warn(`[skip] ${user.username}: no branch named "${branchName}" in account`);
      continue;
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { primaryBranchId: branch.id },
    });
    console.log(`[ok] ${user.username} -> ${branch.name} (${branch.id})`);
    updated += 1;
  }

  console.log(`Done. Updated ${updated}/${users.length} accounts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());