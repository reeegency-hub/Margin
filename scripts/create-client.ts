/**
 * Crée un commerce client SANS toucher à la démo Épicerie du Marché.
 *
 * Usage:
 *   npx tsx scripts/create-client.ts --name "Épicerie Bellevue" --email "gerant@epicerie-bellevue.fr" --password "MotDePasseFort!"
 *
 * Options:
 *   --whatsapp +336...
 *   --skip-onboarding   (déconseillé pour un vrai client)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

function has(flag: string) {
  return process.argv.includes(flag);
}

async function main() {
  const name = arg("--name");
  const email = arg("--email")?.toLowerCase();
  const password = arg("--password");
  const whatsapp = arg("--whatsapp") || null;
  const skipOnboarding = has("--skip-onboarding");

  if (!name || !email || !password) {
    console.error(
      `Usage: npx tsx scripts/create-client.ts --name "..." --email "..." --password "..." [--whatsapp +336...]`
    );
    process.exit(1);
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.error(`Email déjà utilisé: ${email}`);
    process.exit(1);
  }

  const restaurant = await prisma.restaurant.create({
    data: {
      name,
      timezone: "Europe/Paris",
      whatsappTo: whatsapp,
      onboardingCompletedAt: skipOnboarding ? new Date() : null,
      procurementMode: skipOnboarding ? "mixed" : null,
    },
  });

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: {
      email,
      name: "Gérant",
      passwordHash,
      restaurantId: restaurant.id,
    },
  });

  // Ensure platform rows exist as DISCONNECTED
  for (const platform of ["uber_eats", "deliveroo", "just_eat", "other"]) {
    await prisma.deliveryPlatformConnection.create({
      data: {
        restaurantId: restaurant.id,
        platform,
        status: "DISCONNECTED",
        webhookSecret: `whsec_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`,
      },
    });
  }

  console.log("Client créé (démo intacte).");
  console.log(`  Commerce   : ${restaurant.name} (${restaurant.id})`);
  console.log(`  Login      : ${email} / ${password}`);
  console.log(
    `  Onboarding : ${skipOnboarding ? "skippé" : "requis au premier login"}`
  );
  console.log("");
  console.log("Checklist demain :");
  console.log("  1. Twilio + ngrok + WEBHOOK_BASE_URL");
  console.log("  2. Login client → onboarding (prénoms, produits, WhatsApp)");
  console.log("  3. Stock : renseigner stock actuel + seuils critiques");
  console.log("  4. Caisses : créer POS → copier secret affiché une fois");
  console.log(
    "  5. Livraison (optionnel) : webhook générique /api/webhooks/delivery/{platform}"
  );
  console.log("  6. Backup : cp prisma/dev.db backups/dev-$(date +%F).db");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
