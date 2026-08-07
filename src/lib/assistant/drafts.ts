import { addMilliseconds } from "date-fns";
import { prisma } from "@/lib/db";
import {
  DRAFT_TTL_MS,
  type AmbiguityFlag,
  type DraftKind,
  type DraftStatus,
} from "@/lib/assistant/schemas";

export async function createAssistantDraft(input: {
  restaurantId: string;
  userId?: string | null;
  kind: DraftKind;
  payload: unknown;
  flags?: AmbiguityFlag[];
  sourceFileName?: string | null;
  sourceFileId?: string | null;
  status?: DraftStatus;
}) {
  const expiresAt = addMilliseconds(new Date(), DRAFT_TTL_MS);
  return prisma.assistantDraft.create({
    data: {
      restaurantId: input.restaurantId,
      createdByUserId: input.userId || null,
      kind: input.kind,
      status: input.status || "preview",
      sourceFileName: input.sourceFileName || null,
      sourceFileId: input.sourceFileId || null,
      payloadJson: JSON.stringify(input.payload),
      flagsJson: JSON.stringify(input.flags || []),
      expiresAt,
    },
  });
}

export async function getAssistantDraft(
  restaurantId: string,
  draftId: string
) {
  const draft = await prisma.assistantDraft.findFirst({
    where: { id: draftId, restaurantId },
  });
  if (!draft) return null;
  if (
    draft.status !== "committed" &&
    draft.expiresAt.getTime() < Date.now()
  ) {
    if (draft.status !== "expired") {
      await prisma.assistantDraft.update({
        where: { id: draft.id },
        data: { status: "expired" },
      });
    }
    return { ...draft, status: "expired" as const };
  }
  return draft;
}

export function parseDraftPayload<T = unknown>(draft: {
  payloadJson: string;
  flagsJson: string;
}): { payload: T; flags: AmbiguityFlag[] } {
  let payload = {} as T;
  let flags: AmbiguityFlag[] = [];
  try {
    payload = JSON.parse(draft.payloadJson) as T;
  } catch {
    /* ignore */
  }
  try {
    flags = JSON.parse(draft.flagsJson || "[]") as AmbiguityFlag[];
  } catch {
    /* ignore */
  }
  return { payload, flags };
}

export async function updateDraftPayload(
  restaurantId: string,
  draftId: string,
  payload: unknown,
  flags?: AmbiguityFlag[]
) {
  const existing = await getAssistantDraft(restaurantId, draftId);
  if (!existing || existing.status === "expired") return null;
  if (existing.status === "committed") return null;
  return prisma.assistantDraft.update({
    where: { id: draftId },
    data: {
      payloadJson: JSON.stringify(payload),
      flagsJson: JSON.stringify(flags ?? JSON.parse(existing.flagsJson || "[]")),
      status: "preview",
    },
  });
}

export async function markDraftCommitted(
  restaurantId: string,
  draftId: string,
  commitId: string
) {
  return prisma.assistantDraft.updateMany({
    where: { id: draftId, restaurantId },
    data: {
      status: "committed",
      committedAt: new Date(),
      commitId,
    },
  });
}

export async function writeAssistantCommit(input: {
  restaurantId: string;
  draftId: string;
  kind: string;
  userId?: string | null;
  result: unknown;
}) {
  return prisma.assistantCommit.create({
    data: {
      restaurantId: input.restaurantId,
      draftId: input.draftId,
      kind: input.kind,
      createdByUserId: input.userId || null,
      resultJson: JSON.stringify(input.result),
    },
  });
}

export function hasBlockingFlags(flags: AmbiguityFlag[]): boolean {
  const blocking = new Set([
    "missing_name_column",
    "shift_overlap",
    "bad_phone",
    "empty",
  ]);
  return flags.some((f) => blocking.has(f.code));
}
