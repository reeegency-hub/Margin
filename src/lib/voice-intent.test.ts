import { parseVoiceIntent, formatVoiceIntentSummary } from "./voice-intent";

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

console.log(`\nvoice-intent: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
