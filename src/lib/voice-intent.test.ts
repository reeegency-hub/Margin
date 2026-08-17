import {
  parseVoiceIntent,
  formatVoiceIntentSummary,
  parseSpokenSale,
  matchSpokenToCatalog,
} from "./voice-intent";

let passed = 0;
let failed = 0;

function assert(name: string, cond: boolean) {
  if (cond) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${name}`);
  }
}

// Inventory intent
const inv = parseVoiceIntent("Tomates 5 kilos, Salade 2 kg");
assert("inventory type", inv.type === "inventory");
assert("inventory items", inv.type === "inventory" && inv.items.length >= 2);

// Recipe intent
const rec = parseVoiceIntent("Burger : 150 g bœuf, 1 pain, 30 g fromage");
assert("recipe type", rec.type === "recipe");
assert(
  "recipe dish",
  rec.type === "recipe" && rec.dishName.toLowerCase().includes("burger")
);

// Summary
const summary = formatVoiceIntentSummary(rec);
assert("summary non-empty", summary.length > 5);

const spoken = parseSpokenSale("deux lait et un pain");
assert("spoken 2 items", spoken.length === 2);
assert("spoken qty", spoken[0]?.quantity === 2 && spoken[1]?.quantity === 1);

const hit = matchSpokenToCatalog(spoken, [
  { id: "1", name: "Lait entier", sku: "LAIT" },
  { id: "2", name: "Pain baguette", sku: null },
]);
assert("spoken match", hit.matched.length === 2 && hit.unknown.length === 0);

console.log(`\nvoice-intent: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
