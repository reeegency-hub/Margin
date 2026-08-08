import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { encryptLlmKey, keyFingerprint } from "@/lib/llm/crypto";
import { logCredentialEvent } from "@/lib/llm/handleProviderError";
import { validateKeyFormat } from "@/lib/llm/validateFormat";
import { getTenantLlmStatus } from "@/lib/llm/router";

export const dynamic = "force-dynamic";

const ConnectSchema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  apiKey: z.string().min(20).max(200),
});

async function auth() {
  const session = await getServerSession(authOptions);
  const restaurantId = session?.user?.restaurantId;
  if (!session?.user?.id || !restaurantId) return null;
  return { userId: session.user.id, restaurantId };
}

/** Liste des credentials (métadonnées seules). */
export async function GET() {
  const a = await auth();
  if (!a) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const status = await getTenantLlmStatus(a.restaurantId).catch(() => ({
    configured: false,
    provider: null,
    status: "none" as const,
    fingerprintDisplay: null,
    source: null,
  }));
  let rows: Array<{
    provider: string;
    status: string;
    keyFingerprint: string;
    lastValidatedAt: Date | null;
    lastError: string | null;
    updatedAt: Date;
  }> = [];
  try {
    rows = await prisma.llmProviderCredential.findMany({
      where: { restaurantId: a.restaurantId },
      select: {
        provider: true,
        status: true,
        keyFingerprint: true,
        lastValidatedAt: true,
        lastError: true,
        updatedAt: true,
      },
    });
  } catch {
    /* table absente / migration en cours */
  }
  return NextResponse.json({ status, credentials: rows });
}

/** Connecter une clé — validation format only, chiffrement serveur. */
export async function POST(req: Request) {
  const a = await auth();
  if (!a) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const parsed = ConnectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_payload", message: "Provider et clé requis." },
      { status: 400 }
    );
  }

  const { provider, apiKey } = parsed.data;
  const format = validateKeyFormat(provider, apiKey);
  if (!format.ok) {
    return NextResponse.json(
      { error: "invalid_format", message: format.message },
      { status: 400 }
    );
  }

  const { encryptedKey, encryptionIv } = encryptLlmKey(apiKey);
  const fingerprint = keyFingerprint(apiKey);

  const row = await prisma.llmProviderCredential.upsert({
    where: {
      restaurantId_provider: {
        restaurantId: a.restaurantId,
        provider,
      },
    },
    create: {
      restaurantId: a.restaurantId,
      provider,
      encryptedKey,
      encryptionIv,
      keyFingerprint: fingerprint,
      status: "untested",
      createdByUserId: a.userId,
    },
    update: {
      encryptedKey,
      encryptionIv,
      keyFingerprint: fingerprint,
      status: "untested",
      lastValidatedAt: null,
      lastError: null,
    },
  });

  await logCredentialEvent({
    credentialId: row.id,
    eventType: "created",
    actorId: a.userId,
  });

  // Sync legacy OpenAI field si provider openai (compat menus / factures)
  if (provider === "openai") {
    await prisma.restaurant.update({
      where: { id: a.restaurantId },
      data: { openaiApiKeyEncrypted: encryptedKey },
    });
  }

  return NextResponse.json({
    provider,
    status: "untested",
    fingerprint: fingerprint.slice(-4),
  });
}
