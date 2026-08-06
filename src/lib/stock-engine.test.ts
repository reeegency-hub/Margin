/**
 * Unit tests for rupture estimation (no DB).
 * Run: npx tsx src/lib/stock-engine.test.ts
 */
import { estimateRuptureLabel, formatQty } from "./stock-engine";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

assert(formatQty(800, "g") === "800 g", "format g");
assert(formatQty(5000, "g", "Pommes de terre") === "5 kg", "format kg bulk");
assert(formatQty(2, "pcs") === "2 unités", "format pcs");

assert(
  estimateRuptureLabel(0, 100).includes("Rupture déjà"),
  "rupture atteinte"
);
assert(
  estimateRuptureLabel(50, 200).includes("ce soir"),
  "rupture ce soir"
);
assert(
  estimateRuptureLabel(200, 150).includes("demain"),
  "rupture demain"
);
assert(
  estimateRuptureLabel(1000, 0).includes("insuffisante"),
  "pas de conso"
);

console.log("stock-engine.test.ts — OK");
