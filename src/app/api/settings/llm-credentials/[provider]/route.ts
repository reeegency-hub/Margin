import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logCredentialEvent } from "@/lib/llm/handleProviderError";
import type { LlmProvider } from "@/lib/llm/validateFormat";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ provider: string }> };

/** Révocation réelle — encryptedKey = null. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  const restaurantId = session?.user?.restaurantId;
  if (!session?.user?.id || !restaurantId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { provider: raw } = await ctx.params;
  if (raw !== "anthropic" && raw !== "openai") {
    return NextResponse.json({ error: "Provider inconnu." }, { status: 400 });
  }
  const provider = raw as LlmProvider;

  const existing = await prisma.llmProviderCredential.findUnique({
    where: {
      restaurantId_provider: { restaurantId, provider },
    },
  });
  if (!existing) {
    return new Response(null, { status: 204 });
  }

  await prisma.llmProviderCredential.updateMany({
    where: { id: existing.id, restaurantId },
    data: {
      status: "revoked",
      encryptedKey: null,
      encryptionIv: null,
      lastError: null,
    },
  });

  await logCredentialEvent({
    credentialId: existing.id,
    eventType: "revoked",
    actorId: session.user.id,
  });

  if (provider === "openai") {
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { openaiApiKeyEncrypted: null },
    });
  }

  return new Response(null, { status: 204 });
}
