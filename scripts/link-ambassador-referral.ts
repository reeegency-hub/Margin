/**
 * Lie un magasin existant à un ambassadeur (commission sur dernière facture Stripe).
 *
 * Usage:
 *   npx tsx scripts/link-ambassador-referral.ts --ambassador-email "amb@example.com" --restaurant-id "clxxx..." --commission 15
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i < 0) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const ambassadorEmail = arg("--ambassador-email")?.toLowerCase();
  const restaurantId = arg("--restaurant-id");
  const commissionRaw = arg("--commission") ?? "15";
  const commissionPercent = Number.parseInt(commissionRaw, 10);

  if (!ambassadorEmail || !restaurantId || Number.isNaN(commissionPercent)) {
    console.error(
      `Usage: npx tsx scripts/link-ambassador-referral.ts --ambassador-email "..." --restaurant-id "..." [--commission 15]`
    );
    process.exit(1);
  }

  const ambassador = await prisma.ambassador.findUnique({
    where: { email: ambassadorEmail },
  });
  if (!ambassador) {
    console.error(`Ambassadeur introuvable: ${ambassadorEmail}`);
    process.exit(1);
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true },
  });
  if (!restaurant) {
    console.error(`Magasin introuvable: ${restaurantId}`);
    process.exit(1);
  }

  const existing = await prisma.ambassadorReferral.findUnique({
    where: { restaurantId },
    include: { ambassador: { select: { email: true } } },
  });
  if (existing && existing.ambassadorId !== ambassador.id) {
    console.error(
      `Ce magasin est déjà lié à ${existing.ambassador.email}. Supprimez d'abord le lien existant.`
    );
    process.exit(1);
  }

  const referral = await prisma.ambassadorReferral.upsert({
    where: { restaurantId },
    create: {
      ambassadorId: ambassador.id,
      restaurantId,
      commissionPercent,
    },
    update: { commissionPercent },
  });

  console.log("Lien ambassadeur ↔ magasin enregistré.");
  console.log(`  Ambassadeur : ${ambassador.name} (${ambassador.email})`);
  console.log(`  Magasin     : ${restaurant.name} (${restaurant.id})`);
  console.log(`  Commission  : ${referral.commissionPercent} %`);
  console.log(
    `  Note        : la commission estimée se met à jour après invoice.payment_succeeded Stripe.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
