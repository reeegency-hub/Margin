import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import {
  addDays,
  startOfDay,
  setHours,
  setMinutes,
  subDays,
} from "date-fns";

const prisma = new PrismaClient();

function dayAt(base: Date, offset: number, hour: number, minute = 0) {
  return setMinutes(setHours(startOfDay(addDays(base, offset)), hour), minute);
}

async function main() {
  // Clear in dependency order
  await prisma.whatsAppActionLog.deleteMany();
  await prisma.whatsAppSession.deleteMany();
  await prisma.posPendingProduct.deleteMany();
  await prisma.deliveryAssignment.deleteMany();
  await prisma.deliveryOrder.deleteMany();
  await prisma.deliveryDriver.deleteMany();
  await prisma.externalPosConnection.deleteMany();
  await prisma.platformOutage.deleteMany();
  await prisma.deliveryPlatformConnection.deleteMany();
  await prisma.commissionRule.deleteMany();
  await prisma.performanceSnapshot.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.inventoryCountLine.deleteMany();
  await prisma.inventoryCount.deleteMany();
  await prisma.purchaseOrderLine.deleteMany();
  await prisma.purchaseOrder.deleteMany();
  await prisma.supplierCatalogItem.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.saleItem.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.supplierReceiptLine.deleteMany();
  await prisma.supplierReceipt.deleteMany();
  await prisma.productStock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.stockUnit.deleteMany();
  await prisma.kiosk.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.user.deleteMany();
  await prisma.restaurant.deleteMany();

  // "Restaurant" = le commerce dans le modèle de données (nom technique conservé).
  const shop = await prisma.restaurant.create({
    data: {
      name: "Épicerie du Marché",
      timezone: "Europe/Paris",
      whatsappTo: null,
      procurementMode: "self_shop",
      staffSalle: 1,
      staffCuisine: 1,
      staffLivreur: 1,
      plan: "commerce",
      billingPeriod: "monthly",
      stripeStatus: "none",
      active: true,
      onboardingCompletedAt: new Date(),
    },
  });

  const passwordHash = await bcrypt.hash("marginshop2026", 10);
  await prisma.user.create({
    data: {
      email: "gerant@marginshop.app",
      name: "Gérant",
      passwordHash,
      restaurantId: shop.id,
    },
  });

  const grossiste = await prisma.supplier.create({
    data: {
      restaurantId: shop.id,
      name: "Grossiste Nord",
      contact: "+33640000001",
      deliveryDays: JSON.stringify([1, 3, 5]),
      avgDeliveryDelayHours: 18,
      reliabilityScore: 0.92,
    },
  });

  const primeur = await prisma.supplier.create({
    data: {
      restaurantId: shop.id,
      name: "Primeur du Coin",
      contact: "+33612000002",
      deliveryDays: JSON.stringify([1, 2, 4, 5]),
      avgDeliveryDelayHours: 12,
      reliabilityScore: 0.9,
    },
  });

  const droguerie = await prisma.supplier.create({
    data: {
      restaurantId: shop.id,
      name: "Droguerie Pro",
      contact: "+33640000003",
      deliveryDays: JSON.stringify([2, 4]),
      avgDeliveryDelayHours: 24,
      reliabilityScore: 0.93,
    },
  });

  // Produits (= StockUnit techniquement : la référence de stock).
  const lait = await prisma.stockUnit.create({
    data: {
      restaurantId: shop.id,
      name: "Lait demi-écrémé 1L",
      unit: "pcs",
      stockTheoretical: 10,
      criticalThreshold: 12,
      reorderQty: 48,
    },
  });
  const tomates = await prisma.stockUnit.create({
    data: {
      restaurantId: shop.id,
      name: "Tomates",
      unit: "g",
      stockTheoretical: 3000,
      criticalThreshold: 2000,
      reorderQty: 8000,
    },
  });
  const pain = await prisma.stockUnit.create({
    data: {
      restaurantId: shop.id,
      name: "Pain (baguette)",
      unit: "pcs",
      stockTheoretical: 15,
      criticalThreshold: 10,
      reorderQty: 40,
    },
  });
  const oeufs = await prisma.stockUnit.create({
    data: {
      restaurantId: shop.id,
      name: "Œufs x6",
      unit: "pcs",
      stockTheoretical: 20,
      criticalThreshold: 15,
      reorderQty: 50,
    },
  });
  const lessive = await prisma.stockUnit.create({
    data: {
      restaurantId: shop.id,
      name: "Lessive 1,5L",
      unit: "pcs",
      stockTheoretical: 10,
      criticalThreshold: 6,
      reorderQty: 24,
    },
  });
  const farine = await prisma.stockUnit.create({
    data: {
      restaurantId: shop.id,
      name: "Farine 1kg",
      unit: "pcs",
      stockTheoretical: 12,
      criticalThreshold: 8,
      reorderQty: 30,
    },
  });
  const cafe = await prisma.stockUnit.create({
    data: {
      restaurantId: shop.id,
      name: "Café moulu 250g",
      unit: "pcs",
      stockTheoretical: 14,
      criticalThreshold: 8,
      reorderQty: 30,
    },
  });
  const papier = await prisma.stockUnit.create({
    data: {
      restaurantId: shop.id,
      name: "Papier toilette x6",
      unit: "pcs",
      stockTheoretical: 8,
      criticalThreshold: 5,
      reorderQty: 20,
    },
  });

  // Comparatif multi-fournisseurs (mêmes références chez plusieurs fournisseurs)
  await prisma.supplierCatalogItem.createMany({
    data: [
      { supplierId: grossiste.id, stockUnitId: lait.id, price: 0.95, unit: "pcs", minOrderQty: 12 },
      { supplierId: grossiste.id, stockUnitId: pain.id, price: 0.42, unit: "pcs", minOrderQty: 20 },
      { supplierId: grossiste.id, stockUnitId: oeufs.id, price: 1.6, unit: "pcs", minOrderQty: 10 },
      { supplierId: grossiste.id, stockUnitId: farine.id, price: 1.1, unit: "pcs", minOrderQty: 6 },
      { supplierId: grossiste.id, stockUnitId: cafe.id, price: 2.6, unit: "pcs", minOrderQty: 6 },
      { supplierId: grossiste.id, stockUnitId: lessive.id, price: 6.2, unit: "pcs", minOrderQty: 6 },
      { supplierId: primeur.id, stockUnitId: tomates.id, price: 2.1, unit: "kg", minOrderQty: 1 },
      { supplierId: droguerie.id, stockUnitId: lessive.id, price: 5.5, unit: "pcs", minOrderQty: 6 },
      { supplierId: droguerie.id, stockUnitId: papier.id, price: 3.1, unit: "pcs", minOrderQty: 4 },
    ],
  });

  // Fiches produit vendues (= Product techniquement). Pas de "recette" cuisine :
  // chaque produit consomme sa propre référence de stock, en 1 pour 1.
  const dLait = await prisma.product.create({
    data: {
      restaurantId: shop.id,
      name: "Lait demi-écrémé 1L",
      salePrice: 1.2,
      productStocks: { create: [{ stockUnitId: lait.id, quantity: 1, unit: "pcs" }] },
    },
  });
  const dTomates = await prisma.product.create({
    data: {
      restaurantId: shop.id,
      name: "Tomates (le kg)",
      salePrice: 2.9,
      productStocks: { create: [{ stockUnitId: tomates.id, quantity: 1000, unit: "g" }] },
    },
  });
  const dPain = await prisma.product.create({
    data: {
      restaurantId: shop.id,
      name: "Pain (baguette)",
      salePrice: 1.0,
      productStocks: { create: [{ stockUnitId: pain.id, quantity: 1, unit: "pcs" }] },
    },
  });
  const dOeufs = await prisma.product.create({
    data: {
      restaurantId: shop.id,
      name: "Œufs x6",
      salePrice: 2.5,
      productStocks: { create: [{ stockUnitId: oeufs.id, quantity: 1, unit: "pcs" }] },
    },
  });
  const dLessive = await prisma.product.create({
    data: {
      restaurantId: shop.id,
      name: "Lessive 1,5L",
      salePrice: 6.9,
      productStocks: { create: [{ stockUnitId: lessive.id, quantity: 1, unit: "pcs" }] },
    },
  });
  await prisma.product.create({
    data: {
      restaurantId: shop.id,
      name: "Farine 1kg",
      salePrice: 1.8,
      productStocks: { create: [{ stockUnitId: farine.id, quantity: 1, unit: "pcs" }] },
    },
  });
  await prisma.product.create({
    data: {
      restaurantId: shop.id,
      name: "Café moulu 250g",
      salePrice: 3.5,
      productStocks: { create: [{ stockUnitId: cafe.id, quantity: 1, unit: "pcs" }] },
    },
  });
  await prisma.product.create({
    data: {
      restaurantId: shop.id,
      name: "Papier toilette x6",
      salePrice: 4.2,
      productStocks: { create: [{ stockUnitId: papier.id, quantity: 1, unit: "pcs" }] },
    },
  });

  const now = new Date();
  const yesterday = subDays(now, 1);

  await prisma.sale.create({
    data: {
      restaurantId: shop.id,
      soldAt: yesterday,
      totalAmount: 12.6,
      channel: "dine_in",
      items: {
        create: [
          { productId: dLait.id, quantity: 2, unitPrice: 1.2 },
          { productId: dPain.id, quantity: 3, unitPrice: 1.0 },
          { productId: dOeufs.id, quantity: 1, unitPrice: 2.5 },
          { productId: dTomates.id, quantity: 1, unitPrice: 2.9 },
        ],
      },
    },
  });

  // Employees — 1 caissière, 1 vendeur rayon, 1 livreur (optionnel)
  const julie = await prisma.employee.create({
    data: {
      restaurantId: shop.id,
      name: "Julie Caron",
      role: "salle",
      hourlyRate: 12.5,
      certifications: JSON.stringify([]),
      active: true,
    },
  });
  const amadou = await prisma.employee.create({
    data: {
      restaurantId: shop.id,
      name: "Amadou Diallo",
      role: "cuisine",
      hourlyRate: 13.0,
      certifications: JSON.stringify(["HACCP"]),
      active: true,
    },
  });
  const karim = await prisma.employee.create({
    data: {
      restaurantId: shop.id,
      name: "Karim Benali",
      role: "livreur",
      hourlyRate: 12.0,
      certifications: JSON.stringify([]),
      active: true,
    },
  });

  const today = startOfDay(now);
  const employees = [julie, amadou, karim];

  for (let d = 0; d < 7; d++) {
    const date = addDays(today, d - 1);
    const isSunday = date.getDay() === 0;

    await prisma.shift.create({
      data: {
        employeeId: julie.id,
        date,
        startTime: "08:00",
        endTime: "13:00",
        role: "salle",
        status: "PUBLISHED",
      },
    });

    await prisma.shift.create({
      data: {
        employeeId: amadou.id,
        date,
        startTime: "08:00",
        endTime: "13:00",
        role: "cuisine",
        status: "PUBLISHED",
      },
    });

    // Dimanche : livraison optionnelle à l'arrêt
    if (!isSunday) {
      await prisma.shift.create({
        data: {
          employeeId: karim.id,
          date,
          startTime: "10:00",
          endTime: "14:00",
          role: "livreur",
          status: "PUBLISHED",
        },
      });
    }
  }

  // Today's attendances
  const todayShifts = await prisma.shift.findMany({
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      date: { gte: today, lt: addDays(today, 1) },
    },
    include: { employee: true },
  });

  for (const shift of todayShifts) {
    const late = shift.employeeId === karim.id ? 8 : 0;
    const [h, m] = shift.startTime.split(":").map(Number);
    const clockIn = dayAt(today, 0, h, m + late);
    await prisma.attendance.create({
      data: {
        employeeId: shift.employeeId,
        shiftId: shift.id,
        status: late > 0 ? "LATE" : "PRESENT",
        clockIn,
        lateMinutes: late,
      },
    });
  }

  await prisma.performanceSnapshot.createMany({
    data: [
      {
        employeeId: julie.id,
        periodStart: subDays(today, 7),
        periodEnd: today,
        salesAmount: 2100,
        avgTicket: 8.4,
        errorCount: 0,
      },
      {
        employeeId: amadou.id,
        periodStart: subDays(today, 7),
        periodEnd: today,
        salesAmount: 0,
        avgTicket: 0,
        errorCount: 0,
      },
    ],
  });

  // Caisses (kiosques internes)
  const caisse1 = await prisma.kiosk.create({
    data: {
      restaurantId: shop.id,
      name: "Caisse 1",
      locationLabel: "Entrée boutique",
      status: "ONLINE",
      lastSeenAt: now,
    },
  });
  await prisma.kiosk.create({
    data: {
      restaurantId: shop.id,
      name: "Caisse libre-service",
      locationLabel: "Fond de magasin",
      status: "OFFLINE",
      lastSeenAt: subDays(now, 1),
    },
  });

  await prisma.sale.create({
    data: {
      restaurantId: shop.id,
      soldAt: now,
      totalAmount: 1.2,
      channel: "kiosk",
      kioskId: caisse1.id,
      items: {
        create: [{ productId: dLait.id, quantity: 1, unitPrice: 1.2 }],
      },
    },
  });

  // Livraison — fonctionnalité optionnelle, désactivée par défaut pour un petit commerce
  await prisma.commissionRule.createMany({
    data: [
      { restaurantId: shop.id, platform: "deliveroo", percent: 30, payoutDelayDays: 7 },
      { restaurantId: shop.id, platform: "uber_eats", percent: 28, payoutDelayDays: 14 },
      { restaurantId: shop.id, platform: "just_eat", percent: 25, payoutDelayDays: 7 },
    ],
  });

  await prisma.deliveryPlatformConnection.createMany({
    data: [
      {
        restaurantId: shop.id,
        platform: "deliveroo",
        status: "DISCONNECTED",
        commissionPercent: 30,
        payoutDelayDays: 7,
        lastSyncAt: null,
      },
      {
        restaurantId: shop.id,
        platform: "uber_eats",
        status: "DISCONNECTED",
        commissionPercent: 28,
        payoutDelayDays: 14,
        lastSyncAt: null,
      },
      {
        restaurantId: shop.id,
        platform: "just_eat",
        status: "DISCONNECTED",
        commissionPercent: 25,
        payoutDelayDays: 7,
        lastSyncAt: null,
      },
    ],
  });

  await prisma.deliveryDriver.create({
    data: {
      restaurantId: shop.id,
      name: "Karim Benali",
      phone: "+33600000001",
      whatsappOptIn: true,
      isActive: true,
    },
  });

  await prisma.externalPosConnection.create({
    data: {
      restaurantId: shop.id,
      name: "Caisse externe démo",
      vendor: "custom",
      webhookSecret: "demo-pos-secret-change-me",
      status: "PENDING",
    },
  });

  // Purchase orders to validate
  await prisma.purchaseOrder.create({
    data: {
      restaurantId: shop.id,
      supplierId: primeur.id,
      status: "TO_VALIDATE",
      totalAmount: 10.5,
      proposedAt: now,
      lines: {
        create: [
          {
            stockUnitId: tomates.id,
            quantity: 5000,
            unitPrice: 2.1,
            chosenReason: "Meilleur prix/kg chez Primeur du Coin.",
          },
        ],
      },
    },
  });

  await prisma.purchaseOrder.create({
    data: {
      restaurantId: shop.id,
      supplierId: droguerie.id,
      status: "TO_VALIDATE",
      totalAmount: 33.0,
      proposedAt: now,
      lines: {
        create: [
          {
            stockUnitId: lessive.id,
            quantity: 6,
            unitPrice: 5.5,
            chosenReason: "Meilleur prix (5,50 € vs 6,20 € Grossiste Nord).",
          },
        ],
      },
    },
  });

  // Inventory draft
  await prisma.inventoryCount.create({
    data: {
      restaurantId: shop.id,
      status: "DRAFT",
      note: "Vérification hebdomadaire",
      lines: {
        create: [
          {
            stockUnitId: lait.id,
            theoreticalQty: 10,
            countedQty: 8,
            varianceQty: -2,
          },
          {
            stockUnitId: tomates.id,
            theoreticalQty: 3000,
            countedQty: 2800,
            varianceQty: -200,
          },
          {
            stockUnitId: pain.id,
            theoreticalQty: 15,
            countedQty: 14,
            varianceQty: -1,
          },
        ],
      },
    },
  });

  // Critical stock alert for lait
  await prisma.alert.create({
    data: {
      restaurantId: shop.id,
      type: "STOCK_CRITICAL",
      severity: 2,
      status: "ACTIVE",
      title: "Stock critique — Lait demi-écrémé 1L",
      constat: "Il reste 10 bouteilles de lait.",
      cause: "Sous le seuil critique (12 bouteilles).",
      impact: "Rupture estimée demain si aucun réassort.",
      action: "Commander 48 bouteilles chez Grossiste Nord.",
      stockUnitId: lait.id,
    },
  });

  // Mark onboarding done AFTER demo data so Première heure stays honest
  await prisma.restaurant.update({
    where: { id: shop.id },
    data: { onboardingCompletedAt: new Date() },
  });

  console.log("Seed OK — Épicerie du Marché (démo Margin Shop)");
  console.log("  Login: gerant@marginshop.app / marginshop2026");
  console.log("  Équipe: 1 caissière, 1 vendeur rayon, 1 livreur (optionnel)");
  console.log("  Fournisseurs:", grossiste.name, primeur.name, droguerie.name);
  console.log("  Caisse en ligne:", caisse1.name);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
