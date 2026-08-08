/**
 * Reset one-shot du mot de passe fondateur.
 * Usage:
 *   ADMIN_SEED_PASSWORD='...' npx tsx scripts/reset-founder-password.ts
 * Préfère .env.local (Neon) à .env (Docker local).
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

// Avant tout import Prisma (sinon .env localhost écrase Neon)
loadEnvFile(".env");
loadEnvFile(".env.local", true);

// Toujours le compte fondateur — pas ADMIN_EMAILS (peut être le démo local).
const EMAIL = (process.env.FOUNDER_EMAIL || "reeegency@gmail.com")
  .trim()
  .toLowerCase();

const password = process.env.ADMIN_SEED_PASSWORD;
if (!password || password.length < 8) {
  console.error("Set ADMIN_SEED_PASSWORD (8+ chars).");
  process.exit(1);
}

async function main() {
  const { default: bcrypt } = await import("bcryptjs");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const host = (() => {
      try {
        return new URL(process.env.DATABASE_URL || "").hostname;
      } catch {
        return "?";
      }
    })();
    console.log(`DB host: ${host}`);

    // Raw SQL : évite les colonnes schema absentes en prod (ex. User.role).
    const passwordHash = await bcrypt.hash(password, 10);
    const updated = await prisma.$executeRaw`
      UPDATE "User"
      SET "passwordHash" = ${passwordHash}
      WHERE lower(email) = ${EMAIL}
    `;
    if (!updated) {
      console.error(`User not found: ${EMAIL}`);
      process.exit(1);
    }
    console.log(`OK — password reset for ${EMAIL}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(String(e?.message || e).slice(0, 400));
  process.exit(1);
});
