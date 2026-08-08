/**
 * Autorisation par rôle DB (User.role) + fallback email founder (migration).
 */
import { getServerSession } from "next-auth";
import type { Prisma, User, UserRole } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isAdminEmail } from "@/lib/admin";

export class UnauthorizedError extends Error {
  constructor(message = "Non authentifié") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "Accès refusé") {
    super(message);
    this.name = "ForbiddenError";
  }
}

const ROLE_RANK: Record<UserRole, number> = {
  MEMBER: 0,
  MANAGER: 1,
  FOUNDER: 2,
};

export async function requireRole(minRole: UserRole): Promise<User> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new UnauthorizedError();
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
  });
  if (!user) throw new UnauthorizedError();

  // Transition : emails founder historiques traités comme FOUNDER
  // même avant backfill `role`.
  const effectiveRole: UserRole =
    user.role === "FOUNDER" || isAdminEmail(user.email)
      ? "FOUNDER"
      : user.role;

  if (ROLE_RANK[effectiveRole] < ROLE_RANK[minRole]) {
    throw new ForbiddenError();
  }

  return user;
}

export async function writeAdminAudit(opts: {
  actorId: string;
  action: string;
  targetId?: string | null;
  metadata?: Record<string, unknown> | null;
}): Promise<void> {
  // Strip éventuels secrets par clé
  const meta = opts.metadata
    ? Object.fromEntries(
        Object.entries(opts.metadata).filter(
          ([k]) =>
            !/secret|password|token|apiKey|authorization|credential/i.test(k)
        )
      )
    : undefined;

  await prisma.adminAuditLog.create({
    data: {
      actorId: opts.actorId,
      action: opts.action,
      targetId: opts.targetId ?? null,
      metadata:
        meta === undefined
          ? undefined
          : (meta as Prisma.InputJsonValue),
    },
  });
}
