/**
 * Navigation commerçant — Accueil · Stock · Courses · Équipe · Magasin.
 * Bottom bar = 4 onglets. Magasin (caisse, livraison) = menu / sidebar.
 * Réglages & déconnexion = menu compte (topbar uniquement).
 */

export type NavChild = {
  href: string;
  label: string;
  hint?: string;
};

export type NavSection = {
  id: "home" | "stock" | "courses" | "couts" | "equipe" | "magasin";
  href: string;
  label: string;
  /** Chemins qui activent cet onglet (parent + enfants) */
  match: string[];
  children?: NavChild[];
  hint?: string;
  /** Absent de la barre du bas (accessible via Menu / sidebar) */
  menuOnly?: boolean;
};

export const NAV_SECTIONS: NavSection[] = [
  {
    id: "home",
    href: "/",
    label: "Accueil",
    match: ["/"],
    hint: "Vue du jour",
  },
  {
    id: "stock",
    href: "/ingredients",
    label: "Stock",
    match: ["/ingredients", "/inventory", "/dishes", "/ingredients/menu"],
    hint: "Quantités en magasin",
    children: [
      {
        href: "/ingredients",
        label: "Niveaux & produits",
        hint: "Stock + fiches",
      },
      {
        href: "/ingredients/menu",
        label: "Import catalogue",
        hint: "Charger des produits",
      },
      { href: "/inventory", label: "Vérification", hint: "Corriger le rayon" },
    ],
  },
  {
    id: "courses",
    href: "/orders",
    label: "Courses",
    match: ["/orders"],
    hint: "Listes à passer",
  },
  {
    id: "couts",
    href: "/costs",
    label: "Coûts",
    match: ["/costs"],
    hint: "Factures, hausses, pertes",
  },
  {
    id: "equipe",
    href: "/employees",
    label: "Équipe",
    match: ["/employees"],
    hint: "Personnes & planning",
    children: [
      { href: "/employees", label: "Membres", hint: "Pointer le service" },
      {
        href: "/employees/planning",
        label: "Planning",
        hint: "Voir / retirer",
      },
    ],
  },
  {
    id: "magasin",
    href: "/kiosks",
    label: "Magasin",
    match: ["/delivery", "/kiosks", "/settings", "/admin"],
    hint: "Caisse & livraison",
    menuOnly: true,
    children: [
      { href: "/kiosks", label: "Caisse", hint: "Brancher la caisse" },
      { href: "/delivery", label: "Livraison", hint: "Plateformes (optionnel)" },
    ],
  },
];

/** Onglets barre du bas (sans Menu ni Magasin) */
export const BOTTOM_TABS = NAV_SECTIONS.filter((s) => !s.menuOnly).map((s) => ({
  href: s.href,
  label: s.label,
  id: s.id,
}));

function pathMatches(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/ingredients") {
    return (
      pathname === "/ingredients" ||
      (pathname.startsWith("/ingredients/") &&
        !pathname.startsWith("/ingredients/menu"))
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Section active */
export function activeNavSection(
  pathname: string
): NavSection["id"] | null {
  if (pathname === "/") return "home";
  if (pathname.startsWith("/orders")) return "courses";
  if (pathname.startsWith("/employees")) return "equipe";
  if (
    pathname.startsWith("/delivery") ||
    pathname.startsWith("/kiosks") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/admin")
  ) {
    return "magasin";
  }
  if (
    pathname === "/ingredients" ||
    pathname.startsWith("/ingredients/") ||
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/dishes")
  ) {
    return "stock";
  }
  return null;
}

export function isNavHrefActive(pathname: string, href: string): boolean {
  return pathMatches(pathname, href);
}

export function sectionHasActiveChild(
  section: NavSection,
  pathname: string
): boolean {
  return (section.children ?? []).some((c) =>
    isNavHrefActive(pathname, c.href)
  );
}
