/**
 * Score santé client composite — fondateur Ops / alerting churn.
 */
import { prisma } from "@/lib/db";
import { getCatalogHealth, type CatalogHealth } from "@/lib/catalog/health";
import { PLANS } from "@/lib/plans";

export type HealthRisk = "healthy" | "at_risk" | "critical" | "churned";

export type StoreHealthSignal = {
  id: string;
  label: string;
  severity: "info" | "warn" | "critical";
  detail?: string;
};

export type StoreHealth = {
  restaurantId: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  risk: HealthRisk;
  signals: StoreHealthSignal[];
  headline: string;
  mrrCents: number | null;
  lastLoginAt: Date | null;
  lastSaleAt: Date | null;
  lastPosOrderAt: Date | null;
  catalogGrade: CatalogHealth["grade"] | null;
};

const DAY_MS = 86400000;

function gradeFromScore(score: number): StoreHealth["grade"] {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "F";
}

function riskFromScore(score: number, churned: boolean): HealthRisk {
  if (churned) return "churned";
  if (score < 40) return "critical";
  if (score < 70) return "at_risk";
  return "healthy";
}

function mrrCentsForStore(plan: string | null, billingPeriod: string | null): number | null {
  const p = PLANS.find((x) => x.id === plan);
  if (!p) return null;
  if (billingPeriod === "yearly") {
    return Math.round((p.priceMonthly * 12 * 0.8 * 100) / 12);
  }
  return p.priceMonthly * 100;
}

type StoreInput = {
  id: string;
  name: string;
  plan: string | null;
  billingPeriod: string | null;
  stripeStatus: string | null;
  active: boolean;
  onboardingCompletedAt: Date | null;
  whatsappTo: string | null;
  paymentFailedAt: Date | null;
  accessGraceUntil: Date | null;
  cancelAtPeriodEnd: boolean;
  churnType: string | null;
  churnedAt: Date | null;
  lastInvoiceAmountCents: number | null;
  externalPosConnections: {
    status: string;
    lastOrderAt: Date | null;
  }[];
};

export function computeStoreHealth(
  store: StoreInput,
  extras: {
    lastLoginAt: Date | null;
    lastSaleAt: Date | null;
    catalog: CatalogHealth | null;
  }
): StoreHealth {
  const signals: StoreHealthSignal[] = [];
  const now = Date.now();
  const stripe = (store.stripeStatus || "none").toLowerCase();
  const pos = store.externalPosConnections[0];
  const churned =
    Boolean(store.churnedAt) ||
    stripe === "canceled" ||
    (!store.active && stripe === "canceled");

  if (churned) {
    signals.push({
      id: "churned",
      label: "Client churné",
      severity: "critical",
      detail: store.churnType ?? stripe,
    });
    return {
      restaurantId: store.id,
      score: 0,
      grade: "F",
      risk: "churned",
      signals,
      headline: "Compte résilié ou inactif",
      mrrCents: 0,
      lastLoginAt: extras.lastLoginAt,
      lastSaleAt: extras.lastSaleAt,
      lastPosOrderAt: pos?.lastOrderAt ?? null,
      catalogGrade: extras.catalog?.grade ?? null,
    };
  }

  let score = 100;

  if (!store.active) {
    score -= 35;
    signals.push({ id: "inactive", label: "Compte désactivé", severity: "critical" });
  }

  if (stripe === "past_due" || stripe === "unpaid") {
    score -= 35;
    signals.push({
      id: "payment_overdue",
      label: "Paiement en retard",
      severity: "critical",
      detail: stripe,
    });
  }

  if (store.paymentFailedAt) {
    score -= 15;
    signals.push({
      id: "payment_failed",
      label: "Échec de paiement récent",
      severity: "warn",
      detail: store.paymentFailedAt.toLocaleDateString("fr-FR"),
    });
  }

  if (store.accessGraceUntil && store.accessGraceUntil > new Date()) {
    score -= 10;
    signals.push({
      id: "grace_period",
      label: "Période de grâce active",
      severity: "warn",
      detail: `Jusqu'au ${store.accessGraceUntil.toLocaleDateString("fr-FR")}`,
    });
  }

  if (store.cancelAtPeriodEnd) {
    score -= 20;
    signals.push({
      id: "cancel_scheduled",
      label: "Résiliation programmée",
      severity: "critical",
    });
  }

  if (!store.onboardingCompletedAt) {
    score -= 12;
    signals.push({
      id: "onboarding",
      label: "Onboarding incomplet",
      severity: "warn",
    });
  }

  if (store.onboardingCompletedAt) {
    const loginAge = extras.lastLoginAt
      ? now - extras.lastLoginAt.getTime()
      : Infinity;
    if (!extras.lastLoginAt || loginAge > 14 * DAY_MS) {
      score -= 18;
      signals.push({
        id: "no_login",
        label: extras.lastLoginAt
          ? "Pas de connexion depuis 14+ jours"
          : "Aucune connexion enregistrée",
        severity: "warn",
        detail: extras.lastLoginAt
          ? extras.lastLoginAt.toLocaleDateString("fr-FR")
          : undefined,
      });
    }
  }

  if (pos) {
    const posAge = pos.lastOrderAt ? now - pos.lastOrderAt.getTime() : Infinity;
    if (!pos.lastOrderAt || posAge > 7 * DAY_MS) {
      score -= 12;
      signals.push({
        id: "pos_stale",
        label: pos.lastOrderAt
          ? "Caisse inactive depuis 7+ jours"
          : "Caisse jamais synchronisée",
        severity: "warn",
        detail: pos.lastOrderAt?.toLocaleDateString("fr-FR"),
      });
    }
  } else if (store.onboardingCompletedAt) {
    score -= 8;
    signals.push({
      id: "no_pos",
      label: "Caisse non connectée",
      severity: "info",
    });
  }

  if (store.onboardingCompletedAt) {
    const saleAge = extras.lastSaleAt
      ? now - extras.lastSaleAt.getTime()
      : Infinity;
    if (!extras.lastSaleAt || saleAge > 14 * DAY_MS) {
      score -= 10;
      signals.push({
        id: "no_sales",
        label: extras.lastSaleAt
          ? "Aucune vente depuis 14+ jours"
          : "Aucune vente enregistrée",
        severity: "warn",
      });
    }
  }

  if (extras.catalog) {
    if (extras.catalog.risk === "high") {
      score -= 12;
      signals.push({
        id: "catalog_high",
        label: "Catalogue à risque élevé",
        severity: "warn",
        detail: extras.catalog.headline,
      });
    } else if (extras.catalog.risk === "medium") {
      score -= 6;
      signals.push({
        id: "catalog_medium",
        label: "Catalogue à surveiller",
        severity: "info",
      });
    }
  }

  if (!store.whatsappTo && store.onboardingCompletedAt) {
    score -= 5;
    signals.push({
      id: "no_whatsapp",
      label: "WhatsApp non configuré",
      severity: "info",
    });
  }

  score = Math.max(0, Math.min(100, score));
  const risk = riskFromScore(score, false);
  const grade = gradeFromScore(score);

  const headline =
    risk === "critical"
      ? "Contact urgent recommandé"
      : risk === "at_risk"
        ? "Signaux de churn — à surveiller"
        : "Compte en bonne santé";

  return {
    restaurantId: store.id,
    score,
    grade,
    risk,
    signals,
    headline,
    mrrCents:
      stripe === "active" || stripe === "trialing"
        ? mrrCentsForStore(store.plan, store.billingPeriod)
        : null,
    lastLoginAt: extras.lastLoginAt,
    lastSaleAt: extras.lastSaleAt,
    lastPosOrderAt: pos?.lastOrderAt ?? null,
    catalogGrade: extras.catalog?.grade ?? null,
  };
}

export async function getStoreHealth(restaurantId: string): Promise<StoreHealth> {
  const store = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    include: {
      externalPosConnections: {
        select: { status: true, lastOrderAt: true },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });
  if (!store) {
    throw new Error("Restaurant introuvable");
  }

  const [lastLogin, lastSale, catalog] = await Promise.all([
    prisma.user.findFirst({
      where: { restaurantId },
      orderBy: { lastLoginAt: "desc" },
      select: { lastLoginAt: true },
    }),
    prisma.sale.findFirst({
      where: { restaurantId },
      orderBy: { soldAt: "desc" },
      select: { soldAt: true },
    }),
    getCatalogHealth(restaurantId),
  ]);

  return computeStoreHealth(store, {
    lastLoginAt: lastLogin?.lastLoginAt ?? null,
    lastSaleAt: lastSale?.soldAt ?? null,
    catalog,
  });
}

export async function getStoreHealthBatch(
  stores: StoreInput[]
): Promise<Map<string, StoreHealth>> {
  if (!stores.length) return new Map();

  const ids = stores.map((s) => s.id);
  const [logins, sales, catalogMap] = await Promise.all([
    prisma.user.groupBy({
      by: ["restaurantId"],
      where: { restaurantId: { in: ids }, lastLoginAt: { not: null } },
      _max: { lastLoginAt: true },
    }),
    prisma.sale.groupBy({
      by: ["restaurantId"],
      where: { restaurantId: { in: ids } },
      _max: { soldAt: true },
    }),
    import("@/lib/catalog/health").then((m) => m.getCatalogHealthForStores(ids)),
  ]);

  const loginByStore = new Map(
    logins.map((r) => [r.restaurantId, r._max.lastLoginAt ?? null])
  );
  const saleByStore = new Map(
    sales.map((r) => [r.restaurantId, r._max.soldAt ?? null])
  );

  const out = new Map<string, StoreHealth>();
  for (const store of stores) {
    out.set(
      store.id,
      computeStoreHealth(store, {
        lastLoginAt: loginByStore.get(store.id) ?? null,
        lastSaleAt: saleByStore.get(store.id) ?? null,
        catalog: catalogMap.get(store.id) ?? null,
      })
    );
  }
  return out;
}

export type ChurnAlert = StoreHealth & { storeName: string };

export async function getChurnAlerts(
  stores: (StoreInput & { name: string })[],
  limit = 8
): Promise<ChurnAlert[]> {
  const healthMap = await getStoreHealthBatch(stores);
  return stores
    .map((s) => {
      const h = healthMap.get(s.id)!;
      return { ...h, storeName: s.name };
    })
    .filter((h) => h.risk === "critical" || h.risk === "at_risk")
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

export const HEALTH_RISK_LABEL: Record<HealthRisk, string> = {
  healthy: "Sain",
  at_risk: "À risque",
  critical: "Critique",
  churned: "Churné",
};
