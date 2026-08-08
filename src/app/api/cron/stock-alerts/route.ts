import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { syncIngredientAlert } from "@/lib/stock-engine";
import { StockAlertService } from "@/lib/stock-alert-service";
import { flushAllPendingStockBatches } from "@/lib/whatsapp/batch";
import { syncCatalogIssues } from "@/lib/catalog/issues";
import { refreshVelocityThresholds } from "@/lib/catalog/thresholds";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

/**
 * Cron stock + flush batch WhatsApp + santé catalogue (seuils vélocité).
 * Auth: Authorization: Bearer $CRON_SECRET
 */
export async function GET(request: Request) {
  const { assertCronAuthorized } = await import("@/lib/cron-auth");
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const restaurants = await prisma.restaurant.findMany({
    where: { active: true },
    select: { id: true, name: true },
  });

  const results: { id: string; name: string; products: number }[] = [];
  const catalog: {
    id: string;
    issues: number;
    velocityUpdated: number;
  }[] = [];

  // Seuils vélocité : 1× / jour (heure UTC 5) ou ?thresholds=1
  const hour = new Date().getUTCHours();
  const url = new URL(request.url);
  const runVelocity =
    url.searchParams.get("thresholds") === "1" || hour === 5;

  for (const r of restaurants) {
    const ingredients = await prisma.ingredient.findMany({
      where: { restaurantId: r.id },
      select: { id: true },
    });
    for (const ing of ingredients) {
      await syncIngredientAlert(r.id, ing.id);
    }
    const summary = await StockAlertService.run(r.id);
    results.push({
      id: r.id,
      name: r.name,
      products: summary?.nombre_produits ?? 0,
    });

    const issues = await syncCatalogIssues(r.id);
    let velocityUpdated = 0;
    if (runVelocity) {
      const v = await refreshVelocityThresholds(r.id);
      velocityUpdated = v.updated;
    }
    catalog.push({
      id: r.id,
      issues: issues.open,
      velocityUpdated,
    });
  }

  const waFlush = await flushAllPendingStockBatches();

  const { checkPlatformFallbackAnomaly } = await import(
    "@/lib/llm/platform-quota"
  );
  const platformLlm = await checkPlatformFallbackAnomaly().catch(() => ({
    total: 0,
    alerted: false,
  }));

  return NextResponse.json({
    ok: true,
    scanned: results.length,
    withAlerts: results.filter((x) => x.products > 0).length,
    whatsappFlush: waFlush,
    catalog,
    velocityRan: runVelocity,
    platformLlm,
    results,
  });
}

export async function POST(request: Request) {
  return GET(request);
}
