/**
 * Unités cuisine — stockage interne : g | ml | pcs
 * Affichage : kg / g / L / ml / unités selon le produit.
 */

export type StorageUnit = "g" | "ml" | "pcs";
export type DisplayUnit = "kg" | "g" | "L" | "ml" | "pcs";

const PCS_RE =
  /salade|œufs?|oeufs?|avocat|citron|lime|pain|baguette|bun|burger|tortilla|wrap|feuille|botte|pi[eè]ce|unit[eé]|bouquet|gousse/i;

const ML_RE =
  /huile|lait|cr[eè]me|vin|eau|jus|sauce|vinaigre|sirop|bouillon|fond|bière|soda|sirop/i;

const KG_BULK_RE =
  /pommes?\s*de\s*terre|patate|farine|riz|p[aâ]tes?|sucre|sel\b|oignons?|carottes?|courgettes?|poulet|b[œoe]uf|viande|agneau|porc|fromage|beurre|lard|saumon|cabillaud|moules?|frites?|semoule|polenta|quinoa/i;

/** Choisit l’unité de stockage à la création (g/ml/pcs). */
export function inferStorageUnit(name: string): StorageUnit {
  const n = name.trim();
  if (!n) return "g";
  if (PCS_RE.test(n)) return "pcs";
  if (ML_RE.test(n)) return "ml";
  return "g";
}

/** Affichage préféré (kg pour les gros volumes). */
export function preferredDisplayUnit(
  storageUnit: string,
  name?: string
): DisplayUnit {
  if (storageUnit === "pcs") return "pcs";
  if (storageUnit === "ml") {
    return name && KG_BULK_RE.test(name) ? "L" : "ml";
  }
  if (storageUnit === "g") {
    if (name && KG_BULK_RE.test(name)) return "kg";
    return "g";
  }
  return "g";
}

export function displayUnitLabel(display: DisplayUnit): string {
  if (display === "pcs") return "unités";
  if (display === "kg") return "kg";
  if (display === "L") return "L";
  if (display === "ml") return "ml";
  return "g";
}

export function toDisplayQty(storageQty: number, display: DisplayUnit): number {
  if (display === "kg" || display === "L") {
    const v = storageQty / 1000;
    return Math.round(v * 100) / 100;
  }
  return Math.round(storageQty * 100) / 100;
}

export function toStorageQty(displayQty: number, display: DisplayUnit): number {
  if (display === "kg" || display === "L") return displayQty * 1000;
  return displayQty;
}

export function formatKitchenQty(qty: number, storageUnit: string, name?: string): string {
  const display = preferredDisplayUnit(storageUnit, name);
  const n = toDisplayQty(qty, display);
  const rounded = Number.isInteger(n) ? String(n) : n.toFixed(n < 10 ? 2 : 1);
  if (display === "pcs") return `${rounded} unité${n > 1 ? "s" : ""}`;
  return `${rounded} ${displayUnitLabel(display)}`;
}

/** Seuil critique suggéré (en unité de stockage). */
export function suggestThreshold(storageUnit: StorageUnit, name?: string): number {
  if (storageUnit === "pcs") return 5;
  if (storageUnit === "ml") {
    return preferredDisplayUnit("ml", name) === "L" ? 2000 : 500;
  }
  // g
  if (name && KG_BULK_RE.test(name)) return 3000; // 3 kg
  return 500; // frais
}

/** Quantité à commander / réappro suggérée (stockage). */
export function suggestReorderQty(storageUnit: StorageUnit, name?: string): number {
  if (storageUnit === "pcs") return 20;
  if (storageUnit === "ml") {
    return preferredDisplayUnit("ml", name) === "L" ? 5000 : 1500;
  }
  if (name && KG_BULK_RE.test(name)) return 5000; // 5 kg
  return 2000; // 2 kg de frais
}

export function applyUnitDefaults(name: string): {
  unit: StorageUnit;
  criticalThreshold: number;
  reorderQty: number;
} {
  const unit = inferStorageUnit(name);
  return {
    unit,
    criticalThreshold: suggestThreshold(unit, name),
    reorderQty: suggestReorderQty(unit, name),
  };
}
