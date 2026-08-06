import { euro } from "@/lib/dashboard";
import { formatQty } from "@/lib/stock-engine";
import { roleLabel, type StaffingAlert } from "@/lib/employee-engine";
import { CHANNEL_LABELS } from "@/lib/channels";

export type FocusIssue = {
  status: "urgent" | "ok";
  /** Ce qui ne va pas — phrase humaine */
  problem: string;
  /** Ce que ça coûte / impact en argent ou temps */
  costLabel: string;
  costDetail: string;
  /** Unique CTA */
  ctaLabel: string;
  ctaHref?: string;
  /** Pour actions form server */
  ctaForm?: "validateOrder" | "resolveAlert" | "whatsappAlert";
  ctaId?: string;
  /** Second niveau (ingénieur) */
  details: {
    title: string;
    lines: string[];
  }[];
};

type AlertLike = {
  id: string;
  severity: number;
  title: string;
  constat: string;
  cause: string | null;
  impact: string;
  action: string;
  type: string;
  ingredientId: string | null;
  ingredient: {
    name: string;
    unit: string;
    stockTheoretical: number;
    reorderQty: number;
    criticalThreshold: number;
  } | null;
};

type OrderLike = {
  id: string;
  totalAmount: number;
  status?: string;
  supplier: { name: string };
  lines: { quantity: number; ingredient: { name: string; unit: string } }[];
};

type KioskLike = { id: string; name: string; locationLabel: string };
type OutageLike = {
  id: string;
  platform: string;
  estimatedLostRevenue: number;
};

export function buildFocusIssue(input: {
  alerts: AlertLike[];
  criticalCount: number;
  orders: OrderLike[];
  staffing: StaffingAlert[];
  offlineKiosks: KioskLike[];
  openOutages: OutageLike[];
  caToday: number;
  caWeek: number;
  ticketMoyen: number;
  salesTodayCount: number;
}): FocusIssue {
  const detailsBase = [
    {
      title: "Chiffres du jour",
      lines: [
        `Argent encaissé aujourd’hui : ${euro(input.caToday)}`,
        `Cette semaine : ${euro(input.caWeek)}`,
        `Panier moyen : ${euro(input.ticketMoyen)} (${input.salesTodayCount} tickets)`,
      ],
    },
  ];

  // 1) Outage livraison — perte silencieuse
  const outage = input.openOutages[0];
  if (outage) {
    const platform = CHANNEL_LABELS[outage.platform] ?? outage.platform;
    return {
      status: "urgent",
      problem: `${platform} est coupé. Les clients ne peuvent plus commander chez vous sur cette appli.`,
      costLabel: euro(outage.estimatedLostRevenue),
      costDetail: "argent que vous risquez de perdre sur ce créneau si ça reste coupé",
      ctaLabel: "Remettre en ligne maintenant",
      ctaHref: "/delivery",
      details: [
        {
          title: "Pourquoi c’est urgent",
          lines: [
            `Plateforme : ${platform}`,
            `Perte estimée : ${euro(outage.estimatedLostRevenue)}`,
            "Les clients voient le restaurant fermé sans que vous le sachiez.",
          ],
        },
        ...detailsBase,
      ],
    };
  }

  // 2) Stock critique (alerte ou liste)
  const stockAlert =
    input.alerts.find((a) => a.type === "STOCK_CRITICAL") ||
    input.alerts.find((a) => a.ingredientId);
  if (stockAlert?.ingredient) {
    const ing = stockAlert.ingredient;
    const lostCovers = Math.max(
      8,
      Math.round((ing.criticalThreshold - ing.stockTheoretical) / 40)
    );
    const lostMoney = lostCovers * 18;
    return {
      status: "urgent",
      problem: `Il va bientôt manquer de ${ing.name.toLowerCase()}. Sans courses, vous risquez de retirer ce produit du rayon.`,
      costLabel: euro(lostMoney),
      costDetail: `argent de ventes perdues estimé si rupture (environ ${lostCovers} couverts)`,
      ctaLabel: "Voir la liste",
      ctaHref: "/orders",
      details: [
        {
          title: "Détail stock",
          lines: [
            stockAlert.constat,
            stockAlert.cause || "",
            stockAlert.impact,
            `Action prévue : ${stockAlert.action}`,
            `Reste : ${formatQty(ing.stockTheoretical, ing.unit, ing.name)} · Seuil : ${formatQty(ing.criticalThreshold, ing.unit, ing.name)}`,
          ].filter(Boolean),
        },
        ...detailsBase,
      ],
    };
  }

  if (input.criticalCount > 0 && input.orders[0]) {
    const order = input.orders[0];
    const lines = order.lines
      .map(
        (l) =>
          `${formatQty(l.quantity, l.ingredient.unit, l.ingredient.name)} ${l.ingredient.name}`
      )
      .join(", ");
    return {
      status: "urgent",
      problem: `Une liste de courses attend d’être faite (${lines}).`,
      costLabel: euro(order.totalAmount || 0),
      costDetail: "à racheter pour éviter la rupture",
      ctaLabel: "Marquer comme fait",
      ctaForm: "validateOrder",
      ctaId: order.id,
      details: [
        {
          title: "Liste proposée",
          lines: [`Produits : ${lines}`, `Statut : ${order.status}`],
        },
        ...detailsBase,
      ],
    };
  }

  if (input.criticalCount > 0) {
    return {
      status: "urgent",
      problem: `${input.criticalCount} produit${input.criticalCount > 1 ? "s" : ""} bientôt en rupture. Il faut racheter avant le service.`,
      costLabel: "Service en danger",
      costDetail: "risque de produits indisponibles",
      ctaLabel: "Voir quoi racheter",
      ctaHref: "/orders",
      details: detailsBase,
    };
  }

  // 3) Borne offline
  const kiosk = input.offlineKiosks[0];
  if (kiosk) {
    return {
      status: "urgent",
      problem: `La borne « ${kiosk.name} » (${kiosk.locationLabel}) ne prend plus de commandes.`,
      costLabel: "File d’attente plus longue",
      costDetail: "les clients attendent à la caisse au lieu de commander seuls",
      ctaLabel: "Remettre la borne en marche",
      ctaHref: "/kiosks",
      details: detailsBase,
    };
  }

  // 4) Sous-effectif
  const staff = input.staffing[0];
  if (staff) {
    const lost = 400;
    return {
      status: "urgent",
      problem: `Pas assez de monde en ${roleLabel(staff.role)} le ${staff.date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} (${staff.planned} au lieu de ${staff.recommended}).`,
      costLabel: euro(lost),
      costDetail: "ventes perdues possibles si le service est trop lent",
      ctaLabel: "Ajuster l’équipe",
      ctaHref: "/employees",
      details: [
        {
          title: "Planning",
          lines: [staff.impact, staff.action],
        },
        ...detailsBase,
      ],
    };
  }

  // 5) Autre alerte
  const other = input.alerts[0];
  if (other) {
    return {
      status: "urgent",
      problem: other.constat,
      costLabel: "À traiter",
      costDetail: other.impact,
      ctaLabel: "Corriger maintenant",
      ctaHref: other.ingredientId ? "/orders" : "/",
      ctaForm: "resolveAlert",
      ctaId: other.id,
      details: [
        {
          title: "Détail",
          lines: [other.cause || "", other.impact, other.action].filter(Boolean),
        },
        ...detailsBase,
      ],
    };
  }

  // 6) Commande à valider sans stock critique
  if (input.orders[0]) {
    const order = input.orders[0];
    return {
      status: "urgent",
      problem: `Commande prête chez ${order.supplier.name} — il ne reste plus qu’à dire oui.`,
      costLabel: euro(order.totalAmount),
      costDetail: "montant de la commande en attente",
      ctaLabel: "Valider la commande",
      ctaForm: "validateOrder",
      ctaId: order.id,
      details: detailsBase,
    };
  }

  return {
    status: "ok",
    problem: "Tout va bien pour le moment. Aucune urgence à traiter.",
    costLabel: euro(input.caToday),
    costDetail: "argent encaissé aujourd’hui — rien à corriger",
    ctaLabel: "Enregistrer une vente",
    ctaHref: "/sales/new",
    details: [
      ...detailsBase,
      {
        title: "Rappel",
        lines: [
          "Vous pouvez préparer le menu (Stock → Menu IA), faire un inventaire, ou vérifier l’équipe.",
        ],
      },
    ],
  };
}
