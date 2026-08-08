/**
 * Tests sécurité — signatures webhook + auth cron (sans réseau).
 */
import assert from "node:assert/strict";
import {
  authenticatePosWebhook,
  verifyPlainWebhookSecret,
  verifyHmacSha256,
} from "@/lib/pos/webhook-auth";
import { createHmac } from "node:crypto";
import { assertCronAuthorized } from "@/lib/cron-auth";

function testPosRejectsBadSecret() {
  const auth = authenticatePosWebhook({
    webhookSecret: "correct-secret-32chars-minimum!!",
    rawBody: '{"ok":true}',
    plainSecret: "wrong",
  });
  assert.equal(auth.ok, false);
  if (!auth.ok) assert.equal(auth.status, 401);
}

function testPosAcceptsTimingSafeSecret() {
  const secret = "correct-secret-32chars-minimum!!";
  assert.equal(verifyPlainWebhookSecret(secret, secret), true);
  assert.equal(verifyPlainWebhookSecret("x", secret), false);
  const auth = authenticatePosWebhook({
    webhookSecret: secret,
    rawBody: "{}",
    plainSecret: secret,
  });
  assert.equal(auth.ok, true);
}

function testPosHmac() {
  const secret = "hmac-secret-value-for-tests!!!!";
  const rawBody = '{"order":1}';
  const hex = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  assert.equal(
    verifyHmacSha256({
      rawBody,
      secret,
      signatureHeader: `sha256=${hex}`,
    }),
    true
  );
  assert.equal(
    verifyHmacSha256({
      rawBody,
      secret,
      signatureHeader: "sha256=deadbeef",
    }),
    false
  );
}

function testCronRejectsWithoutSecret() {
  const prev = process.env.CRON_SECRET;
  const prevNode = process.env.NODE_ENV;
  process.env.CRON_SECRET = "test-cron-secret-abcdefghijklmnop";
  process.env.NODE_ENV = "production";
  try {
    const req = new Request("http://localhost/api/cron/stock-alerts");
    const denied = assertCronAuthorized(req);
    assert.ok(denied);
    assert.equal(denied!.status, 401);

    const okReq = new Request("http://localhost/api/cron/stock-alerts", {
      headers: { authorization: "Bearer test-cron-secret-abcdefghijklmnop" },
    });
    assert.equal(assertCronAuthorized(okReq), null);
  } finally {
    if (prev === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = prev;
    if (prevNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = prevNode;
  }
}

function main() {
  testPosRejectsBadSecret();
  testPosAcceptsTimingSafeSecret();
  testPosHmac();
  testCronRejectsWithoutSecret();
  console.log("webhook-signatures.test.ts: OK");
}

main();
