/**
 * Métriques WhatsApp — volume, coût, délivrabilité.
 */
import { prisma } from "@/lib/db";
import { WHATSAPP_COST_CENTS, WHATSAPP_DAILY_LIMIT } from "@/lib/whatsapp/config";

export async function getWhatsAppDeliveryStats(hours = 24): Promise<{
  hours: number;
  total: number;
  delivered: number;
  failed: number;
  undelivered: number;
  limitSkipped: number;
  pending: number;
  deliveryRatePct: number | null;
  estimatedCostCents: number;
  byTenant: Array<{
    restaurantId: string;
    count: number;
    costCents: number;
    failed: number;
  }>;
  dailyLimit: number;
  costCentsPerMsg: number;
}> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = await prisma.whatsAppOutboundMessage.findMany({
    where: { createdAt: { gte: since } },
    select: {
      restaurantId: true,
      status: true,
      estimatedCostCents: true,
    },
  });

  let delivered = 0;
  let failed = 0;
  let undelivered = 0;
  let limitSkipped = 0;
  let pending = 0;
  let estimatedCostCents = 0;

  const byTenantMap = new Map<
    string,
    { count: number; costCents: number; failed: number }
  >();

  for (const r of rows) {
    const st = (r.status || "").toLowerCase();
    estimatedCostCents += r.estimatedCostCents || 0;
    if (st === "delivered" || st === "read") delivered += 1;
    else if (st === "failed") failed += 1;
    else if (st === "undelivered") undelivered += 1;
    else if (st === "limit_skipped") limitSkipped += 1;
    else pending += 1;

    if (r.restaurantId) {
      const cur = byTenantMap.get(r.restaurantId) || {
        count: 0,
        costCents: 0,
        failed: 0,
      };
      cur.count += 1;
      cur.costCents += r.estimatedCostCents || 0;
      if (st === "failed" || st === "undelivered") cur.failed += 1;
      byTenantMap.set(r.restaurantId, cur);
    }
  }

  const terminalOk = delivered;
  const terminalBad = failed + undelivered;
  const terminal = terminalOk + terminalBad;
  const deliveryRatePct =
    terminal > 0 ? Math.round((terminalOk / terminal) * 1000) / 10 : null;

  const byTenant = [...byTenantMap.entries()]
    .map(([restaurantId, v]) => ({ restaurantId, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 15);

  return {
    hours,
    total: rows.length,
    delivered,
    failed,
    undelivered,
    limitSkipped,
    pending,
    deliveryRatePct,
    estimatedCostCents,
    byTenant,
    dailyLimit: WHATSAPP_DAILY_LIMIT,
    costCentsPerMsg: WHATSAPP_COST_CENTS,
  };
}
