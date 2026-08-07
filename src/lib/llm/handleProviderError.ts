import { prisma } from "@/lib/db";

export async function logCredentialEvent(input: {
  credentialId: string;
  eventType:
    | "created"
    | "validated"
    | "validation_failed"
    | "revoked"
    | "used";
  actorId?: string | null;
}) {
  await prisma.llmProviderCredentialEvent.create({
    data: {
      credentialId: input.credentialId,
      eventType: input.eventType,
      actorId: input.actorId || null,
    },
  });
}

export async function handleProviderError(
  cred: { id: string },
  err: unknown
): Promise<void> {
  const status = extractHttpStatus(err);
  // Seul 401/403 = clé cassée. 429 / 5xx ne marquent PAS invalid.
  if (status !== 401 && status !== 403) return;

  await prisma.llmProviderCredential.update({
    where: { id: cred.id },
    data: {
      status: "invalid",
      lastError: `Provider a renvoyé ${status}`,
    },
  });
  await logCredentialEvent({
    credentialId: cred.id,
    eventType: "validation_failed",
  });
}

export function extractHttpStatus(err: unknown): number | null {
  if (!err || typeof err !== "object") return null;
  const e = err as {
    status?: number;
    statusCode?: number;
    response?: { status?: number };
  };
  if (typeof e.status === "number") return e.status;
  if (typeof e.statusCode === "number") return e.statusCode;
  if (typeof e.response?.status === "number") return e.response.status;
  return null;
}
