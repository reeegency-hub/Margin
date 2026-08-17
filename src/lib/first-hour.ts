import { prisma } from "@/lib/db";
import { activeNavSection, type NavSection } from "@/lib/nav";

export type FirstHourItem = {
  id: string;
  label: string;
  done: boolean;
  href: string;
  cta: string;
  hint?: string;
  /** Peut être passée sans bloquer le parcours */
  optional?: boolean;
};

export type GuideSectionId = NavSection["id"];

export type SectionGuide = {
  section: GuideSectionId;
  badge: string;
  title: string;
  lead: string;
  items: FirstHourItem[];
  active: boolean;
};

export type GuideBundle = {
  home: SectionGuide;
  stock: SectionGuide;
  courses: SectionGuide;
  couts: SectionGuide;
  equipe: SectionGuide;
  magasin: SectionGuide;
};

export type FirstHourState = {
  items: FirstHourItem[];
  lead: string;
  active: boolean;
  bundle: GuideBundle;
};

export type FirstHourPageContext = {
  badge: string;
  title: string;
  lead: string;
  onTargetPage: boolean;
  focus: FirstHourItem;
  focusIndex: number;
};

/** Pages hub du menu — pas les sous-catégories. */
export const GUIDE_HUB_PATH: Record<GuideSectionId, string> = {
  home: "/",
  stock: "/ingredients",
  courses: "/orders",
  couts: "/costs",
  equipe: "/employees",
  magasin: "/settings",
};

type Progress = {
  productCount: number;
  inventoryStarted: number;
  inventoryValidated: number;
  inventoryThisWeek: number;
  orderCount: number;
  orderReceived: number;
  receiptCount: number;
  pricedReceiptCount: number;
  dishWithFoodCost: number;
  supplierCatalogPairs: number;
  employeeCount: number;
  shiftCount: number;
  attendanceCount: number;
  hasWhatsApp: boolean;
  hasCaisse: boolean;
  hasDelivery: boolean;
  isFranchise: boolean;
};

async function loadProgress(restaurantId: string): Promise<Progress | null> {
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: {
      plan: true,
      whatsappTo: true,
      onboardingCompletedAt: true,
    },
  });
  if (!restaurant?.onboardingCompletedAt) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  const [
    productCount,
    inventoryStarted,
    inventoryValidated,
    inventoryThisWeek,
    orderCount,
    orderReceived,
    receiptCount,
    pricedReceiptCount,
    dishWithFoodCost,
    supplierCatalogPairs,
    employeeCount,
    shiftCount,
    attendanceCount,
    posAny,
    posAccepted,
    deliveryConfigured,
  ] = await Promise.all([
    prisma.stockUnit.count({ where: { restaurantId } }),
    prisma.inventoryCount.count({ where: { restaurantId } }),
    prisma.inventoryCount.count({
      where: { restaurantId, status: "VALIDATED" },
    }),
    prisma.inventoryCount.count({
      where: {
        restaurantId,
        status: "VALIDATED",
        validatedAt: { gte: weekAgo },
      },
    }),
    prisma.purchaseOrder.count({ where: { restaurantId } }),
    prisma.purchaseOrder.count({
      where: { restaurantId, status: "RECEIVED" },
    }),
    prisma.supplierReceipt.count({ where: { restaurantId } }),
    prisma.supplierReceiptLine.count({
      where: { receipt: { restaurantId }, unitPrice: { not: null } },
    }),
    prisma.product.count({
      where: { restaurantId, foodCost: { not: null } },
    }),
    prisma.supplierCatalogItem
      .findMany({
        where: { supplier: { restaurantId } },
        select: { stockUnitId: true },
      })
      .then((all) => {
        const map = new Map<string, number>();
        for (const r of all)
          map.set(r.stockUnitId, (map.get(r.stockUnitId) || 0) + 1);
        return [...map.values()].filter((c) => c > 1).length;
      }),
    prisma.employee.count({ where: { restaurantId, active: true } }),
    prisma.shift.count({
      where: { employee: { restaurantId } },
    }),
    prisma.attendance.count({
      where: {
        employee: { restaurantId },
        createdAt: { gte: startOfDay },
      },
    }),
    prisma.externalPosConnection.count({ where: { restaurantId } }),
    prisma.posPendingProduct.count({
      where: { restaurantId, status: "ACCEPTED" },
    }),
    prisma.deliveryPlatformConnection.count({
      where: {
        restaurantId,
        OR: [
          { status: "CONNECTED" },
          { apiKeyEncrypted: { not: null } },
          { storeId: { not: null } },
        ],
      },
    }),
  ]);

  return {
    productCount,
    inventoryStarted,
    inventoryValidated,
    inventoryThisWeek,
    orderCount,
    orderReceived,
    receiptCount,
    pricedReceiptCount,
    dishWithFoodCost,
    supplierCatalogPairs,
    employeeCount,
    shiftCount,
    attendanceCount,
    hasWhatsApp: Boolean(restaurant.whatsappTo?.trim()),
    hasCaisse: posAny > 0 || posAccepted > 0,
    hasDelivery: deliveryConfigured > 0,
    isFranchise: restaurant.plan === "reseau",
  };
}

/** Stock → Niveaux & produits · Import · Vérification */
function buildStock(p: Progress): SectionGuide {
  const items: FirstHourItem[] = [
    {
      id: "stock-levels",
      label: "Niveaux & produits",
      done: p.productCount > 0,
      href: "/ingredients",
      cta: "Ajouter un produit",
      hint: "Remplissez le rayon — quantités et fiches produit.",
    },
    {
      id: "stock-import",
      label: "Import catalogue",
      done: p.productCount >= 5,
      href: "/ingredients/menu",
      cta: "Importer un catalogue",
      hint: "Chargez plusieurs produits d’un coup si besoin (optionnel).",
      optional: true,
    },
    {
      id: "stock-count",
      label: "Vérification",
      done: p.inventoryValidated > 0 || p.inventoryStarted > 0,
      href: "/inventory",
      cta: "Lancer une vérification",
      hint: "Corrigez ce qui est vraiment en rayon.",
    },
  ];
  return {
    section: "stock",
    badge: "Menu Stock",
    title: "Parcours Stock",
    lead: "Produits, import, vérification — les 3 sous-menus Stock.",
    items,
    active: items.some((i) => !i.optional && !i.done),
  };
}

/** Courses — liste puis « fait » (le stock se met à jour au marquage) */
function buildCourses(p: Progress): SectionGuide {
  const items: FirstHourItem[] = [
    {
      id: "courses-list",
      label: "Préparer une liste",
      done: p.orderCount > 0,
      href: "/orders",
      cta: "Ouvrir les courses",
      hint: "À partir du stock bas — besoins détectés sur la page Courses.",
    },
    {
      id: "courses-do",
      label: "Faire les courses",
      done: p.orderReceived > 0 || p.receiptCount > 0,
      href: "/orders",
      cta: "Marquer comme fait",
      hint: "Quand c’est acheté, validez — le stock se réintègre automatiquement.",
    },
  ];
  return {
    section: "courses",
    badge: "Menu Courses",
    title: "Parcours Courses",
    lead: "Liste → courses → stock à jour (au marquage).",
    items,
    active: items.some((i) => !i.done),
  };
}

/** Équipe → Membres · Planning · Pointer */
function buildEquipe(p: Progress): SectionGuide {
  const items: FirstHourItem[] = [
    {
      id: "team-members",
      label: "Membres",
      done: p.employeeCount > 0,
      href: "/employees",
      cta: "Ajouter un prénom",
      hint: "Les personnes qui travaillent au commerce.",
    },
    {
      id: "team-planning",
      label: "Planning",
      done: p.shiftCount > 0,
      href: "/employees/planning",
      cta: "Ouvrir le planning",
      hint: "Créneaux et présence prévue.",
    },
    {
      id: "team-clock",
      label: "Pointer l’équipe",
      done: p.attendanceCount > 0,
      href: "/employees",
      cta: "Pointer quelqu’un",
      hint: "Présent / Absent — le matin, en un geste.",
    },
  ];
  return {
    section: "equipe",
    badge: "Menu Équipe",
    title: "Parcours Équipe",
    lead: "Membres, planning, pointage — le quotidien de l’équipe.",
    items,
    active: items.some((i) => !i.done),
  };
}

/** Commerce → Caisse · Livraison · Réglages */
function buildMagasin(p: Progress): SectionGuide {
  const items: FirstHourItem[] = [
    {
      id: "shop-pos",
      label: "Caisse",
      done: p.hasCaisse,
      href: "/kiosks",
      cta: "Brancher la caisse",
      hint: p.isFranchise
        ? "Indiquez Zelty, Cashpad… on branche pour vous."
        : "Indiquez votre logiciel de caisse.",
    },
    {
      id: "shop-delivery",
      label: "Livraison",
      done: p.hasDelivery,
      href: "/delivery",
      cta: "Configurer la livraison",
      hint: "Uber, Deliveroo… seulement si vous livrez (optionnel).",
      optional: true,
    },
    {
      id: "shop-settings",
      label: "Réglages",
      done: p.hasWhatsApp,
      href: "/settings",
      cta: "Ajouter mon WhatsApp",
      hint: "Numéro du commerce pour les alertes et listes.",
    },
  ];
  // Livraison optionnelle : ne bloque pas la fin du parcours Commerce
  const requiredDone = p.hasCaisse && p.hasWhatsApp;
  return {
    section: "magasin",
    badge: "Menu Commerce",
    title: "Parcours Commerce",
    lead: "Caisse, livraison, réglages — les 3 sous-menus Commerce.",
    items,
    active: !requiredDone,
  };
}

/**
 * Accueil = checklist complète pour un commerce vraiment opérationnel.
 * Chaque étape a son CTA direct (pas un résumé de menus).
 */
function buildHome(p: Progress): SectionGuide {
  const items: FirstHourItem[] = [
    {
      id: "home-wa",
      label: "WhatsApp du commerce",
      done: p.hasWhatsApp,
      href: "/settings",
      cta: "Ajouter mon numéro",
      hint: "Alertes rupture et listes sur le téléphone.",
    },
    {
      id: "home-pos",
      label: "Brancher la caisse",
      done: p.hasCaisse,
      href: "/kiosks",
      cta: "Indiquer ma caisse",
      hint: p.isFranchise
        ? "Zelty, Cashpad… on branche pour vous."
        : "Votre logiciel de caisse pour synchroniser les ventes.",
    },
    {
      id: "home-orders",
      label: "Première liste de courses",
      done: p.orderCount > 0,
      href: "/orders",
      cta: "Ouvrir les courses",
      hint: "Réassort après stock bas → liste → marquer comme fait.",
    },
    {
      id: "home-products",
      label: "Remplir le stock",
      done: p.productCount > 0,
      href: "/ingredients",
      cta: "Ajouter des produits",
      hint: "Sans produits, pas de niveaux ni d’alertes.",
    },
    {
      id: "home-import",
      label: "Importer un catalogue",
      done: p.productCount >= 5,
      href: "/ingredients/menu",
      cta: "Importer le catalogue",
      hint: "Chargez plusieurs références d’un coup (optionnel).",
      optional: true,
    },
    {
      id: "home-count",
      label: "Compter le rayon",
      done: p.inventoryValidated > 0 || p.inventoryStarted > 0,
      href: "/inventory",
      cta: "Lancer une vérification",
      hint: "Alignez les quantités Margin sur le vrai stock.",
    },
    {
      id: "home-team",
      label: "Ajouter l’équipe",
      done: p.employeeCount > 0,
      href: "/employees",
      cta: "Ajouter un prénom",
      hint: "Les personnes qui ouvrent et ferment le commerce.",
    },
    {
      id: "home-planning",
      label: "Planifier les créneaux",
      done: p.shiftCount > 0,
      href: "/employees/planning",
      cta: "Ouvrir le planning",
      hint: "Qui travaille quand — pour pouvoir pointer.",
    },
    {
      id: "home-clock",
      label: "Pointer Présent / Absent",
      done: p.attendanceCount > 0,
      href: "/employees",
      cta: "Pointer quelqu’un",
      hint: "Un geste le matin pour le suivi d’heures.",
    },
    {
      id: "home-invoice",
      label: "Importer une facture fournisseur",
      done: p.pricedReceiptCount > 0,
      href: "/costs#facture",
      cta: "Importer",
      hint: "CSV, PDF ou photo — review qty / prix / match obligatoire.",
    },
    {
      id: "home-foodcost",
      label: "Coût d’achat des best-sellers",
      done: p.dishWithFoodCost > 0,
      href: "/costs#matiere",
      cta: "Voir les marges",
      hint: "Il faut factures + ventes + fiches produit pour calculer la matière.",
    },
    {
      id: "home-weekly-inv",
      label: "Inventaire de la semaine",
      done: p.inventoryThisWeek > 0,
      href: "/inventory",
      cta: "Compter le rayon",
      hint: "Une fois par semaine. Les pertes en € se consultent dans Coûts → Pertes.",
    },
    {
      id: "home-negotiate",
      label: "Comparer & négocier (mensuel)",
      done: p.supplierCatalogPairs > 0,
      href: "/costs#negocier",
      cta: "Voir le comparatif",
      hint: "Une fois par mois — prix d’achat entre fournisseurs (optionnel).",
      optional: true,
    },
    {
      id: "home-delivery",
      label: "Livraison (optionnel)",
      done: p.hasDelivery,
      href: "/delivery",
      cta: "Configurer Uber / Deliveroo",
      hint: "Uniquement si vous livrez — sinon ignorez.",
      optional: true,
    },
  ];

  // Optimal = socle + stock + équipe + courses + coûts (livraison / import / négocier soft)
  const requiredIds = new Set([
    "home-wa",
    "home-pos",
    "home-orders",
    "home-products",
    "home-count",
    "home-team",
    "home-planning",
    "home-invoice",
    "home-weekly-inv",
  ]);
  const requiredOpen = items.some((i) => requiredIds.has(i.id) && !i.done);

  return {
    section: "home",
    badge: "Accueil",
    title: "Mettre le commerce au point",
    lead: "Le Copilote à droite + tous les gestes pour être opérationnel — cliquez chaque CTA.",
    items,
    active: requiredOpen,
  };
}

/** Coûts → Facture · Hausses · Négocier (pertes € = #pertes, pas le hub Vérification) */
function buildCouts(p: Progress): SectionGuide {
  const items: FirstHourItem[] = [
    {
      id: "cost-invoice",
      label: "Facture fournisseur",
      done: p.pricedReceiptCount > 0,
      href: "/costs#facture",
      cta: "Importer",
      hint: "CSV, PDF ou photo — review qty / prix / match obligatoire.",
    },
    {
      id: "cost-hikes",
      label: "Hausses fournisseurs",
      done: p.pricedReceiptCount > 0,
      href: "/costs#hausses",
      cta: "Voir les hausses",
      hint: "Les prix qui montent ≥ 5 % apparaissent ici.",
    },
    {
      id: "cost-negotiate",
      label: "Comparer & négocier",
      done: p.supplierCatalogPairs > 0,
      href: "/costs#negocier",
      cta: "Ouvrir le comparatif",
      hint: "Une fois par mois — écarts entre fournisseurs.",
      optional: true,
    },
  ];
  return {
    section: "couts",
    badge: "Menu Coûts",
    title: "Parcours Coûts",
    lead: "Factures → hausses → négocier. Pertes € dans #pertes ; matière après ventes + fiches.",
    items,
    active: items.some((i) => !i.optional && !i.done),
  };
}

export async function getGuideBundle(
  restaurantId: string
): Promise<GuideBundle | null> {
  const p = await loadProgress(restaurantId);
  if (!p) return null;

  const stock = buildStock(p);
  const courses = buildCourses(p);
  const couts = buildCouts(p);
  const equipe = buildEquipe(p);
  const magasin = buildMagasin(p);
  const home = buildHome(p);

  return { home, stock, courses, couts, equipe, magasin };
}

export async function getFirstHourState(
  restaurantId: string
): Promise<FirstHourState | null> {
  const bundle = await getGuideBundle(restaurantId);
  if (!bundle) return null;
  const anyActive = Object.values(bundle).some((g) => g.active);
  return {
    items: bundle.home.items,
    lead: bundle.home.lead,
    active: anyActive,
    bundle,
  };
}

/** Affiche le guide uniquement sur la page hub du menu (pas les sous-pages). */
export function pickSectionGuide(
  bundle: GuideBundle,
  pathname: string
): SectionGuide | null {
  const section = activeNavSection(pathname);
  if (!section) return null;
  if (pathname !== GUIDE_HUB_PATH[section]) return null;
  const guide = bundle[section];
  if (!guide?.active) return null;
  return guide;
}

export function getFirstHourPageContext(
  guide: SectionGuide
): FirstHourPageContext {
  const focusIndex = Math.max(0, guide.items.findIndex((i) => !i.done));
  const focus = guide.items[focusIndex]!;
  return {
    badge: guide.badge,
    title: guide.title,
    lead: guide.lead,
    onTargetPage: true,
    focus,
    focusIndex,
  };
}

export function isFirstHourWindow(anchor: Date | null | undefined): boolean {
  if (!anchor) return false;
  const ms = Date.now() - anchor.getTime();
  return ms >= 0 && ms < 14 * 24 * 60 * 60 * 1000;
}
