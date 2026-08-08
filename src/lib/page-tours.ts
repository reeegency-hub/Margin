/**
 * Tours de première visite — une fois par page / hub.
 * Chaque étape ancre la bulle près de l’action concernée.
 */

export type PageTourStep = {
  id: string;
  title: string;
  body: string;
  /** Sélecteur CSS de la zone à mettre en avant */
  anchor: string;
  /** Position de la bulle par rapport à l’ancre */
  placement?: "bottom" | "top" | "right" | "left";
};

export type PageTour = {
  pageKey: string;
  label: string;
  match: (pathname: string) => boolean;
  steps: PageTourStep[];
};

function startsWithAny(pathname: string, prefixes: string[]) {
  return prefixes.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
}

export const PAGE_TOURS: PageTour[] = [
  {
    pageKey: "stock",
    label: "Stock",
    match: (p) => startsWithAny(p, ["/ingredients", "/dishes"]),
    steps: [
      {
        id: "stock-1",
        title: "Voici votre stock",
        body: "Les niveaux et alertes apparaissent ici.",
        anchor: '[data-tour="stock-levels"], .day-focus, .stock-workspace',
        placement: "bottom",
      },
      {
        id: "stock-2",
        title: "Ajoutez vos produits",
        body: "Créez une fiche (nom + quantité) ou importez un catalogue.",
        anchor:
          '[data-tour="stock-add"], .stock-feature--next, .catalog-panel__head',
        placement: "bottom",
      },
      {
        id: "stock-3",
        title: "Vérifiez le rayon",
        body: "Quand ça ne colle plus, lancez une vérification.",
        anchor: '[data-tour="stock-count"], a[href="/inventory"]',
        placement: "bottom",
      },
    ],
  },
  {
    pageKey: "inventory",
    label: "Vérification",
    match: (p) => startsWithAny(p, ["/inventory"]),
    steps: [
      {
        id: "inv-1",
        title: "Vérification du rayon",
        body: "Corrigez les quantités physiques — pas d’ajout de produits ici.",
        anchor: '[data-tour="stock-count"], .inv-workspace, .day-focus',
        placement: "bottom",
      },
      {
        id: "inv-2",
        title: "Validez la vérification",
        body: "Une fois validé, le stock Margin s’aligne. Les pertes € sont dans Coûts → Pertes.",
        anchor: '.inv-workspace__foot .btn-lime, [data-guide-action="stock-count"]',
        placement: "top",
      },
    ],
  },
  {
    pageKey: "courses",
    label: "Courses",
    match: (p) => startsWithAny(p, ["/orders"]),
    steps: [
      {
        id: "courses-1",
        title: "Vos listes de courses",
        body: "Besoins depuis le stock bas — créez la liste ici.",
        anchor: '[data-tour="courses-list"], .shop-list, .day-focus',
        placement: "bottom",
      },
      {
        id: "courses-2",
        title: "Créez puis validez",
        body: "Ouvrir les courses, puis Marquer comme fait (stock mis à jour).",
        anchor:
          '[data-tour="courses-actions"], .shop-list__actions, .shop-list__empty-cta',
        placement: "top",
      },
    ],
  },
  {
    pageKey: "couts",
    label: "Coûts",
    match: (p) => startsWithAny(p, ["/costs"]),
    steps: [
      {
        id: "couts-1",
        title: "Pilotez vos coûts",
        body: "Factures, hausses, matière, pertes — sections ici.",
        anchor: '[data-tour="costs-tabs"], .costs-page__tabs',
        placement: "bottom",
      },
      {
        id: "couts-2",
        title: "Importez une facture",
        body: "CSV, PDF ou photo — les prix d’achat alimentent les hausses.",
        anchor: '[data-tour="costs-invoice"], #facture',
        placement: "bottom",
      },
      {
        id: "couts-3",
        title: "Suivez les hausses",
        body: "Les prix qui montent apparaissent dans cette section.",
        anchor: '[data-tour="costs-hikes"], #hausses',
        placement: "bottom",
      },
    ],
  },
  {
    pageKey: "equipe",
    label: "Équipe",
    match: (p) => startsWithAny(p, ["/employees"]),
    steps: [
      {
        id: "equipe-1",
        title: "Votre équipe",
        body: "Ajoutez les prénoms ici.",
        anchor: '[data-tour="team-add"], .action-card, .day-focus',
        placement: "bottom",
      },
      {
        id: "equipe-2",
        title: "Planning puis pointage",
        body: "Planifiez le jour, puis pointez Présent / Absent.",
        anchor:
          '[data-tour="team-clock"], .team-today, .action-card__link, .pill-btn--primary',
        placement: "bottom",
      },
    ],
  },
  {
    pageKey: "magasin",
    label: "Commerce",
    match: (p) =>
      startsWithAny(p, ["/settings", "/delivery"]) &&
      !startsWithAny(p, ["/kiosks"]),
    steps: [
      {
        id: "magasin-1",
        title: "Réglages du commerce",
        body: "Simple · Connexions · Avancé — commencez par Simple.",
        anchor: '[data-tour="settings-tabs"], .segmented-tabs',
        placement: "bottom",
      },
      {
        id: "magasin-2",
        title: "Entrez votre numéro",
        body: "Le WhatsApp qui recevra alertes stock et listes de courses.",
        anchor:
          '[data-tour="settings-wa-input"], #guide-wa, #settings-wa',
        placement: "bottom",
      },
      {
        id: "magasin-3",
        title: "Enregistrez",
        body: "Appuyez ici pour valider — l’étape se coche toute seule.",
        anchor:
          '[data-tour="settings-wa-save"], .guide-coach__cta',
        placement: "right",
      },
    ],
  },
  {
    pageKey: "accueil",
    label: "Accueil",
    match: (p) => p === "/",
    steps: [
      {
        id: "accueil-1",
        title: "Priorités du jour",
        body: "Traitez d’abord ce qui est urgent ici.",
        anchor: '[data-tour="home-focus"], .day-focus',
        placement: "bottom",
      },
      {
        id: "accueil-2",
        title: "Guide en bas",
        body: "La barre reste en bas tant que le commerce n’est pas prêt.",
        anchor: '[data-tour="home-dock"], .sg-dock',
        placement: "top",
      },
    ],
  },
];

export function findPageTour(pathname: string): PageTour | null {
  return PAGE_TOURS.find((t) => t.match(pathname)) ?? null;
}

export function resolveAnchor(selector: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const parts = selector.split(",").map((s) => s.trim()).filter(Boolean);
  for (const part of parts) {
    try {
      const el = document.querySelector(part);
      if (el instanceof HTMLElement) return el;
    } catch {
      /* invalid selector */
    }
  }
  return null;
}
