import assert from "node:assert/strict";
import { validateKeyFormat } from "@/lib/llm/validateFormat";

assert.equal(validateKeyFormat("openai", "sk-abcdefghijklmnopqrstuvwxyz").ok, true);
assert.equal(validateKeyFormat("openai", "sk-proj-abcdefghijklmnopqrst").ok, true);
assert.equal(validateKeyFormat("openai", "short").ok, false);
assert.equal(
  validateKeyFormat("anthropic", "sk-ant-abcdefghijklmnopqrstuvwxyz").ok,
  true
);
assert.equal(validateKeyFormat("anthropic", "sk-abcdefghijklmnopqrstuvwxyz").ok, false);

console.log("llm-validateFormat.test.ts: ok");
