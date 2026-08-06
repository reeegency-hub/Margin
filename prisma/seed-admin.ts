/**
 * Seed admin minimal — production / Supabase (pas de magasin démo).
 * Usage: npm run db:seed:admin
 *
 * Crée un restaurant "Margin Ops" + user ADMIN_EMAILS[0] / mot de passe
 * ADMIN_SEED_PASSWORD (défaut: change-me-now).
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAILS || "ops@marginshop.app")
    .split(",")[0]
    .trim()
    .toLowerCase();
  const password = process.env.ADMIN_SEED_PASSWORD || "change-me-now";

  let restaurant = await prisma.restaurant.findFirst({
    where: { name: "Margin Ops" },
  });
  if (!restaurant) {
    restaurant = await prisma.restaurant.create({
      data: {
        name: "Margin Ops",
        timezone: "Europe/Paris",
        plan: "reseau",
        billingPeriod: "monthly",
        stripeStatus: "none",
        active: true,
        onboardingCompletedAt: new Date(),
        procurementMode: "mixed",
      },
    });
  }

  const hash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: { passwordHash: hash, restaurantId: restaurant.id, name: "Ops Margin" },
    });
  } else {
    await prisma.user.create({
      data: {
        email,
        name: "Ops Margin",
        passwordHash: hash,
        restaurantId: restaurant.id,
      },
    });
  }

  console.log("Admin seed OK");
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${password}`);
  console.log("  Changez le mot de passe après la première connexion.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
