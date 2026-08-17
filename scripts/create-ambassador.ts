/**
 * Crée un compte ambassadeur (identité séparée de User / commerce).
 *
 * Usage:
 *   npx tsx scripts/create-ambassador.ts --name "Prénom Nom" --email "amb@example.com" --password "MotDePasseFort!"
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const name = arg("--name");
  const email = arg("--email")?.toLowerCase();
  const password = arg("--password");

  if (!name || !email || !password) {
    console.error(
      `Usage: npx tsx scripts/create-ambassador.ts --name "..." --email "..." --password "..."`
    );
    process.exit(1);
  }

  const existing = await prisma.ambassador.findUnique({ where: { email } });
  if (existing) {
    console.error(`Email ambassadeur déjà utilisé: ${email}`);
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const ambassador = await prisma.ambassador.create({
    data: { name, email, passwordHash },
  });

  console.log("Ambassadeur créé.");
  console.log(`  ID    : ${ambassador.id}`);
  console.log(`  Nom   : ${ambassador.name}`);
  console.log(`  Email : ${email}`);
  console.log(`  Login : https://margin-shop.vercel.app/partner/login`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
