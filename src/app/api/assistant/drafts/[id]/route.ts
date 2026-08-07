import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  getAssistantDraft,
  parseDraftPayload,
  updateDraftPayload,
} from "@/lib/assistant/drafts";
import type { AmbiguityFlag } from "@/lib/assistant/schemas";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

async function sessionRestaurant() {
  const session = await getServerSession(authOptions);
  const restaurantId = session?.user?.restaurantId;
  if (!session?.user?.id || !restaurantId) return null;
  return { session, restaurantId, userId: session.user.id };
}

export async function GET(_req: Request, ctx: Ctx) {
  const auth = await sessionRestaurant();
  if (!auth) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const { id } = await ctx.params;
  const draft = await getAssistantDraft(auth.restaurantId, id);
  if (!draft) {
    return NextResponse.json({ error: "Brouillon introuvable." }, { status: 404 });
  }
  const { payload, flags } = parseDraftPayload(draft);
  return NextResponse.json({
    id: draft.id,
    kind: draft.kind,
    status: draft.status,
    sourceFileName: draft.sourceFileName,
    sourceFileId: draft.sourceFileId,
    expiresAt: draft.expiresAt.toISOString(),
    payload,
    flags,
  });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await sessionRestaurant();
  if (!auth) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }
  const { id } = await ctx.params;
  let body: { payload?: unknown; flags?: AmbiguityFlag[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
  if (body.payload == null) {
    return NextResponse.json({ error: "payload requis." }, { status: 400 });
  }
  const updated = await updateDraftPayload(
    auth.restaurantId,
    id,
    body.payload,
    body.flags
  );
  if (!updated) {
    return NextResponse.json(
      { error: "Brouillon non modifiable (expiré ou déjà appliqué)." },
      { status: 409 }
    );
  }
  const { payload, flags } = parseDraftPayload(updated);
  return NextResponse.json({
    id: updated.id,
    kind: updated.kind,
    status: updated.status,
    payload,
    flags,
  });
}
