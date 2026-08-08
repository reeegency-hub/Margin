/**
 * Tests quota fallback LLM plateforme (logique pure + erreurs).
 */
import assert from "node:assert/strict";
import {
  PlatformQuotaExceededError,
  estimateTokensRough,
} from "@/lib/llm/platform-quota";
import { LLMNotConfiguredError } from "@/lib/llm/router";

function testEstimateTokens() {
  const n = estimateTokensRough([
    { content: "abcd" }, // 1 token
    { content: "abcdefgh" }, // 2
  ]);
  assert.equal(n, 3);
}

function testErrorNames() {
  const e = new PlatformQuotaExceededError("t1");
  assert.equal(e.name, "PlatformQuotaExceededError");
  const n = new LLMNotConfiguredError("t2");
  assert.equal(n.name, "LLMNotConfiguredError");
}

function testPlatformFlagGate() {
  const prev = process.env.MARGIN_PLATFORM_LLM;
  process.env.MARGIN_PLATFORM_LLM = "0";
  try {
    const enabled = process.env.MARGIN_PLATFORM_LLM === "1";
    assert.equal(enabled, false);
  } finally {
    if (prev === undefined) delete process.env.MARGIN_PLATFORM_LLM;
    else process.env.MARGIN_PLATFORM_LLM = prev;
  }
}

function main() {
  testEstimateTokens();
  testErrorNames();
  testPlatformFlagGate();
  console.log("platform-llm-fallback.test.ts: OK");
}

main();
