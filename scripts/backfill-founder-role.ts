/**
 * Backfill User.role = FOUNDER pour les emails admin historiques.
 * Usage: npx tsx scripts/backfill-founder-role.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const fromEnv = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const founder = (process.env.FOUNDER_EMAIL || "reeegency@gmail.com")
    .trim()
    .toLowerCase();
  const emails = Array.from(new Set([founder, ...fromEnv]));

  const result = await prisma.user.updateMany({
    where: { email: { in: emails } },
    data: { role: "FOUNDER" },
  });

  console.log(
    JSON.stringify({
      ok: true,
      updated: result.count,
      emailsCount: emails.length,
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
