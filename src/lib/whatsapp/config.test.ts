/**
 * Tests légers — config WhatsApp + fingerprint cycle.
 */
import assert from "node:assert/strict";
import {
  WHATSAPP_BATCH_MINUTES,
  WHATSAPP_DAILY_LIMIT,
  countsTowardDailyLimit,
  requireWhatsAppTemplates,
} from "./config";

assert.ok(WHATSAPP_BATCH_MINUTES >= 5 && WHATSAPP_BATCH_MINUTES <= 30);
assert.ok(WHATSAPP_DAILY_LIMIT >= 1);
assert.equal(countsTowardDailyLimit("stock_recap"), true);
assert.equal(countsTowardDailyLimit("session_reply"), false);
assert.equal(typeof requireWhatsAppTemplates(), "boolean");

console.log("whatsapp config ok");
