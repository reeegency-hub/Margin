/**
 * Plan limits — plafond produits.
 * Run: npx tsx src/lib/plan-limits.test.ts
 */
import { PLANS } from "./plans";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const commerce = PLANS.find((p) => p.id === "commerce")!;
const reseau = PLANS.find((p) => p.id === "reseau")!;

assert(commerce.maxProducts === 200, "commerce 200 produits");
assert(reseau.maxProducts === null, "franchise illimité");
assert(commerce.maxStores === 1, "commerce 1 boutique");
assert(reseau.maxStores === 3, "franchise 3 boutiques");

function wouldBlock(current: number, add: number, max: number | null) {
  if (max == null) return false;
  return current + add > max;
}

assert(wouldBlock(199, 1, 200) === false, "199+1 ok");
assert(wouldBlock(200, 1, 200) === true, "200+1 bloqué");
assert(wouldBlock(150, 60, 200) === true, "bulk dépasse");
assert(wouldBlock(500, 10, null) === false, "illimité");

/** Compte par network (pas par email) */
function networkStoreGate(activeInNetwork: number, maxStores: number) {
  if (activeInNetwork >= maxStores) {
    return { ok: false as const, error: `max ${maxStores}` };
  }
  return { ok: true as const };
}

assert(networkStoreGate(2, 3).ok === true, "network 2/3 ok");
assert(networkStoreGate(3, 3).ok === false, "network 3/3 bloqué");
assert(networkStoreGate(1, 1).ok === false, "commerce network-like 1/1");

console.log("plan-limits.test.ts — OK");
