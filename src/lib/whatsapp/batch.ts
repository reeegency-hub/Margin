/**
 * Batching alertes stock → un seul WhatsApp par fenêtre.
 * Dédup : Alert.whatsappSentAt jusqu’à résolution (stock > seuil).
 */
import { prisma } from "@/lib/db";
import { formatQty } from "@/lib/stock-engine";
import { WHATSAPP_BATCH_MINUTES } from "@/lib/whatsapp/config";
import { sendWhatsAppOutbound } from "@/lib/whatsapp/outbound";

function truncateList(lines: string[], maxChars = 800): string {
  let out = "";
  for (const line of lines) {
    const next = out ? `${out}\n${line}` : line;
    if (next.length > maxChars) {
      return `${out}\n…`;
    }
    out = next;
  }
  return out;
}

export async function queueStockAlertForWhatsApp(
  restaurantId: string,
  alertId: string
): Promise<void> {
  const alert = await prisma.alert.findFirst({
    where: { id: alertId, restaurantId },
    select: {
      id: true,
      status: true,
      whatsappSentAt: true,
      whatsappPendingAt: true,
    },
  });
  if (!alert || alert.status !== "ACTIVE") return;
  if (alert.whatsappSentAt) return; // déjà alerté ce cycle
  if (alert.whatsappPendingAt) return;
  await prisma.alert.updateMany({
    where: { id: alertId, restaurantId },
    data: { whatsappPendingAt: new Date() },
  });
}

/**
 * Flush les alertes en file pour un tenant (1 message groupé).
 * @param force — ignorer la fenêtre de batch (ex. rupture stock=0)
 */
export async function flushStockAlertBatch(
  restaurantId: string,
  opts?: { force?: boolean }
): Promise<{
  sent: boolean;
  reason?: string;
  alertCount: number;
}> {
  const pending = await prisma.alert.findMany({
    where: {
      restaurantId,
      type: "STOCK_CRITICAL",
      status: "ACTIVE",
      whatsappSentAt: null,
      whatsappPendingAt: { not: null },
    },
    include: { ingredient: true },
    orderBy: { severity: "asc" },
  });

  if (pending.length === 0) {
    return { sent: false, reason: "Rien en file", alertCount: 0 };
  }

  const oldest = pending.reduce(
    (min, a) =>
      a.whatsappPendingAt && a.whatsappPendingAt < min
        ? a.whatsappPendingAt
        : min,
    pending[0].whatsappPendingAt!
  );
  const ageMs = Date.now() - oldest.getTime();
  const windowMs = WHATSAPP_BATCH_MINUTES * 60 * 1000;
  const hasCritical = pending.some((a) => a.severity <= 1);

  if (!opts?.force && !hasCritical && ageMs < windowMs) {
    return {
      sent: false,
      reason: `Fenêtre batch ${WHATSAPP_BATCH_MINUTES} min pas atteinte`,
      alertCount: pending.length,
    };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, whatsappTo: true },
  });
  if (!restaurant?.whatsappTo) {
    return {
      sent: false,
      reason: "Numéro WhatsApp non configuré",
      alertCount: pending.length,
    };
  }

  const lines = pending.map((a) => {
    const ing = a.ingredient;
    if (ing) {
      return `• ${ing.name} — reste ${formatQty(ing.stockTheoretical, ing.unit, ing.name)}`;
    }
    return `• ${a.title}`;
  });
  const listText = truncateList(lines);
  const vars = {
    "1": restaurant.name,
    "2": String(pending.length),
    "3": listText,
  };

  const result = await sendWhatsAppOutbound({
    to: restaurant.whatsappTo,
    restaurantId,
    purpose: "stock_recap",
    templateKey: "stock_recap",
    templateVars: vars,
    body: undefined,
    alertIds: pending.map((a) => a.id),
  });

  if (!result.ok) {
    return {
      sent: false,
      reason: result.reason || "Envoi échoué",
      alertCount: pending.length,
    };
  }

  const now = new Date();
  await prisma.alert.updateMany({
    where: {
      restaurantId,
      id: { in: pending.map((a) => a.id) },
    },
    data: {
      whatsappSentAt: now,
      whatsappPendingAt: null,
    },
  });

  // Aligner le récap in-app
  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      pendingStockRecapStatus: "SENT",
    },
  });

  return { sent: true, alertCount: pending.length };
}

/** Flush tous les tenants ayant une file (cron). */
export async function flushAllPendingStockBatches(): Promise<{
  tenants: number;
  sent: number;
  pendingLeft: number;
}> {
  const grouped = await prisma.alert.groupBy({
    by: ["restaurantId"],
    where: {
      type: "STOCK_CRITICAL",
      status: "ACTIVE",
      whatsappSentAt: null,
      whatsappPendingAt: { not: null },
    },
  });

  let sent = 0;
  let pendingLeft = 0;
  for (const g of grouped) {
    const r = await flushStockAlertBatch(g.restaurantId);
    if (r.sent) sent += 1;
    else if (r.alertCount > 0) pendingLeft += 1;
  }

  return { tenants: grouped.length, sent, pendingLeft };
}

export function batchWindowMs(): number {
  return WHATSAPP_BATCH_MINUTES * 60 * 1000;
}
