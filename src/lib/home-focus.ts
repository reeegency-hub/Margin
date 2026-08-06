import type { CostPilotSnapshot } from "@/lib/cost-engine";
import type { DayFocusItem } from "@/components/home/DayFocus";

type CriticalItem = { name: string };

/**
 * Tous les focus jour / semaine / mois à gérer depuis l’Accueil.
 * Tri : urgents du jour d’abord, puis semaine, puis mois.
 */
export function buildDayWeekFocuses(input: {
  costPilot: CostPilotSnapshot;
  ordersToValidate: number;
  critical: CriticalItem[];
  offlineKiosks: number;
  alert?: {
    badgeLabel: string;
    message: string;
    ctaLabel: string;
    ctaHref?: string;
    orderId?: string;
  } | null;
}): DayFocusItem[] {
  const { costPilot, ordersToValidate, critical, offlineKiosks, alert } = input;
  const items: DayFocusItem[] = [];

  // ——— Jour ———
  if (costPilot.hikesToday.length > 0) {
    const h = costPilot.hikesToday[0]!;
    items.push({
      id: "hikes-today",
      cadence: "day",
      urgency: "high",
      title: "Hausse fournisseur",
      message: `${h.name} +${h.deltaPct} % — coût matière recalculé aujourd’hui${
        costPilot.hikesToday.length > 1
          ? ` · +${costPilot.hikesToday.length - 1} autre(s)`
          : ""
      }.`,
      ctaLabel: "Voir les hausses",
      ctaHref: "/costs#hausses",
    });
  }

  if (offlineKiosks > 0) {
    items.push({
      id: "kiosk-offline",
      cadence: "day",
      urgency: "high",
      title: "Caisse à vérifier",
      message: `${offlineKiosks} caisse${offlineKiosks > 1 ? "s" : ""} ne remonte${offlineKiosks > 1 ? "nt" : ""} plus les ventes.`,
      ctaLabel: "Ouvrir la caisse",
      ctaHref: "/kiosks",
    });
  }

  if (critical.length > 0) {
    items.push({
      id: "stock-low",
      cadence: "day",
      urgency: "high",
      title: "Stock bas",
      message: `${critical[0]!.name}${
        critical.length > 1 ? ` et ${critical.length - 1} autre(s)` : ""
      } sous le seuil — préparez la liste.`,
      ctaLabel: "Préparer la liste",
      ctaHref: "/orders",
    });
  }

  if (ordersToValidate > 0) {
    items.push({
      id: "orders",
      cadence: "day",
      urgency: "high",
      title: "Courses à faire",
      message: `${ordersToValidate} liste${ordersToValidate > 1 ? "s" : ""} en attente — marquez comme fait une fois passées.`,
      ctaLabel: "Ouvrir les courses",
      ctaHref: "/orders",
    });
  }

  if (alert && !items.some((i) => i.id === "orders" || i.id === "stock-low")) {
    items.push({
      id: "alert",
      cadence: "day",
      urgency: "high",
      title: alert.badgeLabel,
      message: alert.message,
      ctaLabel: alert.ctaLabel,
      ctaHref: alert.ctaHref || "/orders",
      orderId: alert.orderId,
    });
  }

  // ——— Semaine ———
  if (costPilot.weeklyLoss.needsInventory) {
    items.push({
      id: "weekly-inv",
      cadence: "week",
      urgency: "high",
      title: "Inventaire de la semaine",
      message:
        "Vérifiez le rayon (hub Vérification). Les pertes en € se consultent ensuite dans Coûts → Pertes.",
      ctaLabel: "Lancer la vérification",
      ctaHref: "/inventory",
    });
  } else if (costPilot.weeklyLoss.lossEur > 0) {
    items.push({
      id: "weekly-loss-review",
      cadence: "week",
      title: "Pertes de la semaine",
      message: `${costPilot.weeklyLoss.lossEur.toFixed(2)} € de pertes · net ${costPilot.weeklyLoss.netEur.toFixed(2)} €. Vérifiez les plus gros écarts.`,
      ctaLabel: "Voir les pertes",
      ctaHref: "/costs#pertes",
    });
  }

  if (costPilot.hikesWeek.length > 0 && costPilot.hikesToday.length === 0) {
    items.push({
      id: "hikes-week",
      cadence: "week",
      title: "Hausses cette semaine",
      message: `${costPilot.hikesWeek.length} produit${costPilot.hikesWeek.length > 1 ? "s" : ""} ont monté ≥ 5 % — surveillez le coût matière.`,
      ctaLabel: "Voir les hausses",
      ctaHref: "/costs#hausses",
    });
  }

  if (costPilot.pricedLineCount === 0) {
    items.push({
      id: "invoice",
      cadence: "week",
      title: "Importer une facture",
      message:
        "Sans prix d’achat, pas de hausses ni de coût matière. Importez le CSV ou la photo fournisseur.",
      ctaLabel: "Importer",
      ctaHref: "/costs#facture",
    });
  }

  const dishesMissingCost = costPilot.topDishCosts.filter(
    (d) => d.foodCost == null
  ).length;
  if (costPilot.topDishCosts.length > 0 && dishesMissingCost > 0) {
    items.push({
      id: "foodcost-gaps",
      cadence: "week",
      title: "Coût matière incomplet",
      message: `${dishesMissingCost} best-seller${dishesMissingCost > 1 ? "s" : ""} sans coût matière — il faut factures + ventes + fiches produit.`,
      ctaLabel: "Voir la matière",
      ctaHref: "/costs#matiere",
    });
  }

  // ——— Mois ———
  if (costPilot.supplierCompare.length > 0) {
    items.push({
      id: "negotiate",
      cadence: "month",
      title: "Négocier les tarifs",
      message: `${costPilot.monthlySavingsPotential.toFixed(2)} € / unité à récupérer en changeant de fournisseur sur ${costPilot.supplierCompare.length} produit${costPilot.supplierCompare.length > 1 ? "s" : ""}.`,
      ctaLabel: "Ouvrir le comparatif",
      ctaHref: "/costs#negocier",
    });
  } else if (costPilot.pricedLineCount > 0) {
    items.push({
      id: "negotiate-setup",
      cadence: "month",
      title: "Comparer les fournisseurs",
      message:
        "Une fois par mois : ajoutez un 2ᵉ tarif sur le même produit pour négocier.",
      ctaLabel: "Voir comment faire",
      ctaHref: "/costs#negocier",
    });
  }

  if (items.length === 0) {
    items.push({
      id: "all-clear",
      cadence: "day",
      title: "Rien d’urgent",
      message:
        "Jour et semaine sous contrôle. Vérifiez le stock ou vérifiez le rayon quand vous voulez.",
      ctaLabel: "Voir le stock",
      ctaHref: "/ingredients",
      done: true,
    });
  }

  const rank = (i: DayFocusItem) => {
    const u = i.urgency === "high" ? 0 : 1;
    const c = i.cadence === "day" ? 0 : i.cadence === "week" ? 1 : 2;
    const d = i.done ? 1 : 0;
    return d * 100 + c * 10 + u;
  };

  return items.sort((a, b) => rank(a) - rank(b));
}

function sortFocuses(items: DayFocusItem[]): DayFocusItem[] {
  const rank = (i: DayFocusItem) => {
    const u = i.urgency === "high" ? 0 : 1;
    const c = i.cadence === "day" ? 0 : i.cadence === "week" ? 1 : 2;
    const d = i.done ? 1 : 0;
    return d * 100 + c * 10 + u;
  };
  return [...items].sort((a, b) => rank(a) - rank(b));
}

function orClear(
  items: DayFocusItem[],
  clear: DayFocusItem
): DayFocusItem[] {
  return items.length ? sortFocuses(items) : [clear];
}

/** Focus hub Stock */
export function buildStockFocuses(input: {
  productCount: number;
  criticalCount: number;
  criticalName?: string;
  needsInventory: boolean;
  openInventoryCount?: number;
}): DayFocusItem[] {
  const items: DayFocusItem[] = [];
  if (input.productCount === 0) {
    items.push({
      id: "stock-empty",
      cadence: "day",
      urgency: "high",
      title: "Remplir le stock",
      message: "Ajoutez vos premiers produits — sans ça, pas d’alertes ni de courses.",
      ctaLabel: "Ajouter un produit",
      ctaHref: "/ingredients",
    });
  }
  if (input.criticalCount > 0) {
    items.push({
      id: "stock-critical",
      cadence: "day",
      urgency: "high",
      title: "Stock bas",
      message: `${input.criticalName || "Des produits"}${
        input.criticalCount > 1 ? ` et ${input.criticalCount - 1} autre(s)` : ""
      } sous le seuil.`,
      ctaLabel: "Préparer la liste",
      ctaHref: "/orders",
    });
  }
  if ((input.openInventoryCount ?? 0) > 0) {
    items.push({
      id: "stock-inv-open",
      cadence: "day",
      urgency: "high",
      title: "Vérification en cours",
      message: "Terminez la vérification pour aligner les quantités sur le rayon.",
      ctaLabel: "Reprendre la vérification",
      ctaHref: "/inventory",
    });
  }
  if (input.needsInventory) {
    items.push({
      id: "stock-weekly",
      cadence: "week",
      urgency: "high",
      title: "Inventaire de la semaine",
      message: "Vérifiez le rayon — les écarts sont valorisés en euros.",
      ctaLabel: "Lancer une vérification",
      ctaHref: "/inventory",
    });
  }
  if (input.productCount > 0 && input.productCount < 5) {
    items.push({
      id: "stock-import",
      cadence: "week",
      title: "Importer un catalogue",
      message: "Chargez plusieurs références d’un coup pour accélérer.",
      ctaLabel: "Import catalogue",
      ctaHref: "/ingredients/menu",
    });
  }
  return orClear(items, {
    id: "stock-ok",
    cadence: "day",
    title: "Stock sous contrôle",
    message: "Rien d’urgent. Ajustez un seuil ou lancez une vérification si besoin.",
    ctaLabel: "Voir les niveaux",
    ctaHref: "/ingredients",
    done: true,
  });
}

/** Focus hub Courses — pas d’étape « réintégrer » (déjà fait au marquage) */
export function buildCoursesFocuses(input: {
  ordersToValidate: number;
  needsCount: number;
}): DayFocusItem[] {
  const items: DayFocusItem[] = [];
  if (input.needsCount > 0 && input.ordersToValidate === 0) {
    items.push({
      id: "courses-needs",
      cadence: "day",
      urgency: "high",
      title: "Créer une liste de courses",
      message: `${input.needsCount} besoin${input.needsCount > 1 ? "s" : ""} détecté${input.needsCount > 1 ? "s" : ""} — générez la liste avant d’acheter.`,
      ctaLabel: "Créer une liste",
      ctaHref: "/orders",
    });
  }
  if (input.ordersToValidate > 0) {
    items.push({
      id: "courses-do",
      cadence: "day",
      urgency: "high",
      title: "Courses à faire",
      message: `${input.ordersToValidate} liste${input.ordersToValidate > 1 ? "s" : ""} en attente — marquez comme fait une fois passées (stock mis à jour).`,
      ctaLabel: "Marquer comme fait",
      ctaHref: "/orders",
    });
  } else if (input.needsCount > 0) {
    items.push({
      id: "courses-list",
      cadence: "day",
      title: "Besoins à jour",
      message: "Ouvrez Courses pour créer ou actualiser la liste depuis le stock bas.",
      ctaLabel: "Ouvrir les courses",
      ctaHref: "/orders",
    });
  }
  return orClear(items, {
    id: "courses-ok",
    cadence: "day",
    title: "Rien à acheter",
    message: "Pas de besoins détectés. Créez quand même une liste si vous anticipez.",
    ctaLabel: "Créer une liste",
    ctaHref: "/orders",
    done: true,
  });
}

/** Focus hub Coûts */
export function buildCostsFocuses(costPilot: CostPilotSnapshot): DayFocusItem[] {
  return buildDayWeekFocuses({
    costPilot,
    ordersToValidate: 0,
    critical: [],
    offlineKiosks: 0,
  }).filter((i) =>
    [
      "hikes-today",
      "hikes-week",
      "weekly-inv",
      "weekly-loss-review",
      "invoice",
      "foodcost-gaps",
      "negotiate",
      "negotiate-setup",
      "all-clear",
    ].includes(i.id)
  );
}

/** Focus hub Équipe */
export function buildEquipeFocuses(input: {
  employeeCount: number;
  shiftCount: number;
  pendingClock: number;
  understaffed?: boolean;
  understaffRole?: string;
}): DayFocusItem[] {
  const items: DayFocusItem[] = [];
  if (input.employeeCount === 0) {
    items.push({
      id: "team-add",
      cadence: "day",
      urgency: "high",
      title: "Ajouter l’équipe",
      message: "Ajoutez au moins un prénom pour pouvoir pointer.",
      ctaLabel: "Ajouter un membre",
      ctaHref: "/employees",
    });
  }
  if (input.employeeCount > 0 && input.shiftCount === 0) {
    items.push({
      id: "team-plan",
      cadence: "day",
      urgency: "high",
      title: "Planifier aujourd’hui",
      message: "Créez les créneaux du jour en un clic, puis pointez.",
      ctaLabel: "Ouvrir le planning",
      ctaHref: "/employees/planning",
    });
  }
  if (input.pendingClock > 0) {
    items.push({
      id: "team-clock",
      cadence: "day",
      urgency: "high",
      title: "Pointer l’équipe",
      message: `${input.pendingClock} personne${input.pendingClock > 1 ? "s" : ""} sans pointage ce matin.`,
      ctaLabel: "Pointer maintenant",
      ctaHref: "/employees",
    });
  }
  if (input.understaffed) {
    items.push({
      id: "team-staff",
      cadence: "day",
      urgency: "high",
      title: "Manque de présence",
      message: `Attention : manque en ${input.understaffRole || "équipe"}.`,
      ctaLabel: "Voir le planning",
      ctaHref: "/employees/planning",
    });
  }
  return orClear(items, {
    id: "team-ok",
    cadence: "day",
    title: "Équipe à jour",
    message: "Pointages OK. Ajustez le planning si besoin.",
    ctaLabel: "Voir le planning",
    ctaHref: "/employees/planning",
    done: true,
  });
}

/** Focus hub Magasin (réglages) */
export function buildMagasinFocuses(input: {
  hasWhatsApp: boolean;
  hasCaisse: boolean;
  hasDelivery: boolean;
  paymentFailed?: boolean;
}): DayFocusItem[] {
  const items: DayFocusItem[] = [];
  if (input.paymentFailed) {
    items.push({
      id: "shop-billing",
      cadence: "day",
      urgency: "high",
      title: "Paiement en échec",
      message: "Mettez à jour votre moyen de paiement pour garder l’accès.",
      ctaLabel: "Gérer l’abonnement",
      ctaHref: "/settings",
    });
  }
  if (!input.hasWhatsApp) {
    items.push({
      id: "shop-wa",
      cadence: "day",
      urgency: "high",
      title: "WhatsApp du magasin",
      message: "Ajoutez le numéro pour alertes rupture et listes.",
      ctaLabel: "Ajouter mon numéro",
      ctaHref: "/settings",
    });
  }
  if (!input.hasCaisse) {
    items.push({
      id: "shop-pos",
      cadence: "day",
      urgency: "high",
      title: "Brancher la caisse",
      message: "Indiquez Zelty, Cashpad… pour synchroniser les ventes.",
      ctaLabel: "Ouvrir la caisse",
      ctaHref: "/kiosks",
    });
  }
  if (!input.hasDelivery) {
    items.push({
      id: "shop-delivery",
      cadence: "week",
      title: "Livraison (optionnel)",
      message: "Uber / Deliveroo seulement si vous livrez — sinon ignorez.",
      ctaLabel: "Configurer",
      ctaHref: "/delivery",
    });
  }
  return orClear(items, {
    id: "shop-ok",
    cadence: "day",
    title: "Magasin branché",
    message: "WhatsApp et caisse OK. Ajustez les options quand vous voulez.",
    ctaLabel: "Voir les réglages",
    ctaHref: "/settings",
    done: true,
  });
}
