/**
 * Franchise network gates + isolation helpers.
 * Run: npx tsx src/lib/franchise-network.test.ts
 */
import { PLANS } from "./plans";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const reseau = PLANS.find((p) => p.id === "reseau")!;
const commerce = PLANS.find((p) => p.id === "commerce")!;

function canAddStore(storeCount: number, maxStores: number) {
  return storeCount < maxStores;
}

assert(canAddStore(0, reseau.maxStores) === true, "0/3 ok");
assert(canAddStore(2, reseau.maxStores) === true, "2/3 ok");
assert(canAddStore(3, reseau.maxStores) === false, "3/3 bloqué");
assert(canAddStore(1, commerce.maxStores) === false, "commerce 1/1 bloqué");

function postLoginPath(opts: {
  onboarded: boolean;
  plan: string | null;
  networkId: string | null;
}) {
  if (!opts.onboarded) return "/onboarding";
  if (opts.plan === "reseau" || opts.networkId) return "/franchise";
  return "/";
}

assert(
  postLoginPath({ onboarded: false, plan: "reseau", networkId: "n1" }) ===
    "/onboarding",
  "onboarding d’abord"
);
assert(
  postLoginPath({ onboarded: true, plan: "reseau", networkId: "n1" }) ===
    "/franchise",
  "franchise → hub"
);
assert(
  postLoginPath({ onboarded: true, plan: "commerce", networkId: null }) ===
    "/",
  "commerce → /"
);

function middlewareRedirect(opts: {
  path: string;
  plan?: string | null;
  networkId?: string | null;
}) {
  const isFranchise = opts.plan === "reseau" || Boolean(opts.networkId);
  if (opts.path.startsWith("/franchise") && !isFranchise) return "/";
  if (
    isFranchise &&
    (opts.path === "/" ||
      opts.path.startsWith("/ingredients") ||
      opts.path.startsWith("/kiosks") ||
      opts.path.startsWith("/orders") ||
      opts.path.startsWith("/settings") ||
      opts.path.startsWith("/employees"))
  ) {
    return "/franchise";
  }
  return null;
}

assert(
  middlewareRedirect({ path: "/franchise", plan: "commerce" }) === "/",
  "commerce bloqué sur /franchise"
);
assert(
  middlewareRedirect({ path: "/", plan: "reseau", networkId: "n1" }) ===
    "/franchise",
  "franchise redirigé hors commerce"
);
assert(
  middlewareRedirect({
    path: "/franchise/stores",
    plan: "reseau",
    networkId: "n1",
  }) === null,
  "franchise OK sur hub"
);

function sameNetwork(
  a: string | null | undefined,
  b: string | null | undefined
) {
  return Boolean(a && b && a === b);
}

assert(sameNetwork("n1", "n1") === true, "même network");
assert(sameNetwork("n1", "n2") === false, "isolation network");
assert(sameNetwork(null, "n1") === false, "pas de network");

console.log("franchise-network.test.ts — OK");
