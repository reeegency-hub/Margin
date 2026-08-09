import { prisma } from "@/lib/db";
import { getNotifier } from "@/lib/notifications";

export async function getActiveDrivers(restaurantId: string) {
  return prisma.deliveryDriver.findMany({
    where: { restaurantId, isActive: true },
    orderBy: { name: "asc" },
  });
}

export async function createDriver(
  restaurantId: string,
  data: { name: string; phone?: string; whatsappOptIn?: boolean }
) {
  return prisma.deliveryDriver.create({
    data: {
      restaurantId,
      name: data.name.trim(),
      phone: data.phone?.trim() || null,
      whatsappOptIn: data.whatsappOptIn ?? true,
    },
  });
}

export async function toggleDriver(
  restaurantId: string,
  driverId: string,
  isActive: boolean
) {
  await prisma.deliveryDriver.updateMany({
    where: { id: driverId, restaurantId },
    data: { isActive },
  });
}

export async function deleteDriver(restaurantId: string, driverId: string) {
  await prisma.deliveryDriver.deleteMany({
    where: { id: driverId, restaurantId },
  });
}

export async function upsertPlatformConnection(
  restaurantId: string,
  platform: string,
  data: {
    apiKey?: string;
    storeId?: string;
    webhookSecret?: string;
    status?: string;
  }
) {
  const { encryptCredential } = await import("@/lib/credentials");

  return prisma.deliveryPlatformConnection.upsert({
    where: { restaurantId_platform: { restaurantId, platform } },
    create: {
      restaurantId,
      platform,
      status: data.status ?? (data.apiKey ? "KEY_STORED" : "DISCONNECTED"),
      apiKeyEncrypted: data.apiKey ? encryptCredential(data.apiKey) : null,
      storeId: data.storeId ?? null,
      webhookSecret: data.webhookSecret ?? null,
      connectedAt: data.apiKey ? new Date() : null,
    },
    update: {
      ...(data.apiKey ? { apiKeyEncrypted: encryptCredential(data.apiKey) } : {}),
      ...(data.storeId !== undefined ? { storeId: data.storeId } : {}),
      ...(data.webhookSecret ? { webhookSecret: data.webhookSecret } : {}),
      ...(data.status ? { status: data.status } : {}),
      ...(data.apiKey
        ? { connectedAt: new Date(), status: "KEY_STORED" }
        : {}),
    },
  });
}

export async function testPlatformConnection(
  restaurantId: string,
  platform: string
): Promise<{ ok: boolean; message: string }> {
  const conn = await prisma.deliveryPlatformConnection.findUnique({
    where: { restaurantId_platform: { restaurantId, platform } },
  });

  if (!conn?.apiKeyEncrypted) {
    return { ok: false, message: "Clé API non configurée." };
  }

  const { decryptCredential } = await import("@/lib/credentials");
  const key = decryptCredential(conn.apiKeyEncrypted);
  if (!key) {
    return { ok: false, message: "Clé API illisible." };
  }

  // Sandbox ping — PAS un vrai appel Uber/Deliveroo
  await prisma.deliveryPlatformConnection.update({
    where: { id: conn.id },
    data: { lastSyncAt: new Date(), status: "KEY_STORED" },
  });

  return {
    ok: true,
    message: `Clé ${platform} enregistrée (coffre-fort Margin Shop). La synchro live Uber/Deliveroo nécessite un compte partenaire — pas encore branchée. Utilisez le webhook générique /api/webhooks/delivery/${platform} pour injecter des commandes de test.`,
  };
}

export async function createDeliveryOrder(
  restaurantId: string,
  data: {
    platform: string;
    externalOrderId: string;
    customerName?: string;
    totalAmount: number;
  }
) {
  const order = await prisma.deliveryOrder.upsert({
    where: {
      restaurantId_externalOrderId: {
        restaurantId,
        externalOrderId: data.externalOrderId,
      },
    },
    create: {
      restaurantId,
      platform: data.platform,
      externalOrderId: data.externalOrderId,
      customerName: data.customerName ?? null,
      totalAmount: data.totalAmount,
      status: "READY",
      readyAt: new Date(),
    },
    update: {
      status: "READY",
      readyAt: new Date(),
      totalAmount: data.totalAmount,
    },
  });

  await notifyDeliveryOrderWhatsApp(restaurantId, order.id);
  return order;
}

/** Match plats + décrémente stock (même logique que le POS). */
export async function ingestDeliveryOrderAsSale(
  restaurantId: string,
  platform: string,
  externalOrderId: string,
  items: {
    sku?: string;
    dishName?: string;
    name?: string;
    quantity?: number;
  }[]
): Promise<{ recorded: number; unmatched: string[] }> {
  const { recordSale } = await import("@/lib/stock-engine");
  const dishes = await prisma.product.findMany({
    where: { restaurantId, active: true },
  });

  const saleLines: { productId: string; quantity: number }[] = [];
  const unmatched: string[] = [];

  for (const item of items) {
    const label = item.dishName || item.name || item.sku || "?";
    let dish = item.sku
      ? dishes.find((d) => d.externalSku === item.sku)
      : undefined;
    if (!dish) {
      const name = (item.dishName || item.name || "").toLowerCase().trim();
      if (name) {
        dish = dishes.find((d) => d.name.toLowerCase() === name);
      }
    }
    if (!dish) {
      unmatched.push(label);
      continue;
    }
    saleLines.push({
      productId: dish.id,
      quantity: Math.max(1, item.quantity ?? 1),
    });
  }

  if (saleLines.length) {
    await recordSale(restaurantId, saleLines, {
      channel: `delivery_${platform}`,
      externalOrderId,
    });
  }

  return { recorded: saleLines.length, unmatched };
}

async function notifyDeliveryOrderWhatsApp(
  restaurantId: string,
  orderId: string
) {
  const { notifyDeliveryOrderWhatsApp: notify } = await import(
    "@/lib/whatsapp-bot"
  );
  await notify(restaurantId, orderId);
}

export async function assignDriver(
  restaurantId: string,
  orderId: string,
  driverId: string
) {
  const order = await prisma.deliveryOrder.findFirst({
    where: { id: orderId, restaurantId },
  });
  if (!order) throw new Error("Commande introuvable");

  const driver = await prisma.deliveryDriver.findFirst({
    where: { id: driverId, restaurantId, isActive: true },
  });
  if (!driver) throw new Error("Livreur introuvable");

  await prisma.deliveryAssignment.create({
    data: {
      deliveryOrderId: orderId,
      driverId,
      status: "ASSIGNED",
    },
  });

  await prisma.deliveryOrder.updateMany({
    where: { id: orderId, restaurantId },
    data: { status: "ASSIGNED" },
  });

  if (driver.phone && driver.whatsappOptIn) {
    const notifier = getNotifier();
    await notifier.send({
      to: driver.phone,
      body: `Margin Shop — Nouvelle livraison #${order.externalOrderId.slice(-6)}. Récupérez la commande.`,
    });
  }

  return order;
}

export async function updateDeliveryStatus(
  restaurantId: string,
  orderId: string,
  status: string
) {
  const data: {
    status: string;
    deliveredAt?: Date;
  } = { status };

  if (status === "DELIVERED") data.deliveredAt = new Date();

  await prisma.deliveryOrder.updateMany({
    where: { id: orderId, restaurantId },
    data,
  });

  if (status === "DELIVERED") {
    await prisma.deliveryAssignment.updateMany({
      where: { deliveryOrderId: orderId },
      data: { status: "DELIVERED", deliveredAt: new Date() },
    });
  }
}

export async function simulateIncomingDelivery(
  restaurantId: string,
  platform: string
) {
  const id = `SIM-${Date.now()}`;
  return createDeliveryOrder(restaurantId, {
    platform,
    externalOrderId: id,
    customerName: "Client simulé",
    totalAmount: 24.5,
  });
}
