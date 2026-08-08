import type { PosVendor } from "@/lib/pos/types";
import { POS_VENDOR_LABELS } from "@/lib/pos/types";

export type PosTuto = {
  vendor: PosVendor;
  title: string;
  body: string;
  tips: string[];
};

const SHARED_SETUP = [
  "Indiquez votre logiciel de caisse ici.",
  "Créez la connexion webhook (URL + secret générés pour votre commerce).",
  "L’équipe Margin programme le branchement sur votre caisse (~400 € une fois).",
  "Margin actif : 99 € / mois — ventes → catalogue → stock automatique.",
  "Quand les ventes arrivent : validez les nouveaux produits, puis vérifiez le stock.",
];

function tutoFor(
  vendor: PosVendor,
  title: string,
  body: string
): PosTuto {
  return { vendor, title, body, tips: SHARED_SETUP };
}

export const POS_TUTOS: Record<string, PosTuto> = {
  zelty: tutoFor(
    "zelty",
    "Zelty",
    "Vous avez Zelty : choisissez-le, créez la connexion. On branche le webhook pour vous — pas d’export CSV à gérer."
  ),
  cashpad: tutoFor(
    "cashpad",
    "Cashpad",
    "Vous avez Cashpad : créez la connexion webhook. Notre équipe programme le lien caisse → Margin."
  ),
  tiller: tutoFor(
    "tiller",
    "Tiller / SumUp",
    "Vous avez Tiller / SumUp : créez la connexion. On s’occupe de la programmation côté caisse."
  ),
  laddition: tutoFor(
    "laddition",
    "L'Addition",
    "Vous avez L’Addition : créez la connexion webhook. Margin reçoit ensuite vos ventes en live."
  ),
  lightspeed: tutoFor(
    "lightspeed",
    "Lightspeed",
    "Vous avez Lightspeed : créez la connexion. On programme le branchement pour votre commerce."
  ),
  square: tutoFor(
    "square",
    "Square",
    "Vous avez Square : créez la connexion webhook. L’équipe Margin fait l’intégration technique."
  ),
  custom: tutoFor(
    "custom",
    "Autre caisse",
    "Autre logiciel : dites-nous lequel, créez la connexion. On étudie le branchement pour votre commerce."
  ),
};

/** Onglets commerçant — pas de CSV (outil interne Margin) */
export const POS_PICKER_VENDORS: PosVendor[] = [
  "zelty",
  "cashpad",
  "tiller",
  "laddition",
  "lightspeed",
  "square",
  "custom",
];

export function getPosTuto(vendor: string | null | undefined): PosTuto {
  if (vendor && POS_TUTOS[vendor]) return POS_TUTOS[vendor];
  return {
    vendor: "custom",
    title: "Caisse",
    body: "Choisissez le logiciel de votre commerce. On programme la connexion webhook pour vous — mise en service ~400 €, puis 99 € / mois.",
    tips: [
      "Cliquez sur votre caisse (Zelty, Cashpad, Square…).",
      "Créez la connexion webhook.",
      "On branche la caisse pour vous.",
      "Ensuite : ventes → produits découverts → vérification.",
    ],
  };
}

export function posVendorLabel(vendor: string) {
  return POS_VENDOR_LABELS[vendor as PosVendor] ?? vendor;
}
