/**
 * Defense-in-depth vague 1 — where tenant sur updateMany.
 */
import assert from "node:assert/strict";
import { withTenantWhere } from "@/lib/tenant";

function main() {
  const restaurantId = "resto-a";
  const ingredientId = "ing-1";
  const saleId = "sale-1";
  const orderId = "po-1";
  const employeeId = "emp-1";

  assert.deepEqual(withTenantWhere(restaurantId, { id: ingredientId }), {
    id: ingredientId,
    restaurantId,
  });
  assert.deepEqual(withTenantWhere(restaurantId, { id: saleId }), {
    id: saleId,
    restaurantId,
  });
  assert.deepEqual(withTenantWhere(restaurantId, { id: orderId }), {
    id: orderId,
    restaurantId,
  });
  assert.deepEqual(withTenantWhere(restaurantId, { id: employeeId }), {
    id: employeeId,
    restaurantId,
  });

  // Un where id-seul ne doit jamais être le contrat post-vague-1
  const bad = { id: ingredientId } as Record<string, unknown>;
  assert.equal("restaurantId" in bad, false);
  const good = withTenantWhere(restaurantId, bad);
  assert.equal(good.restaurantId, restaurantId);

  console.log("defense-in-depth-wave1.test.ts: OK");
}

main();
