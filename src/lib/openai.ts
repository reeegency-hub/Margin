import { prisma } from "@/lib/db";
import { decryptCredential, maskCredential } from "@/lib/credentials";

export type OpenAIConfig = {
  apiKey: string;
  model: string;
  source: "restaurant" | "env" | null;
  configured: boolean;
  maskedKey: string;
};

function fromEnv(): OpenAIConfig {
  const envKey = (process.env.OPENAI_API_KEY || "").trim();
  const envModel = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim();
  if (!envKey) {
    return {
      apiKey: "",
      model: envModel || "gpt-4o-mini",
      source: null,
      configured: false,
      maskedKey: "",
    };
  }
  return {
    apiKey: envKey,
    model: envModel || "gpt-4o-mini",
    source: "env",
    configured: true,
    maskedKey: maskCredential(envKey),
  };
}

export async function getOpenAIConfig(
  restaurantId?: string | null
): Promise<OpenAIConfig> {
  const envFallback = fromEnv();

  if (restaurantId) {
    try {
      const restaurant = await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { openaiApiKeyEncrypted: true, openaiModel: true },
      });
      const restaurantKey = decryptCredential(restaurant?.openaiApiKeyEncrypted);
      if (restaurantKey) {
        return {
          apiKey: restaurantKey,
          model: (
            restaurant?.openaiModel ||
            envFallback.model ||
            "gpt-4o-mini"
          ).trim(),
          source: "restaurant",
          configured: true,
          maskedKey: maskCredential(restaurantKey),
        };
      }
    } catch {
      // Stale Prisma client / migration not loaded yet → env fallback
    }
  }

  return envFallback;
}
