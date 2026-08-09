import { prisma } from "@/lib/db";
import { recordSale } from "@/lib/stock-engine";
export {
  CHANNEL_LABELS,
  platformStatusLabel,
  deliveryOrderStatusLabel,
} from "@/lib/channel-labels";
import { CHANNEL_LABELS } from "@/lib/channel-labels";

export async function simulateKioskSale(
  restaurantId: string,
  kioskId: string,
  productId?: string
) {
  const kiosk = await prisma.kiosk.findFirst({
    where: { id: kioskId, restaurantId },
  });
  if (!kiosk) throw new Error("Borne introuvable");
  if (kiosk.status !== "ONLINE") {
    throw new Error("Borne hors ligne — impossible de simuler une commande");
  }

  const dish =
    (productId
      ? await prisma.product.findFirst({
          where: { id: productId, restaurantId, active: true },
        })
      : null) ??
    (await prisma.product.findFirst({
      where: { restaurantId, active: true },
      orderBy: { name: "asc" },
    }));

  if (!dish) throw new Error("Aucun plat disponible");

  await prisma.kiosk.update({
    where: { id: kioskId },
    data: { lastSeenAt: new Date() },
  });

  return recordSale(
    restaurantId,
    [{ productId: dish.id, quantity: 1 }],
    {
      channel: "kiosk",
      kioskId,
      externalOrderId: `kiosk-sim-${Date.now()}`,
    }
  );
}

export async function simulateDeliverySale(
  restaurantId: string,
  platform: string
) {
  const conn = await prisma.deliveryPlatformConnection.findFirst({
    where: { restaurantId, platform },
  });
  if (!conn || conn.status !== "CONNECTED") {
    throw new Error("Plateforme non connectée — simulation impossible");
  }

  const dish = await prisma.product.findFirst({
    where: { restaurantId, active: true },
  });
  if (!dish) throw new Error("Aucun plat disponible");

  await prisma.deliveryPlatformConnection.update({
    where: { id: conn.id },
    data: { lastSyncAt: new Date() },
  });

  return recordSale(
    restaurantId,
    [{ productId: dish.id, quantity: 1 }],
    {
      channel: platform,
      externalOrderId: `${platform}-sim-${Date.now()}`,
    }
  );
}

export async function setDeliveryStatus(
  restaurantId: string,
  platform: string,
  status: string
) {
  const conn = await prisma.deliveryPlatformConnection.findFirst({
    where: { restaurantId, platform },
  });
  if (!conn) throw new Error("Connexion introuvable");

  await prisma.deliveryPlatformConnection.update({
    where: { id: conn.id },
    data: {
      status,
      lastSyncAt: status === "CONNECTED" ? new Date() : conn.lastSyncAt,
    },
  });

  if (status === "OUTAGE") {
    await prisma.platformOutage.create({
      data: {
        restaurantId,
        platform,
        startedAt: new Date(),
        estimatedLostRevenue: 150,
      },
    });
  }

  if (status === "CONNECTED") {
    await prisma.platformOutage.updateMany({
      where: {
        restaurantId,
        platform,
        endedAt: null,
      },
      data: { endedAt: new Date() },
    });
  }
}

export async function setKioskStatus(
  restaurantId: string,
  kioskId: string,
  status: string
) {
  await prisma.kiosk.updateMany({
    where: { id: kioskId, restaurantId },
    data: {
      status,
      lastSeenAt: status === "ONLINE" ? new Date() : undefined,
    },
  });
}

export async function getSalesByChannel(restaurantId: string) {
  const sales = await prisma.sale.findMany({
    where: { restaurantId },
    select: { channel: true, totalAmount: true },
  });
  const map = new Map<string, { count: number; amount: number }>();
  for (const s of sales) {
    const cur = map.get(s.channel) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += s.totalAmount;
    map.set(s.channel, cur);
  }
  return [...map.entries()].map(([channel, v]) => ({
    channel,
    label: CHANNEL_LABELS[channel] ?? channel,
    ...v,
  }));
}
