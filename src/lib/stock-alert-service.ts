import { prisma } from "@/lib/db";
import { ForecastService } from "@/lib/forecast-service";
import { formatQty } from "@/lib/stock-engine";
import { buildWaMeLink } from "@/lib/wa-link";

export type StockAlertLine = {
  ingredientId: string;
  nom: string;
  stock_restant: number;
  seuil: number;
  unite: string;
  quantite_a_commander: number;
  stockLabel: string;
  seuilLabel: string;
  qtyLabel: string;
};

export type StockAlertSummary = {
  date: string;
  restaurantId: string;
  restaurantName: string;
  nombre_produits: number;
  liste: StockAlertLine[];
  fingerprint: string;
};

export type PendingStockRecap = {
  summary: StockAlertSummary;
  status: "PENDING" | "SENT" | "DISMISSED";
  at: string | null;
};

function fingerprintOf(liste: StockAlertLine[]): string {
  return liste
    .map(
      (l) =>
        `${l.ingredientId}:${Math.round(l.stock_restant)}:${Math.round(l.quantite_a_commander)}`
    )
    .sort()
    .join("|");
}

/**
 * StockAlertService — un seul récap de ruptures (pas une commande par produit).
 * Déclenché après chaque vente, et via cron `/api/cron/stock-alerts`.
 *
 * Ne crée PAS de PurchaseOrder individuelle : le regroupement remplace ce flux.
 */
export class StockAlertService {
  /** Build live summary of all ingredients at/under critical threshold. */
  static async buildSummary(
    restaurantId: string
  ): Promise<StockAlertSummary | null> {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true },
    });
    if (!restaurant) return null;

    const ingredients = await prisma.ingredient.findMany({
      where: { restaurantId },
      orderBy: { name: "asc" },
    });

    const critical = ingredients.filter(
      (i) =>
        i.criticalThreshold > 0 && i.stockTheoretical <= i.criticalThreshold
    );

    const liste: StockAlertLine[] = [];
    for (const ing of critical) {
      const qty = await ForecastService.recommendForIngredient(
        restaurantId,
        ing
      );
      liste.push({
        ingredientId: ing.id,
        nom: ing.name,
        stock_restant: ing.stockTheoretical,
        seuil: ing.criticalThreshold,
        unite: ing.unit,
        quantite_a_commander: qty,
        stockLabel: formatQty(ing.stockTheoretical, ing.unit, ing.name),
        seuilLabel: formatQty(ing.criticalThreshold, ing.unit, ing.name),
        qtyLabel: formatQty(qty, ing.unit, ing.name),
      });
    }

    return {
      date: new Date().toISOString(),
      restaurantId: restaurant.id,
      restaurantName: restaurant.name,
      nombre_produits: liste.length,
      liste,
      fingerprint: fingerprintOf(liste),
    };
  }

  /**
   * Publish a single pending StockAlertSummary for the modal.
   * Call AFTER syncIngredientAlert(..., { notify: false }) on touched rows.
   */
  static async run(restaurantId: string): Promise<StockAlertSummary | null> {
    const summary = await StockAlertService.buildSummary(restaurantId);
    if (!summary || summary.nombre_produits === 0) {
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: {
          pendingStockRecapJson: null,
          pendingStockRecapStatus: null,
          pendingStockRecapKey: null,
          pendingStockRecapAt: null,
        },
      });
      return summary;
    }

    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
      select: {
        pendingStockRecapKey: true,
        pendingStockRecapStatus: true,
      },
    });

    // Same fingerprint already sent/dismissed → don't reopen modal
    if (
      restaurant.pendingStockRecapKey === summary.fingerprint &&
      (restaurant.pendingStockRecapStatus === "SENT" ||
        restaurant.pendingStockRecapStatus === "DISMISSED")
    ) {
      return summary;
    }

    if (
      restaurant.pendingStockRecapKey !== summary.fingerprint ||
      restaurant.pendingStockRecapStatus !== "PENDING"
    ) {
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: {
          pendingStockRecapJson: JSON.stringify(summary),
          pendingStockRecapStatus: "PENDING",
          pendingStockRecapKey: summary.fingerprint,
          pendingStockRecapAt: new Date(),
        },
      });
    } else {
      await prisma.restaurant.update({
        where: { id: restaurantId },
        data: {
          pendingStockRecapJson: JSON.stringify(summary),
          pendingStockRecapAt: new Date(),
        },
      });
    }

    return summary;
  }

  static async getPending(
    restaurantId: string
  ): Promise<PendingStockRecap | null> {
    try {
      const r = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: {
          pendingStockRecapJson: true,
          pendingStockRecapStatus: true,
          pendingStockRecapAt: true,
        },
      });
      if (
        !r?.pendingStockRecapJson ||
        r.pendingStockRecapStatus !== "PENDING"
      ) {
        return null;
      }
      try {
        const summary = JSON.parse(
          r.pendingStockRecapJson
        ) as StockAlertSummary;
        if (!summary.nombre_produits || !summary.liste?.length) return null;
        return {
          summary,
          status: "PENDING",
          at: r.pendingStockRecapAt?.toISOString() ?? null,
        };
      } catch {
        return null;
      }
    } catch (err) {
      // Prisma client stale (Turbopack) — ne pas planter l’app
      console.error("[StockAlertService.getPending]", err);
      return null;
    }
  }

  static async dismiss(restaurantId: string): Promise<void> {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { pendingStockRecapStatus: "DISMISSED" },
    });
  }

  static buildWhatsAppBody(summary: StockAlertSummary): string {
    // Réservé au modal récap groupé (hors Accueil) — pas le popup alertes.
    const lines = summary.liste
      .map(
        (l) =>
          `• ${l.nom} — reste ${l.stockLabel} (seuil ${l.seuilLabel}) → commander ${l.qtyLabel}`
      )
      .join("\n");
    return [
      `Margin — Récap rupture de stock`,
      `${summary.restaurantName} · ${summary.nombre_produits} produit(s)`,
      lines,
      `→ Une seule liste à traiter (pas produit par produit).`,
    ].join("\n");
  }

  static async sendWhatsApp(restaurantId: string): Promise<{
    ok: boolean;
    message: string;
    waMeLink: string | null;
    simulated?: boolean;
  }> {
    const pending = await StockAlertService.getPending(restaurantId);
    const restaurant = await prisma.restaurant.findUniqueOrThrow({
      where: { id: restaurantId },
    });

    let summary = pending?.summary ?? null;
    if (!summary) {
      summary = await StockAlertService.buildSummary(restaurantId);
    }
    if (!summary || summary.nombre_produits === 0) {
      return {
        ok: false,
        message: "Aucun produit en rupture pour le moment.",
        waMeLink: null,
      };
    }

    const body = StockAlertService.buildWhatsAppBody(summary);
    const waMeLink = buildWaMeLink(restaurant.whatsappTo, body);

    if (!restaurant.whatsappTo) {
      return {
        ok: false,
        message: "Ajoutez votre numéro WhatsApp dans Réglages.",
        waMeLink: null,
      };
    }

    const listText = summary.liste
      .map(
        (l) =>
          `• ${l.nom} — reste ${l.stockLabel} → commander ${l.qtyLabel}`
      )
      .join("\n");

    const { sendWhatsAppOutbound } = await import("@/lib/whatsapp/outbound");
    const result = await sendWhatsAppOutbound({
      to: restaurant.whatsappTo,
      restaurantId,
      purpose: "stock_recap",
      templateKey: "stock_recap",
      templateVars: {
        "1": summary.restaurantName,
        "2": String(summary.nombre_produits),
        "3": listText.slice(0, 800),
      },
      body,
      alertIds: summary.liste.map((l) => l.ingredientId),
    });

    if (!result.ok) {
      return {
        ok: false,
        message: result.reason || "Envoi WhatsApp impossible.",
        waMeLink,
        simulated: result.channel === "console",
      };
    }

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: {
        pendingStockRecapStatus: "SENT",
        pendingStockRecapJson: JSON.stringify(summary),
        pendingStockRecapKey: summary.fingerprint,
      },
    });

    // Marquer les alertes ACTIVE correspondantes comme notifiées
    await prisma.alert.updateMany({
      where: {
        restaurantId,
        type: "STOCK_CRITICAL",
        status: "ACTIVE",
        ingredientId: { in: summary.liste.map((l) => l.ingredientId) },
        whatsappSentAt: null,
      },
      data: {
        whatsappSentAt: new Date(),
        whatsappPendingAt: null,
      },
    });

    return {
      ok: true,
      message:
        result.channel === "console"
        ? "Récap prêt — ouvrez WhatsApp pour l’envoyer (Twilio non configuré)."
        : "Récap envoyé sur WhatsApp.",
      waMeLink,
      simulated: result.channel === "console",
    };
  }
}
