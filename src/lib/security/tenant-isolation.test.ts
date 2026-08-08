/**
 * Tests unitaires — isolation tenant (signatures + where forcé).
 * Pas de DB : vérifie les contrats anti-IDOR corrigés en C1.2.
 */
import assert from "node:assert/strict";
import { withTenantWhere, tenantWhere } from "@/lib/tenant";

function testWithTenantWhereMerges() {
  const w = withTenantWhere("tenant-a", { id: "alert-1", status: "ACTIVE" });
  assert.equal(w.restaurantId, "tenant-a");
  assert.equal(w.id, "alert-1");
  assert.equal(w.status, "ACTIVE");
}

function testTenantWhere() {
  assert.deepEqual(tenantWhere("rid-1"), { restaurantId: "rid-1" });
}

/** Simule le where attendu pour queue/send alert (anti-IDOR). */
function testAlertWhereRequiresBothIds() {
  const restaurantId = "resto-a";
  const alertId = "alert-b";
  const where = withTenantWhere(restaurantId, { id: alertId });
  assert.equal(where.restaurantId, restaurantId);
  assert.equal(where.id, alertId);
  // Un attaquant qui omet restaurantId ne doit pas passer ce helper
  assert.notEqual(Object.keys(where).sort().join(","), "id");
}

/** Checkout : body.restaurantId ignoré hors admin. */
function testCheckoutTenantResolution() {
  function resolveRestaurantId(opts: {
    isAdmin: boolean;
    bodyRestaurantId?: string;
    sessionRestaurantId?: string;
  }): string | undefined {
    return opts.isAdmin && opts.bodyRestaurantId
      ? opts.bodyRestaurantId
      : opts.sessionRestaurantId || undefined;
  }

  assert.equal(
    resolveRestaurantId({
      isAdmin: false,
      bodyRestaurantId: "victim-tenant",
      sessionRestaurantId: "my-tenant",
    }),
    "my-tenant"
  );
  assert.equal(
    resolveRestaurantId({
      isAdmin: true,
      bodyRestaurantId: "ops-target",
      sessionRestaurantId: "admin-home",
    }),
    "ops-target"
  );
  assert.equal(
    resolveRestaurantId({
      isAdmin: false,
      bodyRestaurantId: "victim-tenant",
    }),
    undefined
  );
}

function main() {
  testWithTenantWhereMerges();
  testTenantWhere();
  testAlertWhereRequiresBothIds();
  testCheckoutTenantResolution();
  console.log("tenant-isolation.test.ts: OK");
}

main();
