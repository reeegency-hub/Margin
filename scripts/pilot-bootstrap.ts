/**
 * Bootstrap pilote 1 client : magasin + catalogue + vente test.
 * Usage (prod Neon via .env.neon) :
 *   set -a && source .env.neon && set +a
 *   export DIRECT_URL=... DATABASE_URL=...
 *   npx tsx scripts/pilot-bootstrap.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { recordSale } from "../src/lib/stock-engine";

const prisma = new PrismaClient();

const CLIENT = {
  name: "Épicerie Pilote Margin",
  email: "pilote@marginshop.app",
  password: "PiloteMargin2026!",
  whatsapp: null as string | null,
};

async function main() {
  // Upsert client
  let user = await prisma.user.findUnique({
    where: { email: CLIENT.email },
    include: { restaurant: true },
  });

  let restaurantId: string;
  if (user) {
    restaurantId = user.restaurantId;
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        name: CLIENT.name,
        plan: "commerce",
        billingPeriod: "monthly",
        stripeStatus: "none",
        active: true,
        onboardingCompletedAt: new Date(),
        procurementMode: "mixed",
      },
    });
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await bcrypt.hash(CLIENT.password, 10) },
    });
    console.log("Client existant réinitialisé:", CLIENT.email);
  } else {
    const restaurant = await prisma.restaurant.create({
      data: {
        name: CLIENT.name,
        timezone: "Europe/Paris",
        whatsappTo: CLIENT.whatsapp,
        plan: "commerce",
        billingPeriod: "monthly",
        stripeStatus: "none",
        active: true,
        onboardingCompletedAt: new Date(),
        procurementMode: "mixed",
      },
    });
    restaurantId = restaurant.id;
    await prisma.user.create({
      data: {
        email: CLIENT.email,
        name: "Gérant pilote",
        passwordHash: await bcrypt.hash(CLIENT.password, 10),
        restaurantId,
      },
    });
    for (const platform of ["uber_eats", "deliveroo"] as const) {
      await prisma.deliveryPlatformConnection.create({
        data: {
          restaurantId,
          platform,
          status: "DISCONNECTED",
          webhookSecret: `whsec_${Math.random().toString(36).slice(2)}`,
        },
      });
    }
    console.log("Client créé:", CLIENT.email);
  }

  // Clean prior catalog for this restaurant (idempotent re-run)
  await prisma.saleItem.deleteMany({
    where: { sale: { restaurantId } },
  });
  await prisma.sale.deleteMany({ where: { restaurantId } });
  await prisma.stockMovement.deleteMany({ where: { restaurantId } });
  await prisma.recipeIngredient.deleteMany({
    where: { dish: { restaurantId } },
  });
  await prisma.dish.deleteMany({ where: { restaurantId } });
  await prisma.ingredient.deleteMany({ where: { restaurantId } });

  const catalog = [
    { name: "Lait 1L", unit: "pcs", stock: 24, threshold: 8, price: 1.2 },
    { name: "Pain baguette", unit: "pcs", stock: 30, threshold: 10, price: 1.1 },
    { name: "Œufs x6", unit: "pcs", stock: 18, threshold: 6, price: 2.4 },
    { name: "Eau 1,5L", unit: "pcs", stock: 40, threshold: 12, price: 0.6 },
    { name: "Café 250g", unit: "pcs", stock: 14, threshold: 5, price: 3.9 },
    { name: "Beurre 250g", unit: "pcs", stock: 16, threshold: 6, price: 2.1 },
    { name: "Yaourt nature x4", unit: "pcs", stock: 20, threshold: 8, price: 1.8 },
    { name: "Fromage râpé 200g", unit: "pcs", stock: 12, threshold: 4, price: 2.5 },
    { name: "Jambon blanc 4tr", unit: "pcs", stock: 10, threshold: 4, price: 3.2 },
    { name: "Poulet rôti", unit: "pcs", stock: 8, threshold: 3, price: 8.9 },
    { name: "Tomates 1kg", unit: "pcs", stock: 15, threshold: 5, price: 2.9 },
    { name: "Bananes 1kg", unit: "pcs", stock: 12, threshold: 4, price: 1.9 },
    { name: "Pommes Golden 1kg", unit: "pcs", stock: 14, threshold: 5, price: 2.2 },
    { name: "Carottes 1kg", unit: "pcs", stock: 18, threshold: 6, price: 1.5 },
    { name: "Pommes de terre 2kg", unit: "pcs", stock: 10, threshold: 3, price: 2.8 },
    { name: "Riz 1kg", unit: "pcs", stock: 22, threshold: 8, price: 1.7 },
    { name: "Pâtes 500g", unit: "pcs", stock: 28, threshold: 10, price: 1.1 },
    { name: "Farine 1kg", unit: "pcs", stock: 16, threshold: 6, price: 1.0 },
    { name: "Sucre 1kg", unit: "pcs", stock: 20, threshold: 7, price: 1.3 },
    { name: "Huile tournesol 1L", unit: "pcs", stock: 14, threshold: 5, price: 2.6 },
    { name: "Sel fin 1kg", unit: "pcs", stock: 25, threshold: 8, price: 0.8 },
    { name: "Poivre moulu", unit: "pcs", stock: 18, threshold: 6, price: 1.4 },
    { name: "Conserve tomates", unit: "pcs", stock: 30, threshold: 10, price: 1.2 },
    { name: "Thon conserve", unit: "pcs", stock: 22, threshold: 8, price: 1.9 },
    { name: "Coca 33cl", unit: "pcs", stock: 48, threshold: 16, price: 1.0 },
    { name: "Jus d’orange 1L", unit: "pcs", stock: 16, threshold: 6, price: 2.3 },
    { name: "Lessive 1,5L", unit: "pcs", stock: 9, threshold: 3, price: 6.5 },
    { name: "Papier toilette x6", unit: "pcs", stock: 14, threshold: 5, price: 3.8 },
    { name: "Savon mains", unit: "pcs", stock: 20, threshold: 7, price: 1.6 },
    { name: "Chips nature", unit: "pcs", stock: 26, threshold: 9, price: 1.5 },
  ];

  const dishes: { id: string; name: string; stockBefore: number }[] = [];

  for (const row of catalog) {
    const ing = await prisma.ingredient.create({
      data: {
        restaurantId,
        name: row.name,
        unit: row.unit,
        stockTheoretical: row.stock,
        criticalThreshold: row.threshold,
        reorderQty: row.threshold * 3,
      },
    });
    const dish = await prisma.dish.create({
      data: {
        restaurantId,
        name: row.name,
        salePrice: row.price,
        active: true,
        ingredients: {
          create: [{ ingredientId: ing.id, quantity: 1, unit: row.unit }],
        },
      },
    });
    dishes.push({ id: dish.id, name: row.name, stockBefore: row.stock });
  }

  const target = dishes[0]!;
  await recordSale(restaurantId, [{ dishId: target.id, quantity: 2 }], {
    channel: "dine_in",
    externalOrderId: `PILOT-TEST-${Date.now()}`,
  });

  const after = await prisma.ingredient.findFirst({
    where: { restaurantId, name: target.name },
  });
  const expected = target.stockBefore - 2;
  const ok = after?.stockTheoretical === expected;

  console.log("");
  console.log("=== PILOTE PRÊT ===");
  console.log(`URL      : https://margin-shop.vercel.app/login`);
  console.log(`Magasin  : ${CLIENT.name}`);
  console.log(`Email    : ${CLIENT.email}`);
  console.log(`Password : ${CLIENT.password}`);
  console.log(`Plan     : Commerce · actif · onboarding skip`);
  console.log(`Catalogue: ${catalog.length} produits`);
  console.log(
    `Vente    : 2× ${target.name} → stock ${target.stockBefore} → ${after?.stockTheoretical} ${ok ? "OK" : "FAIL"}`
  );
  console.log(`WhatsApp : non branché (alertes dans l’app)`);
  if (!ok) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
