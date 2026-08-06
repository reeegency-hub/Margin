/**
 * Ancres d’action pour le guide de démarrage.
 * Chaque étape colle la bulle UNIQUEMENT au contrôle prévu (pas de fallback trop large).
 */

export type GuideAnchor = {
  /** Sélecteurs CSS (virgule = premier trouvé, ordre = priorité) */
  anchor: string;
  placement?: "bottom" | "top" | "right" | "left";
};

const WA: GuideAnchor = {
  anchor:
    '#settings-wa, [data-guide-action="wa-save"], #guide-wa, .guide-coach__form .guide-coach__cta',
  placement: "bottom",
};

const STOCK_ADD: GuideAnchor = {
  anchor:
    'a.day-focus__cta[data-guide-action="stock-add"], [data-guide-action="stock-add"], [data-tour="stock-add"] button.btn-lime, [data-tour="stock-add"] button',
  placement: "bottom",
};

const STOCK_COUNT: GuideAnchor = {
  anchor:
    '[data-guide-action="stock-count"], a.day-focus__cta[data-guide-action="stock-count"], [data-tour="stock-count"]',
  placement: "bottom",
};

const TEAM_ADD: GuideAnchor = {
  anchor:
    'a.day-focus__cta[data-guide-action="team-add"], #guide-team-add-submit, form[data-guide-form="team-add"] button[data-guide-action="team-add"], [data-guide-action="team-add"]:not(a.action-card__link):not(a.day-focus__row)',
  placement: "bottom",
};

const TEAM_CLOCK: GuideAnchor = {
  anchor:
    '[data-guide-action="team-clock"], a.day-focus__cta[data-guide-action="team-clock"], [data-tour="team-clock"] .pill-btn--primary',
  placement: "bottom",
};

const PLANNING: GuideAnchor = {
  anchor:
    '[data-guide-action="planning"], a.day-focus__cta[data-guide-action="planning"], [data-guide-form="planning"] button[type="submit"], .planning-shift-form button[type="submit"]',
  placement: "bottom",
};

const COURSES: GuideAnchor = {
  anchor:
    '[data-guide-action="courses"], a.day-focus__cta[data-guide-action="courses"], [data-tour="courses-actions"] button',
  placement: "top",
};

const COURSES_CREATE: GuideAnchor = {
  anchor:
    '[data-guide-action="courses-create"], [data-tour="courses-actions"] button.btn-lime, .shop-list__empty-cta, form[data-guide-form="courses-create"] button',
  placement: "top",
};

const COURSES_DO: GuideAnchor = {
  anchor:
    '[data-guide-action="courses-do"], .shop-list__actions .btn-lime, [data-tour="courses-actions"] button.btn-lime',
  placement: "top",
};

const INVOICE: GuideAnchor = {
  anchor:
    '[data-guide-action="invoice-import"], a.day-focus__cta[data-guide-action="invoice-import"], #facture [data-guide-action="invoice-import"], #facture .costs-drop',
  placement: "bottom",
};

const COSTS_FOOD: GuideAnchor = {
  anchor:
    '[data-guide-action="costs-food"], a.day-focus__cta[data-guide-action="costs-food"], #matiere',
  placement: "bottom",
};

const COSTS_HIKES: GuideAnchor = {
  anchor: '[data-guide-action="costs-hikes"], #hausses',
  placement: "bottom",
};

const NEGOTIATE: GuideAnchor = {
  anchor: '[data-guide-action="negotiate"], #negocier',
  placement: "bottom",
};

const POS: GuideAnchor = {
  anchor:
    '[data-guide-action="pos"], .pos-create input[name="name"], .pos-create input[name="apiKey"], .pos-vendor-grid .pos-vendor.is-on, .pos-vendor-grid .pos-vendor, .pos-panel button[type="submit"]',
  placement: "bottom",
};

const DELIVERY: GuideAnchor = {
  anchor:
    '#guide-work-delivery, [data-guide-action="delivery"], [data-guide-form="delivery"] input[name="apiKey"], [data-guide-form="delivery"] button[type="submit"]',
  placement: "top",
};

const IMPORT_CATALOG: GuideAnchor = {
  anchor:
    '[data-guide-action="import-catalog"], a.day-focus__cta[data-guide-action="import-catalog"], [data-guide-form="import-catalog"] input[type="file"], .catalog-import input[type="file"]',
  placement: "bottom",
};

/** id d’étape guide → ancre visuelle (CTA d’entrée) */
export const GUIDE_STEP_ANCHORS: Record<string, GuideAnchor> = {
  "shop-settings": WA,
  "home-wa": WA,
  "shop-wa": WA,

  "stock-products": STOCK_ADD,
  "stock-levels": STOCK_ADD,
  "home-products": STOCK_ADD,
  "stock-import": IMPORT_CATALOG,
  "home-import": IMPORT_CATALOG,
  "stock-count": STOCK_COUNT,
  "home-count": STOCK_COUNT,
  "home-weekly-inv": STOCK_COUNT,

  "team-members": TEAM_ADD,
  "home-team": TEAM_ADD,
  "team-clock": TEAM_CLOCK,
  "home-clock": TEAM_CLOCK,
  "team-planning": PLANNING,
  "home-planning": PLANNING,

  "courses-list": COURSES_CREATE,
  "courses-do": COURSES_DO,
  "home-orders": COURSES_CREATE,

  "cost-invoice": INVOICE,
  "home-invoice": INVOICE,
  "cost-food": COSTS_FOOD,
  "home-foodcost": COSTS_FOOD,
  "cost-hikes": COSTS_HIKES,
  "cost-negotiate": NEGOTIATE,
  "home-negotiate": NEGOTIATE,

  "shop-pos": POS,
  "home-pos": POS,
  "shop-delivery": DELIVERY,
  "home-delivery": DELIVERY,
};

/** Map focus hub id → data-guide-action sur le CTA DayFocus */
export const FOCUS_ID_TO_GUIDE_ACTION: Record<string, string> = {
  "team-add": "team-add",
  "team-plan": "planning",
  "team-clock": "team-clock",
  "team-staff": "planning",
  "stock-empty": "stock-add",
  "stock-critical": "stock-add",
  "stock-import": "import-catalog",
  "stock-inv-open": "stock-count",
  "stock-weekly": "stock-count",
  "courses-do": "courses-do",
  "courses-needs": "courses-create",
  "courses-list": "courses-create",
  "shop-wa": "wa-save",
  "shop-pos": "pos",
  "shop-delivery": "delivery",
  "invoice": "invoice-import",
  "foodcost-gaps": "costs-food",
  "negotiate": "negotiate",
  "negotiate-setup": "negotiate",
  "hikes-today": "costs-hikes",
  "hikes-week": "costs-hikes",
  "weekly-inv": "stock-count",
  "weekly-loss-review": "costs-losses",
};

/**
 * Cible réelle après clic CTA (champ / zone à remplir).
 * taskId et data-guide-action partagent souvent la même clé.
 */
export const GUIDE_WORK_TARGETS: Record<string, string> = {
  "team-add":
    '#guide-work-team-add, form[data-guide-form="team-add"] input[name="name"]',
  "team-members":
    '#guide-work-team-add, form[data-guide-form="team-add"] input[name="name"]',
  "home-team":
    '#guide-work-team-add, form[data-guide-form="team-add"] input[name="name"]',

  "wa-save": "#guide-wa, #settings-wa",
  "shop-settings": "#guide-wa, #settings-wa",
  "home-wa": "#guide-wa, #settings-wa",
  "shop-wa": "#guide-wa, #settings-wa",

  "stock-add":
    '#guide-work-stock-add, [data-tour="stock-add"] input[name="name"], .catalog-import__manual input[name="name"]',
  "stock-levels":
    '#guide-work-stock-add, [data-tour="stock-add"] input[name="name"], .catalog-import__manual input[name="name"]',
  "stock-products":
    '#guide-work-stock-add, [data-tour="stock-add"] input[name="name"], .catalog-import__manual input[name="name"]',
  "home-products":
    '#guide-work-stock-add, [data-tour="stock-add"] input[name="name"], .catalog-import__manual input[name="name"]',

  "import-catalog":
    '#guide-work-import, [data-guide-action="import-catalog"], .catalog-import input[type="file"]',
  "stock-import":
    '#guide-work-import, [data-guide-action="import-catalog"], .catalog-import input[type="file"]',
  "home-import":
    '#guide-work-import, [data-guide-action="import-catalog"], .catalog-import input[type="file"]',

  "stock-count":
    '[data-guide-action="stock-count"].btn-lime, [data-tour="stock-count"], .inv-workspace__foot .btn-lime',
  "home-count":
    '[data-guide-action="stock-count"].btn-lime, [data-tour="stock-count"], .inv-workspace__foot .btn-lime',
  "home-weekly-inv":
    '[data-guide-action="stock-count"].btn-lime, [data-tour="stock-count"], .inv-workspace__foot .btn-lime',
  "cost-weekly":
    '#pertes, [data-guide-action="costs-losses"]',
  "cost-hikes":
    '#hausses, [data-guide-action="costs-hikes"]',
  "cost-negotiate":
    '#negocier, [data-guide-action="negotiate"]',
  negotiate:
    '#negocier, [data-guide-action="negotiate"]',
  "home-negotiate":
    '#negocier, [data-guide-action="negotiate"]',

  "team-clock":
    '[data-guide-action="team-clock"], [data-tour="team-clock"] .pill-btn--primary',
  "home-clock":
    '[data-guide-action="team-clock"], [data-tour="team-clock"] .pill-btn--primary',

  planning:
    '#guide-work-planning, [data-guide-form="planning"] select[name="employeeId"], [data-guide-action="planning"]',
  "team-planning":
    '#guide-work-planning, [data-guide-form="planning"] select[name="employeeId"], [data-guide-action="planning"]',
  "home-planning":
    '#guide-work-planning, [data-guide-form="planning"] select[name="employeeId"], [data-guide-action="planning"]',

  courses:
    '[data-guide-action="courses-create"], [data-guide-action="courses-do"], [data-tour="courses-actions"] button',
  "courses-list":
    '[data-guide-action="courses-create"], form[data-guide-form="courses-create"] button, .shop-list__empty-cta',
  "courses-create":
    '[data-guide-action="courses-create"], form[data-guide-form="courses-create"] button, .shop-list__empty-cta',
  "courses-do":
    '[data-guide-action="courses-do"], .shop-list__actions .btn-lime',
  "home-orders":
    '[data-guide-action="courses-create"], form[data-guide-form="courses-create"] button, .shop-list__empty-cta',

  "invoice-import":
    '#guide-work-invoice, [data-guide-action="invoice-import"], #facture .costs-drop',
  "cost-invoice":
    '#guide-work-invoice, [data-guide-action="invoice-import"], #facture .costs-drop',
  "home-invoice":
    '#guide-work-invoice, [data-guide-action="invoice-import"], #facture .costs-drop',

  "costs-food": '#matiere, [data-guide-action="costs-food"]',
  "cost-food": '#matiere, [data-guide-action="costs-food"]',
  "home-foodcost": '#matiere, [data-guide-action="costs-food"]',
  "costs-hikes": '#hausses, [data-guide-action="costs-hikes"]',

  pos: '[data-guide-action="pos"], .pos-create input[name="name"], .pos-create input[name="apiKey"], .pos-vendor.is-on, .pos-vendor-grid .pos-vendor',
  "shop-pos":
    '[data-guide-action="pos"], .pos-create input[name="name"], .pos-create input[name="apiKey"], .pos-vendor.is-on, .pos-vendor-grid .pos-vendor',
  "home-pos":
    '[data-guide-action="pos"], .pos-create input[name="name"], .pos-create input[name="apiKey"], .pos-vendor.is-on, .pos-vendor-grid .pos-vendor',

  delivery:
    '#guide-work-delivery, [data-guide-form="delivery"] input[name="apiKey"], [data-guide-action="delivery"]',
  "shop-delivery":
    '#guide-work-delivery, [data-guide-form="delivery"] input[name="apiKey"], [data-guide-action="delivery"]',
  "home-delivery":
    '#guide-work-delivery, [data-guide-form="delivery"] input[name="apiKey"], [data-guide-action="delivery"]',
};

const HANDOFF_KEY = "margin:guide:handoff";

export function setGuideHandoff(taskId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(HANDOFF_KEY, taskId);
  } catch {
    /* ignore */
  }
}

export function isGuideHandedOff(taskId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return sessionStorage.getItem(HANDOFF_KEY) === taskId;
  } catch {
    return false;
  }
}

export function clearGuideHandoff() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(HANDOFF_KEY);
  } catch {
    /* ignore */
  }
}

export function getGuideStepAnchor(taskId: string): GuideAnchor {
  return (
    GUIDE_STEP_ANCHORS[taskId] || {
      anchor: `[data-guide-action="${taskId}"]`,
      placement: "bottom",
    }
  );
}

/** Sélecteur du champ réel à remplir (prioritaire sur le CTA d’entrée). */
export function getGuideWorkSelector(taskId: string): string | null {
  return GUIDE_WORK_TARGETS[taskId] || null;
}

/**
 * Résout l’élément à mettre en avant :
 * 1) zone de travail (champ formulaire) si visible
 * 2) ancre d’étape (CTA / bouton)
 */
export function resolveGuideTaskElement(taskId: string): {
  el: HTMLElement | null;
  placement: GuideAnchor["placement"];
} {
  const step = getGuideStepAnchor(taskId);
  const work = getGuideWorkSelector(taskId);
  if (work) {
    const workEl = resolveGuideAnchor(work);
    if (workEl) {
      return { el: workEl, placement: step.placement || "top" };
    }
  }
  return {
    el: resolveGuideAnchor(step.anchor),
    placement: step.placement || "bottom",
  };
}

export function resolveGuideAnchor(selector: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  for (const part of selector.split(",").map((s) => s.trim()).filter(Boolean)) {
    try {
      const el = document.querySelector(part);
      if (el instanceof HTMLElement && el.getClientRects().length > 0) {
        // Ignore éléments hors viewport utile / masqués (display:none, phone-hide)
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") continue;
        if (el.closest(".phone-only") && window.innerWidth >= 768) continue;
        if (el.closest(".phone-hide") && window.innerWidth < 768) continue;
        return el;
      }
    } catch {
      /* sélecteur invalide */
    }
  }
  return null;
}

function workSelectorFor(taskOrAction: string): string | null {
  return GUIDE_WORK_TARGETS[taskOrAction] || null;
}

/** Scroll + focus sur la zone réelle à remplir (après clic CTA). */
export function focusGuideWorkTarget(taskOrAction: string): boolean {
  const sel = workSelectorFor(taskOrAction);
  if (!sel) return false;
  const el = resolveGuideAnchor(sel);
  if (!el) return false;

  el.scrollIntoView({ block: "center", behavior: "smooth" });
  el.classList.add("is-guide-pulse");

  const focusable =
    el instanceof HTMLInputElement ||
    el instanceof HTMLTextAreaElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLButtonElement
      ? el
      : el.querySelector<HTMLElement>(
          'input:not([type="hidden"]), textarea, select, button, [tabindex]:not([tabindex="-1"])'
        );

  if (focusable) {
    window.setTimeout(() => {
      try {
        focusable.focus({ preventScroll: true });
      } catch {
        focusable.focus();
      }
    }, 280);
  }

  window.setTimeout(() => {
    el.classList.remove("is-guide-pulse");
    focusable?.classList.remove("is-guide-pulse");
  }, 4200);

  return true;
}

/** Action guide depuis un élément cliqué (CTA day-focus ou pulse). */
export function guideActionFromElement(el: Element | null): string | null {
  if (!el || !(el instanceof Element)) return null;
  const host = el.closest<HTMLElement>("[data-guide-action]");
  return host?.getAttribute("data-guide-action") || null;
}
