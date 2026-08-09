/**
 * Validation catalogue à l’import — anomalies non bloquantes + résumé.
 */
import type { ProposedDish } from "@/lib/menu-ai";
import { normalizeCatalogName } from "@/lib/catalog/normalize";
import { inferStorageUnit, type StorageUnit } from "@/lib/units";

export type CatalogAnomalyKind =
  | "duplicate_ingredient"
  | "duplicate_dish"
  | "bad_unit"
  | "missing_unit"
  | "zero_price"
  | "aberrant_price"
  | "missing_threshold"
  | "stale_price";

export type CatalogAnomaly = {
  kind: CatalogAnomalyKind;
  severity: "info" | "warn";
  title: string;
  detail?: string;
  /** Index dish dans la proposition */
  dishIndex?: number;
  ingredientName?: string;
  dishName?: string;
  existingIngredientId?: string;
  /** Clé pour fusion / ignore */
  dedupeKey?: string;
};

export type CatalogValidationReport = {
  anomalies: CatalogAnomaly[];
  summary: {
    duplicateIngredients: number;
    duplicateDishes: number;
    zeroPrices: number;
    aberrantPrices: number;
    badUnits: number;
    missingUnits: number;
    total: number;
  };
  /** Toujours true — on n’bloque pas, on informe */
  canProceed: true;
  headline: string;
};

const VALID_UNITS = new Set(["g", "ml", "pcs"]);
const ABERRANT_PRICE_EUR = 500;

export function validateProposedCatalog(
  dishes: ProposedDish[],
  existingIngredientNames: string[] = []
): CatalogValidationReport {
  const anomalies: CatalogAnomaly[] = [];
  const existingNorm = new Set(
    existingIngredientNames.map(normalizeCatalogName).filter(Boolean)
  );
  const seenDish = new Map<string, number>();
  const seenIngInBatch = new Map<string, { product: string; count: number }>();

  dishes.forEach((dish, dishIndex) => {
    const dName = (dish.name || "").trim();
    if (!dName) return;
    const dKey = normalizeCatalogName(dName);
    if (seenDish.has(dKey)) {
      anomalies.push({
        kind: "duplicate_dish",
        severity: "warn",
        title: `Doublon produit « ${dName} »`,
        detail: `Déjà proposé à la ligne ${(seenDish.get(dKey) ?? 0) + 1}`,
        dishIndex,
        dishName: dName,
        dedupeKey: `dish:${dKey}`,
      });
    } else {
      seenDish.set(dKey, dishIndex);
    }

    const price = Number(dish.salePrice);
    if (!(price > 0)) {
      anomalies.push({
        kind: "zero_price",
        severity: "warn",
        title: `Prix manquant ou à 0 — ${dName}`,
        detail: "Vérifiez le prix de vente avant mise en caisse.",
        dishIndex,
        dishName: dName,
      });
    } else if (price < 0 || price > ABERRANT_PRICE_EUR) {
      anomalies.push({
        kind: "aberrant_price",
        severity: "warn",
        title: `Prix aberrant (${price} €) — ${dName}`,
        dishIndex,
        dishName: dName,
      });
    }

    for (const ing of dish.ingredients || []) {
      const iName = (ing.name || "").trim();
      if (!iName) continue;
      const iKey = normalizeCatalogName(iName);
      const unit = (ing.unit || "").toLowerCase();

      if (!unit) {
        anomalies.push({
          kind: "missing_unit",
          severity: "warn",
          title: `Unité manquante — ${iName}`,
          detail: `Suggestion : ${inferStorageUnit(iName)}`,
          dishIndex,
          ingredientName: iName,
        });
      } else if (!VALID_UNITS.has(unit)) {
        anomalies.push({
          kind: "bad_unit",
          severity: "warn",
          title: `Unité incohérente « ${ing.unit} » — ${iName}`,
          detail: `Attendu : g, ml ou pcs (suggéré ${inferStorageUnit(iName)})`,
          dishIndex,
          ingredientName: iName,
        });
      } else {
        const inferred = inferStorageUnit(iName);
        if (inferred !== unit && unit === "pcs" && inferred !== "pcs") {
          // soft: pcs vs weight often intentional
        } else if (
          inferred !== (unit as StorageUnit) &&
          ((inferred === "ml" && unit === "g") ||
            (inferred === "g" && unit === "ml"))
        ) {
          anomalies.push({
            kind: "bad_unit",
            severity: "info",
            title: `Unité douteuse — ${iName} en ${unit}`,
            detail: `Le nom suggère plutôt « ${inferred} »`,
            dishIndex,
            ingredientName: iName,
          });
        }
      }

      if (existingNorm.has(iKey)) {
        anomalies.push({
          kind: "duplicate_ingredient",
          severity: "info",
          title: `Référence déjà en stock — ${iName}`,
          detail: "Sera réutilisée (pas de doublon créé).",
          dishIndex,
          ingredientName: iName,
          dedupeKey: `ing:${iKey}`,
        });
      }

      const prev = seenIngInBatch.get(iKey);
      if (prev) {
        prev.count += 1;
      } else {
        seenIngInBatch.set(iKey, { product: dName, count: 1 });
      }
    }
  });

  // Near-duplicates in batch (same norm used in many dishes is OK — only flag exact dup dish names already done)
  // Flag ingredient names that look like soft duplicates within proposal names list
  const allIngNames = new Map<string, string[]>();
  for (const dish of dishes) {
    for (const ing of dish.ingredients || []) {
      const n = (ing.name || "").trim();
      if (!n) continue;
      const k = normalizeCatalogName(n);
      const list = allIngNames.get(k) || [];
      if (!list.includes(n)) list.push(n);
      allIngNames.set(k, list);
    }
  }
  for (const [, variants] of allIngNames) {
    if (variants.length > 1) {
      anomalies.push({
        kind: "duplicate_ingredient",
        severity: "warn",
        title: `Variantes de nom : ${variants.join(" / ")}`,
        detail: "Fusionnez en une seule référence après import.",
        ingredientName: variants[0],
        dedupeKey: `ing:${normalizeCatalogName(variants[0])}`,
      });
    }
  }

  const summary = {
    duplicateIngredients: anomalies.filter((a) => a.kind === "duplicate_ingredient").length,
    duplicateDishes: anomalies.filter((a) => a.kind === "duplicate_dish").length,
    zeroPrices: anomalies.filter((a) => a.kind === "zero_price").length,
    aberrantPrices: anomalies.filter((a) => a.kind === "aberrant_price").length,
    badUnits: anomalies.filter((a) => a.kind === "bad_unit").length,
    missingUnits: anomalies.filter((a) => a.kind === "missing_unit").length,
    total: anomalies.length,
  };

  const parts: string[] = [];
  if (summary.duplicateIngredients)
    parts.push(`${summary.duplicateIngredients} doublon(s) référence`);
  if (summary.duplicateDishes)
    parts.push(`${summary.duplicateDishes} doublon(s) produit`);
  if (summary.zeroPrices) parts.push(`${summary.zeroPrices} prix à 0`);
  if (summary.aberrantPrices)
    parts.push(`${summary.aberrantPrices} prix aberrant(s)`);
  if (summary.badUnits + summary.missingUnits)
    parts.push(
      `${summary.badUnits + summary.missingUnits} unité(s) à vérifier`
    );

  const headline =
    summary.total === 0
      ? "Aucune anomalie détectée — vous pouvez valider."
      : `${summary.total} point(s) à revoir : ${parts.join(", ")}. Vous pouvez corriger ou valider quand même.`;

  return {
    anomalies,
    summary,
    canProceed: true,
    headline,
  };
}
