/**
 * Point d’entrée UNIQUE pour tout appel LLM tenant (BYOK).
 * Pas de client singleton partagé entre tenants. Pas de fallback silencieux.
 */
import { prisma } from "@/lib/db";
import { decryptCredential } from "@/lib/credentials";
import {
  decryptLlmKey,
  keyFingerprint,
} from "@/lib/llm/crypto";
import {
  handleProviderError,
  logCredentialEvent,
} from "@/lib/llm/handleProviderError";
import type { LlmProvider } from "@/lib/llm/validateFormat";

export class LLMNotConfiguredError extends Error {
  constructor(public tenantId: string) {
    super(`Aucune clé LLM configurée pour le tenant ${tenantId}`);
    this.name = "LLMNotConfiguredError";
  }
}

export type LLMChatMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: unknown;
  tool_call_id?: string;
  name?: string;
};

export type LLMToolDef = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: unknown;
  };
};

export type LLMRequest = {
  tenantId: string;
  messages: LLMChatMessage[];
  tools?: LLMToolDef[];
  maxTokens?: number;
  temperature?: number;
  /** Si true + MARGIN_PLATFORM_LLM=1 : utilise OPENAI_API_KEY plateforme (tracé). */
  allowPlatformFallback?: boolean;
};

export type LLMResponse = {
  provider: LlmProvider | "platform";
  model: string;
  message: {
    role: string;
    content: string | null;
    tool_calls?: Array<{
      id: string;
      type: string;
      function: { name: string; arguments: string };
    }>;
  };
  credentialId?: string;
};

type ActiveCred = {
  id: string;
  provider: LlmProvider;
  encryptedKey: string;
  encryptionIv: string | null;
  status: string;
  source: "byok" | "legacy_restaurant";
};

async function getActiveCredential(
  tenantId: string
): Promise<ActiveCred | null> {
  try {
    const row = await prisma.llmProviderCredential.findFirst({
      where: {
        restaurantId: tenantId,
        status: { in: ["untested", "valid"] },
        encryptedKey: { not: null },
      },
      orderBy: { updatedAt: "desc" },
    });
    if (row?.encryptedKey) {
      return {
        id: row.id,
        provider: row.provider as LlmProvider,
        encryptedKey: row.encryptedKey,
        encryptionIv: row.encryptionIv,
        status: row.status,
        source: "byok",
      };
    }
  } catch (err) {
    // Table absente (db push non fait) → traiter comme « pas de clé »
    const msg = err instanceof Error ? err.message : String(err);
    if (!/LlmProviderCredential|P2021|does not exist/i.test(msg)) {
      throw err;
    }
  }

  // Legacy : clé OpenAI sur Restaurant (pré-BYOK)
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: tenantId },
    select: { openaiApiKeyEncrypted: true },
  });
  const legacy = decryptCredential(restaurant?.openaiApiKeyEncrypted);
  if (legacy) {
    return {
      id: `legacy_${tenantId}`,
      provider: "openai",
      encryptedKey: restaurant!.openaiApiKeyEncrypted!,
      encryptionIv: null,
      status: "valid",
      source: "legacy_restaurant",
    };
  }
  return null;
}

async function markCredentialValidated(credId: string) {
  if (credId.startsWith("legacy_")) return;
  await prisma.llmProviderCredential.update({
    where: { id: credId },
    data: {
      status: "valid",
      lastValidatedAt: new Date(),
      lastError: null,
    },
  });
  await logCredentialEvent({
    credentialId: credId,
    eventType: "validated",
  });
}

function platformFallbackKey(): string | null {
  if (process.env.MARGIN_PLATFORM_LLM !== "1") return null;
  const k = (process.env.OPENAI_API_KEY || "").trim();
  return k || null;
}

const LLM_FETCH_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = LLM_FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      const timeoutErr = new Error("LLM_TIMEOUT") as Error & { status: number };
      timeoutErr.status = 408;
      throw timeoutErr;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(
  apiKey: string,
  model: string,
  req: LLMRequest
): Promise<LLMResponse["message"]> {
  const res = await fetchWithTimeout(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: req.temperature ?? 0.2,
        max_tokens: req.maxTokens ?? 1024,
        messages: req.messages,
        ...(req.tools?.length ? { tools: req.tools, tool_choice: "auto" } : {}),
      }),
    }
  );
  if (!res.ok) {
    const err = new Error(`OpenAI ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: LLMResponse["message"] }>;
  };
  const message = data.choices?.[0]?.message;
  if (!message) throw new Error("Réponse OpenAI vide");
  return message;
}

async function callAnthropic(
  apiKey: string,
  model: string,
  req: LLMRequest
): Promise<LLMResponse["message"]> {
  // Anthropic tools mapping simplifié — messages system séparés
  const system = req.messages
    .filter((m) => m.role === "system")
    .map((m) => m.content || "")
    .join("\n");
  const msgs = req.messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content || "",
    }));

  const tools = req.tools?.map((t) => ({
    name: t.function.name,
    description: t.function.description || "",
    input_schema: t.function.parameters || { type: "object", properties: {} },
  }));

  const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: req.maxTokens ?? 1024,
      system: system || undefined,
      messages: msgs,
      ...(tools?.length ? { tools } : {}),
    }),
  });
  if (!res.ok) {
    const err = new Error(`Anthropic ${res.status}`) as Error & {
      status: number;
    };
    err.status = res.status;
    throw err;
  }
  const data = (await res.json()) as {
    content?: Array<{
      type: string;
      text?: string;
      id?: string;
      name?: string;
      input?: unknown;
    }>;
  };
  const blocks = data.content || [];
  const text = blocks
    .filter((b) => b.type === "text")
    .map((b) => b.text || "")
    .join("\n")
    .trim();
  const toolUses = blocks.filter((b) => b.type === "tool_use");
  return {
    role: "assistant",
    content: text || null,
    tool_calls: toolUses.map((b) => ({
      id: b.id || `tool_${b.name}`,
      type: "function",
      function: {
        name: b.name || "",
        arguments: JSON.stringify(b.input || {}),
      },
    })),
  };
}

export async function callTenantLLM(req: LLMRequest): Promise<LLMResponse> {
  const cred = await getActiveCredential(req.tenantId);

  if (!cred) {
    const platformKey = req.allowPlatformFallback
      ? platformFallbackKey()
      : null;
    if (!platformKey) {
      throw new LLMNotConfiguredError(req.tenantId);
    }
    const {
      logPlatformFallbackUsed,
      incrementPlatformFallbackUsage,
      estimateTokensRough,
    } = await import("@/lib/llm/platform-quota");
    await logPlatformFallbackUsed({
      tenantId: req.tenantId,
      estimatedTokens: estimateTokensRough(req.messages),
    });
    await incrementPlatformFallbackUsage(req.tenantId);
    const model =
      (process.env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
    const message = await callOpenAI(platformKey, model, req);
    return { provider: "platform", model, message };
  }

  const apiKey = decryptLlmKey(cred.encryptedKey, cred.encryptionIv);
  if (!apiKey) throw new LLMNotConfiguredError(req.tenantId);

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: req.tenantId },
    select: { openaiModel: true },
  });
  const openaiModel =
    (restaurant?.openaiModel || process.env.OPENAI_MODEL || "gpt-4o-mini").trim() ||
    "gpt-4o-mini";
  const anthropicModel =
    (process.env.ANTHROPIC_MODEL || "claude-sonnet-4-20250514").trim();

  try {
    const message =
      cred.provider === "anthropic"
        ? await callAnthropic(apiKey, anthropicModel, req)
        : await callOpenAI(apiKey, openaiModel, req);

    if (cred.source === "byok" && cred.status === "untested") {
      await markCredentialValidated(cred.id);
    } else if (cred.source === "byok") {
      await logCredentialEvent({
        credentialId: cred.id,
        eventType: "used",
      }).catch(() => undefined);
    }

    return {
      provider: cred.provider,
      model: cred.provider === "anthropic" ? anthropicModel : openaiModel,
      message,
      credentialId: cred.source === "byok" ? cred.id : undefined,
    };
  } catch (err) {
    if (cred.source === "byok") {
      await handleProviderError(cred, err);
    }
    throw err;
  }
}

/** Statut public pour l’UI (jamais la clé). */
export async function getTenantLlmStatus(tenantId: string): Promise<{
  configured: boolean;
  provider: LlmProvider | "platform" | null;
  status: "untested" | "valid" | "invalid" | "revoked" | "none" | "legacy";
  fingerprintDisplay: string | null;
  source: "byok" | "legacy" | "platform" | null;
}> {
  const row = await prisma.llmProviderCredential.findFirst({
    where: {
      restaurantId: tenantId,
      status: { in: ["untested", "valid", "invalid"] },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (row) {
    const last4 = row.keyFingerprint.slice(-4);
    const prefix = row.provider === "anthropic" ? "sk-ant-…" : "sk-…";
    return {
      configured: row.status === "untested" || row.status === "valid",
      provider: row.provider as LlmProvider,
      status: row.status as "untested" | "valid" | "invalid",
      fingerprintDisplay: `${prefix}${last4}`,
      source: "byok",
    };
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: tenantId },
    select: { openaiApiKeyEncrypted: true },
  });
  const legacy = decryptCredential(restaurant?.openaiApiKeyEncrypted);
  if (legacy) {
    return {
      configured: true,
      provider: "openai",
      status: "legacy",
      fingerprintDisplay: maskCredentialSafe(legacy),
      source: "legacy",
    };
  }

  if (platformFallbackKey()) {
    return {
      configured: true,
      provider: "platform",
      status: "valid",
      fingerprintDisplay: "plateforme",
      source: "platform",
    };
  }

  return {
    configured: false,
    provider: null,
    status: "none",
    fingerprintDisplay: null,
    source: null,
  };
}

function maskCredentialSafe(key: string): string {
  if (key.length <= 4) return "****";
  return `sk-…${key.slice(-4)}`;
}

export { keyFingerprint };
