/**
 * Ajoute User.role si manquant + marque le fondateur FOUNDER.
 * Préfère .env.local (Neon).
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvFile(name: string, override = false) {
  const path = resolve(process.cwd(), name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const m = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (override || !process.env[m[1]]) process.env[m[1]] = v;
  }
}

loadEnvFile(".env");
loadEnvFile(".env.local", true);

const EMAIL = (process.env.FOUNDER_EMAIL || "reeegency@gmail.com")
  .trim()
  .toLowerCase();

async function main() {
  const { PrismaClient } = await import("@prisma/client");
  const p = new PrismaClient();
  try {
    await p.$executeRawUnsafe(`
      DO $$ BEGIN
        CREATE TYPE "UserRole" AS ENUM ('MEMBER', 'MANAGER', 'FOUNDER');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `);
    await p.$executeRawUnsafe(`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'MEMBER';
    `);
    await p.$executeRaw`
      UPDATE "User"
      SET role = 'FOUNDER'::"UserRole"
      WHERE lower(email) = ${EMAIL}
    `;
    console.log(`OK — role column ready, ${EMAIL} = FOUNDER`);
  } finally {
    await p.$disconnect();
  }
}

main().catch((e) => {
  console.error(String(e?.message || e).slice(0, 500));
  process.exit(1);
});
