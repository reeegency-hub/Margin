/**
 * Playbook marketing fondateur — cold email + micro-influenceurs.
 * Aligné ICP Margin : commerce de proximité FR, caisse numérique, TPE.
 */

export const COLD_SEGMENTS = [
  { id: "epicerie", label: "Épicerie / alimentation" },
  { id: "mode", label: "Prêt-à-porter" },
  { id: "beaute", label: "Beauté / parfumerie" },
  { id: "boulangerie", label: "Boulangerie / snacking" },
  { id: "franchise", label: "Franchise / multi-commerce" },
  { id: "autre", label: "Autre commerce" },
] as const;

export const PROSPECT_STATUSES = [
  { id: "new", label: "Nouveau" },
  { id: "sequenced", label: "En séquence" },
  { id: "replied", label: "A répondu" },
  { id: "meeting", label: "RDV" },
  { id: "won", label: "Gagné" },
  { id: "lost", label: "Perdu" },
  { id: "paused", label: "En pause" },
] as const;

export const INFLUENCER_PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitter", label: "X / Twitter" },
] as const;

export const INFLUENCER_NICHES = [
  { id: "retail", label: "Retail / commerce" },
  { id: "food", label: "Food / épicerie" },
  { id: "entrepreneur", label: "Entrepreneur TPE" },
  { id: "franchise", label: "Franchise" },
  { id: "tech", label: "SaaS / tech" },
  { id: "autre", label: "Autre" },
] as const;

export const INFLUENCER_STATUSES = [
  { id: "research", label: "Recherche" },
  { id: "contacted", label: "Contacté" },
  { id: "negotiating", label: "Négociation" },
  { id: "active", label: "Actif (pub)" },
  { id: "declined", label: "Refus" },
  { id: "paused", label: "Pause" },
] as const;

export type ColdEmailVars = {
  contactName?: string | null;
  businessName?: string | null;
  city?: string | null;
  segment?: string | null;
  posVendor?: string | null;
};

/** Séquence 3 touches — espacement conseillé 3–4 j. */
export const COLD_SEQUENCE = [
  {
    step: 1,
    delayDays: 0,
    label: "Touche 1 — douleur stock",
    subject: (v: ColdEmailVars) =>
      v.businessName
        ? `${v.businessName} — stock qui ne suit pas la caisse ?`
        : "Stock qui ne suit pas la caisse ?",
    body: (v: ColdEmailVars) => {
      const hi = v.contactName ? `Bonjour ${v.contactName},` : "Bonjour,";
      const shop = v.businessName || "votre commerce";
      const city = v.city ? ` à ${v.city}` : "";
      const pos = v.posVendor
        ? `Avec ${v.posVendor}, `
        : "Avec votre caisse, ";
      return `${hi}

Je m’adresse aux gérants de commerces de proximité${city} qui perdent du temps (ou de la marge) parce que le stock n’est pas relié aux ventes.

${pos}chaque ticket devrait baisser le stock tout seul — et WhatsApp vous prévenir avant la rupture rayon.

Margin Shop fait exactement ça pour des commerces comme ${shop} : 89 € HT/mois (Commerce), sans remplacer votre caisse.

Est-ce que 15 minutes cette semaine pour voir si ça matche votre rayon auraient du sens ?

Cordialement,
— Nabil, Margin Shop
https://marginshop.app/welcome`;
    },
  },
  {
    step: 2,
    delayDays: 3,
    label: "Touche 2 — preuve / cas",
    subject: (v: ColdEmailVars) =>
      v.businessName
        ? `Re: ${v.businessName} — liste de courses WhatsApp`
        : "Re: liste de courses WhatsApp",
    body: (v: ColdEmailVars) => {
      const hi = v.contactName ? `Bonjour ${v.contactName},` : "Bonjour,";
      return `${hi}

Petit rappel — sans presser.

Ce que les gérants testent en premier avec Margin :
1) vente caisse → stock à jour
2) seuil bas → alerte WhatsApp
3) liste de courses envoyée sur le téléphone, « marquer fait » → stock remonte

Si vous gérez encore le réassort au feeling / Excel, on peut brancher un pilote sur 1 commerce.

OK pour un créneau court ?

— Nabil, Margin Shop`;
    },
  },
  {
    step: 3,
    delayDays: 4,
    label: "Touche 3 — break-up",
    subject: () => "Je ferme le dossier de mon côté",
    body: (v: ColdEmailVars) => {
      const hi = v.contactName ? `Bonjour ${v.contactName},` : "Bonjour,";
      const shop = v.businessName || "votre commerce";
      return `${hi}

Je ne veux pas polluer votre boîte. Dernier message de mon côté concernant Margin pour ${shop}.

Si le stock ↔ caisse n’est pas un sujet aujourd’hui, ignorez cet email.
Si ça revient (ruptures, inventaire, franchise 2ᵉ commerce), répondez « OK » et je vous renvoie le lien d’essai + la démo 15 min.

Bonne continuation,
— Nabil`;
    },
  },
] as const;

export const INFLUENCER_OUTREACH = {
  subject: (handle: string) =>
    `Collab Margin Shop × @${handle.replace(/^@/, "")}`,
  body: (opts: {
    handle: string;
    displayName?: string | null;
    niche?: string | null;
    followers?: number;
  }) => {
    const name = opts.displayName || `@${opts.handle.replace(/^@/, "")}`;
    const niche = opts.niche || "retail";
    return `Bonjour ${name},

J’ai vu votre contenu ${niche} (${opts.followers ? `~${opts.followers.toLocaleString("fr-FR")} abonnés` : "communauté engagée"}) — très aligné avec les gérants de commerces de proximité.

Margin Shop est un SaaS stock ↔ caisse (89 €/mois) : on cherche 3–5 micro-créateurs pour un format honnête (story / short / avis terrain), pas un script pub.

Contrepartie possible :
• 2–3 mois d’abo offerts + lien affiliation (−20 % filleul / +1 mois parrain)
• ou collab barter + code promo dédié
• ou forfait payant selon audience (à discuter)

Si ça vous parle : 1) un lien de profil / media kit, 2) votre tarif habituel ou préférences barter.

Merci,
— Nabil, fondateur Margin Shop
https://marginshop.app/welcome`;
  },
};

/** Score fit 0–100 pour un micro-influenceur SaaS B2B retail. */
export function scoreInfluencerFit(input: {
  followers: number;
  engagementPct?: number | null;
  niche: string;
  platform: string;
  hasEmail: boolean;
}): number {
  let score = 40;

  const f = input.followers;
  // Sweet spot micro : 5k–80k
  if (f >= 5000 && f <= 80000) score += 25;
  else if (f >= 2000 && f < 5000) score += 15;
  else if (f > 80000 && f <= 200000) score += 10;
  else if (f > 200000) score += 0;
  else score -= 5;

  const eng = input.engagementPct ?? 0;
  if (eng >= 3 && eng <= 12) score += 15;
  else if (eng > 1.5) score += 8;
  else if (eng > 0) score += 3;

  const nicheBoost: Record<string, number> = {
    retail: 15,
    food: 12,
    entrepreneur: 12,
    franchise: 10,
    tech: 5,
    autre: 0,
  };
  score += nicheBoost[input.niche] ?? 0;

  if (input.platform === "instagram" || input.platform === "tiktok") score += 5;
  if (input.platform === "linkedin") score += 8;
  if (input.hasEmail) score += 5;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export const MARKETING_PLAYBOOK = {
  icp: [
    "Gérant TPE commerce de proximité (épicerie, mode, beauté…)",
    "Déjà une caisse numérique (Zelty, Cashpad, Square, SumUp…)",
    "1 à 3 commerces — trop petit pour un ERP, trop chaotique pour Excel",
    "Douleur : ruptures, inventaires longs, stock ≠ ventes",
  ],
  weeklyCadence: [
    "Lun : 15 nouveaux prospects (Google Maps / Pages Jaunes / LinkedIn)",
    "Mar–Ven : 10–15 emails touche 1 + follow-ups dus",
    "Mer : 3 profils influenceurs scorés + 1 outreach",
    "Ven : revue pipeline (réponses, RDV, lost) + notes",
  ],
  sources: [
    "Google Maps « épicerie + ville » → site → contact",
    "LinkedIn : gérant commerce / franchise food retail",
    "Groupes Facebook commerçants / franchise",
    "Partenaires caisse (intégrateurs Zelty / Cashpad)",
    "Parrainage clients (Réglages → Affiliation)",
  ],
  influencerCriteria: [
    "5k–80k abonnés, engagement > 2–3 %",
    "Contenu commerce, food retail, vie de gérant — pas lifestyle luxe",
    "FR / francophone, audience commerçants ou créateurs de boutique",
    "Préférer barter + affiliation avant cash (cash flow early)",
  ],
};
