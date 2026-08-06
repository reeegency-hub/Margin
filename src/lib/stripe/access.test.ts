import assert from "node:assert/strict";
import { hasAppAccess, isPaidAccessStatus } from "@/lib/stripe/access";

assert.equal(isPaidAccessStatus("active"), true);
assert.equal(isPaidAccessStatus("trialing"), true);
assert.equal(isPaidAccessStatus("incomplete"), false);

// Signup Stripe incomplete — même si active true (legacy) → refusé
assert.equal(
  hasAppAccess({
    active: true,
    stripeStatus: "incomplete",
    accessGraceUntil: null,
  }),
  false
);

// Signup correct : active false + incomplete → refusé
assert.equal(
  hasAppAccess({
    active: false,
    stripeStatus: "incomplete",
    accessGraceUntil: null,
  }),
  false
);

// Payé
assert.equal(
  hasAppAccess({
    active: true,
    stripeStatus: "active",
    accessGraceUntil: null,
  }),
  true
);

// Seed / pilote sans Stripe
assert.equal(
  hasAppAccess({
    active: true,
    stripeStatus: "none",
    accessGraceUntil: null,
  }),
  true
);
assert.equal(
  hasAppAccess({
    active: true,
    stripeStatus: null,
    accessGraceUntil: null,
  }),
  true
);

// Grâce past_due
assert.equal(
  hasAppAccess({
    active: false,
    stripeStatus: "past_due",
    accessGraceUntil: new Date(Date.now() + 86400000),
  }),
  true
);
assert.equal(
  hasAppAccess({
    active: true,
    stripeStatus: "past_due",
    accessGraceUntil: new Date(Date.now() - 1000),
  }),
  false
);

console.log("access.test.ts ok");
