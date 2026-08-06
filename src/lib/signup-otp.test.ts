import assert from "node:assert/strict";
import { hashOtpCode, normalizePhoneE164 } from "@/lib/signup-otp";

assert.equal(normalizePhoneE164("0612345678"), "+33612345678");
assert.equal(normalizePhoneE164("+33 6 12 34 56 78"), "+33612345678");
assert.equal(normalizePhoneE164("0033612345678"), "+33612345678");
assert.equal(normalizePhoneE164("abc"), null);

const a = hashOtpCode("Test@Mail.fr", "123456");
const b = hashOtpCode("test@mail.fr", "123456");
assert.equal(a, b);
assert.notEqual(hashOtpCode("test@mail.fr", "123457"), a);

console.log("signup-otp.test.ts: ok");
