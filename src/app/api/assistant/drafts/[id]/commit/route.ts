import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getAssistantDraft,
  parseDraftPayload,
  hasBlockingFlags,
} from "@/lib/assistant/drafts";
import {
  commitImportInventory,
  commitSetWhatsapp,
  commitUpsertTeam,
} from "@/lib/assistant/commit";
import type { AmbiguityFlag } from "@/lib/assistant/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const session = await getServerSession(authOptions);
  const restaurantId = session?.user?.restaurantId;
  if (!session?.user?.id || !restaurantId) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const draft = await getAssistantDraft(restaurantId, id);
  if (!draft) {
    return NextResponse.json({ error: "Brouillon introuvable." }, { status: 404 });
  }
  if (draft.status === "expired") {
    return NextResponse.json(
      { error: "Brouillon expiré — renvoyez le fichier." },
      { status: 410 }
    );
  }
  if (draft.status === "committed") {
    return NextResponse.json(
      { error: "Déjà appliqué.", commitId: draft.commitId },
      { status: 409 }
    );
  }

  const { payload, flags } = parseDraftPayload<{ storeId?: string }>(draft);
  if (hasBlockingFlags(flags as AmbiguityFlag[])) {
    return NextResponse.json(
      {
        error: "Ambiguïtés bloquantes — corrigez l’aperçu avant d’appliquer.",
        flags,
      },
      { status: 422 }
    );
  }

  const base = {
    restaurantId,
    userId: session.user.id,
    draftId: draft.id,
    payload,
    flags: flags as AmbiguityFlag[],
  };

  if (draft.kind === "import_inventory") {
    const result = await commitImportInventory(base);
    if (!result.ok) {
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result);
  }
  if (draft.kind === "upsert_team") {
    const result = await commitUpsertTeam(base);
    if (!result.ok) {
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result);
  }
  if (draft.kind === "set_whatsapp") {
    const result = await commitSetWhatsapp(base);
    if (!result.ok) {
      return NextResponse.json(result, { status: 422 });
    }
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Type de brouillon inconnu." }, { status: 400 });
}
