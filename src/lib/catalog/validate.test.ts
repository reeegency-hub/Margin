import assert from "node:assert/strict";
import { validateProposedCatalog } from "./validate";
import { normalizeCatalogName, inferCategory } from "./normalize";
import type { ProposedDish } from "@/lib/menu-ai";

assert.equal(normalizeCatalogName("Tomates  "), normalizeCatalogName("tomates"));
assert.equal(inferCategory("Huile d'olive"), "liquide");
assert.equal(inferCategory("Farine T55"), "epicerie");

const dishes: ProposedDish[] = [
  {
    name: "Café",
    salePrice: 0,
    confidence: 1,
    source: "heuristic",
    ingredients: [
      { name: "Café moulu", quantity: 20, unit: "g", confidence: 1 },
      { name: "cafe moulu", quantity: 10, unit: "ml", confidence: 0.8 },
    ],
  },
  {
    name: "Café",
    salePrice: 2.5,
    confidence: 1,
    source: "heuristic",
    ingredients: [
      { name: "Lait", quantity: 100, unit: "xyz" as "g", confidence: 0.5 },
    ],
  },
];

const report = validateProposedCatalog(dishes, ["Sucre"]);
assert.ok(report.canProceed);
assert.ok(report.summary.total > 0);
assert.ok(report.summary.zeroPrices >= 1);
assert.ok(report.summary.duplicateDishes >= 1);
assert.ok(report.headline.length > 10);

console.log("catalog validate ok", report.summary);
