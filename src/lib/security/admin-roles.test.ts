/**
 * Tests rôles admin — rank + filtre metadata secrets.
 */
import assert from "node:assert/strict";

type UserRole = "MEMBER" | "MANAGER" | "FOUNDER";
const ROLE_RANK: Record<UserRole, number> = {
  MEMBER: 0,
  MANAGER: 1,
  FOUNDER: 2,
};

function canAccess(role: UserRole, min: UserRole) {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

function stripSecretKeys(meta: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(meta).filter(
      ([k]) =>
        !/secret|password|token|apiKey|authorization|credential/i.test(k)
    )
  );
}

function main() {
  assert.equal(canAccess("FOUNDER", "FOUNDER"), true);
  assert.equal(canAccess("MANAGER", "FOUNDER"), false);
  assert.equal(canAccess("MEMBER", "MANAGER"), false);
  assert.equal(canAccess("MANAGER", "MEMBER"), true);

  const cleaned = stripSecretKeys({
    restaurantId: "r1",
    apiKey: "sk-secret",
    note: "ok",
  });
  assert.deepEqual(cleaned, { restaurantId: "r1", note: "ok" });
  assert.equal("apiKey" in cleaned, false);

  console.log("admin-roles.test.ts: OK");
}

main();
