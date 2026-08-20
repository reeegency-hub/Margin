/**
 * Tests secrets prod — pas de fallback *-dev en production.
 */
import assert from "node:assert/strict";
import {
  requireOtpPepper,
  requirePartnerAuthSecret,
} from "@/lib/security/prod-secrets";

function withEnv(
  patch: Record<string, string | undefined>,
  fn: () => void
) {
  const prev: Record<string, string | undefined> = {};
  for (const k of Object.keys(patch)) {
    prev[k] = process.env[k];
    const v = patch[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const k of Object.keys(patch)) {
      const v = prev[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
}

function testDevFallbackAllowed() {
  withEnv(
    {
      NODE_ENV: "development",
      VERCEL_ENV: undefined,
      NEXTAUTH_SECRET: undefined,
      CREDENTIALS_ENCRYPTION_KEY: undefined,
      PARTNER_AUTH_SECRET: undefined,
    },
    () => {
      assert.equal(requireOtpPepper(), "margin-otp-dev");
      assert.equal(requirePartnerAuthSecret(), "margin-partner-dev");
    }
  );
}

function testProdRejectsFallback() {
  withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      NEXTAUTH_SECRET: undefined,
      CREDENTIALS_ENCRYPTION_KEY: undefined,
      PARTNER_AUTH_SECRET: undefined,
    },
    () => {
      assert.throws(() => requireOtpPepper(), /NEXTAUTH_SECRET/);
      assert.throws(() => requirePartnerAuthSecret(), /PARTNER_AUTH_SECRET/);
    }
  );
}

function testProdUsesSecrets() {
  withEnv(
    {
      NODE_ENV: "production",
      VERCEL_ENV: "production",
      NEXTAUTH_SECRET: "test-nextauth-secret-32chars!!!!",
      PARTNER_AUTH_SECRET: "test-partner-secret-32chars!!!!",
    },
    () => {
      assert.equal(requireOtpPepper(), "test-nextauth-secret-32chars!!!!");
      assert.equal(
        requirePartnerAuthSecret(),
        "test-partner-secret-32chars!!!!"
      );
    }
  );
}

function main() {
  testDevFallbackAllowed();
  testProdRejectsFallback();
  testProdUsesSecrets();
  console.log("prod-secrets.test.ts: OK");
}

main();
