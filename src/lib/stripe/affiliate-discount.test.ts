import assert from "node:assert/strict";
import { AFFILIATE } from "@/lib/affiliate";
import { AFFILIATE_COUPON_ID } from "@/lib/stripe/affiliate-discount";

assert.equal(AFFILIATE.discountPercentReferee, 20);
assert.equal(AFFILIATE_COUPON_ID, "margin_ref_20_once");

console.log("affiliate-discount.test.ts ok");
