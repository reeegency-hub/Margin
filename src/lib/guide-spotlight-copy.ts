/**
 * Textes des bulles guide (spotlight) — alignés 1:1 sur les tâches first-hour.
 * Titre = action à faire · steps = gestes concrets sur la page cible.
 */

export type GuideSpotCopy = {
  /** Titre de la bulle / coach (action, pas le nom du menu) */
  title: string;
  steps: string[];
  /** Pied de bulle — défaut si absent */
  footHint?: string;
};

const FOOT_CLICK = "Bouton mis en avant — cliquez-le pour valider.";
const FOOT_SAVE = "Bouton Enregistrer mis en avant — cliquez-le pour valider.";
const FOOT_DROP = "Zone mise en avant — déposez ou choisissez le fichier.";
const FOOT_FORM = "Zone mise en avant — complétez puis validez.";

/** Copies canoniques par id de tâche (parcours + accueil). */
const BY_ID: Record<string, GuideSpotCopy> = {
  /* —— Commerce —— */
  "shop-settings": {
    title: "Ajouter mon WhatsApp",
    steps: [
      "Saisissez le numéro WhatsApp du commerce.",
      "Cliquez Enregistrer pour recevoir alertes et listes.",
    ],
    footHint: FOOT_SAVE,
  },
  "home-wa": {
    title: "WhatsApp du commerce",
    steps: [
      "Saisissez le numéro WhatsApp du commerce.",
      "Cliquez Enregistrer pour recevoir alertes et listes.",
    ],
    footHint: FOOT_SAVE,
  },
  "shop-wa": {
    title: "WhatsApp du commerce",
    steps: [
      "Saisissez le numéro WhatsApp du commerce.",
      "Cliquez Enregistrer pour recevoir alertes et listes.",
    ],
    footHint: FOOT_SAVE,
  },
  "shop-pos": {
    title: "Brancher la caisse",
    steps: [
      "Indiquez votre logiciel de caisse (Zelty, Cashpad…).",
      "Suivez les étapes pour lancer la synchronisation des ventes.",
    ],
    footHint: FOOT_FORM,
  },
  "home-pos": {
    title: "Brancher la caisse",
    steps: [
      "Indiquez votre logiciel de caisse.",
      "Suivez les étapes pour synchroniser les ventes.",
    ],
    footHint: FOOT_FORM,
  },
  "shop-delivery": {
    title: "Configurer la livraison",
    steps: [
      "Collez la clé API Uber Eats ou Deliveroo dans le champ mis en avant.",
      "Enregistrez — ou ignorez si vous ne livrez pas (étape optionnelle).",
    ],
    footHint: "Champ Clé API mis en avant — collez puis Enregistrer.",
  },
  "home-delivery": {
    title: "Livraison (optionnel)",
    steps: [
      "Collez la clé API dans le champ mis en avant (Uber / Deliveroo).",
      "Sinon ignorez — ce n’est pas bloquant pour démarrer.",
    ],
    footHint: "Champ Clé API mis en avant — ou passez l’étape.",
  },

  /* —— Stock —— */
  "stock-levels": {
    title: "Ajouter un produit",
    steps: [
      "Ajoutez au moins un produit (nom + quantité).",
      "Vérifiez l’unité (kg, pièce, litre…).",
    ],
    footHint: FOOT_CLICK,
  },
  "stock-products": {
    title: "Ajouter un produit",
    steps: [
      "Ajoutez au moins un produit (nom + quantité).",
      "Vérifiez l’unité (kg, pièce, litre…).",
    ],
    footHint: FOOT_CLICK,
  },
  "home-products": {
    title: "Remplir le stock",
    steps: [
      "Ajoutez au moins un produit (nom + quantité).",
      "Sans produits, pas de niveaux ni d’alertes.",
    ],
    footHint: FOOT_CLICK,
  },
  "stock-import": {
    title: "Importer un catalogue",
    steps: [
      "Collez ou importez votre liste / catalogue.",
      "Contrôlez les lignes proposées puis validez.",
    ],
    footHint: FOOT_DROP,
  },
  "home-import": {
    title: "Importer un catalogue",
    steps: [
      "Chargez plusieurs références d’un coup.",
      "Contrôlez les lignes proposées puis validez.",
    ],
    footHint: FOOT_DROP,
  },
  "stock-count": {
    title: "Lancer une vérification",
    steps: [
      "Lancez une vérification sur le rayon.",
      "Corrigez les quantités réelles, puis validez.",
    ],
    footHint: FOOT_CLICK,
  },
  "home-count": {
    title: "Compter le rayon",
    steps: [
      "Lancez une vérification pour aligner Margin sur le vrai stock.",
      "Corrigez les quantités, puis validez.",
    ],
    footHint: FOOT_CLICK,
  },
  "home-weekly-inv": {
    title: "Inventaire de la semaine",
    steps: [
      "Faites le vérification hebdomadaire du rayon (hub Vérification).",
      "Les pertes en € se voient dans Coûts → Pertes.",
    ],
    footHint: FOOT_CLICK,
  },
  "cost-weekly": {
    title: "Pertes valorisées",
    steps: [
      "Ouvrez Coûts → Pertes pour les écarts en euros.",
      "La vérification se fait dans le hub Vérification, pas ici.",
    ],
    footHint: FOOT_CLICK,
  },

  /* —— Équipe —— */
  "team-members": {
    title: "Ajouter un membre",
    steps: [
      "Ajoutez le prénom d’une personne de l’équipe.",
      "Répétez pour chaque personne du commerce.",
    ],
    footHint: FOOT_CLICK,
  },
  "home-team": {
    title: "Ajouter l’équipe",
    steps: [
      "Ajoutez le prénom d’une personne qui ouvre ou ferme.",
      "Répétez pour toute l’équipe.",
    ],
    footHint: FOOT_CLICK,
  },
  "team-planning": {
    title: "Planifier un créneau",
    steps: [
      "Créez un créneau sur le planning.",
      "Assignez qui travaille aujourd’hui / demain.",
    ],
    footHint: FOOT_CLICK,
  },
  "home-planning": {
    title: "Planifier les créneaux",
    steps: [
      "Créez au moins un créneau.",
      "Assignez qui travaille — indispensable pour pointer.",
    ],
    footHint: FOOT_CLICK,
  },
  "team-clock": {
    title: "Pointer l’équipe",
    steps: [
      "Pointez Présent ou Absent pour quelqu’un.",
      "Faites-le chaque matin — un geste suffit.",
    ],
    footHint: FOOT_CLICK,
  },
  "home-clock": {
    title: "Pointer Présent / Absent",
    steps: [
      "Pointez Présent ou Absent pour quelqu’un.",
      "Un geste le matin pour le suivi d’heures.",
    ],
    footHint: FOOT_CLICK,
  },

  /* —— Courses —— */
  "courses-list": {
    title: "Préparer une liste",
    steps: [
      "Créez une liste à partir des besoins (stock bas).",
      "Sans besoins, le bouton Créer actualise quand même la liste.",
    ],
    footHint: FOOT_CLICK,
  },
  "home-orders": {
    title: "Première liste de courses",
    steps: [
      "Créez une liste à partir du stock bas.",
      "C’est le test de réassort après la caisse.",
    ],
    footHint: FOOT_CLICK,
  },
  "courses-do": {
    title: "Faire les courses",
    steps: [
      "Achetez selon la liste.",
      "Marquez comme fait — le stock se réintègre automatiquement.",
    ],
    footHint: FOOT_CLICK,
  },

  /* —— Coûts —— */
  "cost-invoice": {
    title: "Importer une facture",
    steps: [
      "Importez le CSV, PDF ou photo — pas de saisie ligne à ligne.",
      "Corrigez qty, prix et match stock, puis validez.",
    ],
    footHint: FOOT_DROP,
  },
  "home-invoice": {
    title: "Importer une facture fournisseur",
    steps: [
      "Importez le fichier — jamais de saisie manuelle des lignes.",
      "La grille qty / prix / match est obligatoire avant import.",
    ],
    footHint: FOOT_DROP,
  },
  "cost-hikes": {
    title: "Hausses fournisseurs",
    steps: [
      "Ouvrez la section Hausses.",
      "Les hausses ≥ 5 % apparaissent après import de factures.",
    ],
    footHint: FOOT_CLICK,
  },
  "cost-food": {
    title: "Voir le coût d’achat",
    steps: [
      "Le coût d’achat demande factures + ventes + fiches produit.",
      "Repérez ce qui a monté aujourd’hui.",
    ],
    footHint: FOOT_CLICK,
  },
  "home-foodcost": {
    title: "Coût d’achat des best-sellers",
    steps: [
      "Il faut ventes caisse + fiches produit + factures.",
      "Les marges se recalculent si un prix fournisseur monte.",
    ],
    footHint: FOOT_CLICK,
  },
  "cost-negotiate": {
    title: "Comparer & négocier",
    steps: [
      "Ouvrez le comparatif des prix d’achat entre fournisseurs.",
      "Une fois par mois suffit — étape optionnelle.",
    ],
    footHint: FOOT_CLICK,
  },
  "home-negotiate": {
    title: "Comparer & négocier",
    steps: [
      "Ouvrez le comparatif des prix d’achat entre fournisseurs.",
      "Une fois par mois suffit — étape optionnelle.",
    ],
    footHint: FOOT_CLICK,
  },
};

export function getGuideSpotCopy(
  taskId: string,
  fallback?: {
    label?: string;
    hint?: string;
    cta?: string;
    sectionTitle?: string;
  }
): GuideSpotCopy {
  const known = BY_ID[taskId];
  if (known) return known;

  const title =
    fallback?.cta?.replace(/^Aller (faire|à)\s*:\s*/i, "").trim() ||
    fallback?.label ||
    "Étape du guide";
  const steps = [
    fallback?.hint ||
      `Faites l’action sur la page ${fallback?.sectionTitle || "cible"}.`,
    "Quand c’est fait, l’étape se coche toute seule.",
  ];
  return { title, steps, footHint: FOOT_CLICK };
}

export function guideSpotSteps(
  taskId: string,
  hint?: string,
  sectionTitle?: string
): string[] {
  return getGuideSpotCopy(taskId, { hint, sectionTitle }).steps;
}
