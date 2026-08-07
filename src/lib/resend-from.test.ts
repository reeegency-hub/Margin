import assert from "node:assert/strict";
import { resendFromCandidates } from "@/lib/resend-from";

const list = resendFromCandidates();
assert.ok(list.length >= 1);
assert.ok(list.some((f) => f.includes("@")));
// Toujours un fallback onboarding si primary n’est pas déjà onboarding
if (!list[0].includes("onboarding@resend.dev")) {
  assert.ok(list.some((f) => f.includes("onboarding@resend.dev")));
}

console.log("resend-from.test.ts ok");
