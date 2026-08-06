/** Normalisation noms catalogue (dédup). */
export function normalizeCatalogName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Catégorie heuristique pour seuils par défaut. */
export function inferCategory(name: string): string {
  const n = name.toLowerCase();
  if (
    /huile|lait|cr[eè]me|vin|eau|jus|sauce|vinaigre|sirop|bouillon|bi[eè]re|soda/.test(
      n
    )
  ) {
    return "liquide";
  }
  if (
    /salade|œuf|oeuf|avocat|citron|pain|baguette|bun|wrap|pi[eè]ce|unit[eé]|botte/.test(
      n
    )
  ) {
    return "piece";
  }
  if (
    /farine|riz|p[aâ]tes?|sucre|sel\b|conserve|huile d'olive|caf[eé]|th[eé]|epice/.test(
      n
    )
  ) {
    return "epicerie";
  }
  if (
    /tomate|salade|poulet|viande|fromage|beurre|poisson|fruit|l[eé]gume|frais/.test(
      n
    )
  ) {
    return "frais";
  }
  return "autre";
}
