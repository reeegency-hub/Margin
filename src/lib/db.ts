import { Prisma, PrismaClient } from "@prisma/client";
import type { TenantId } from "@/lib/tenant";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export type TenantDb = Prisma.TransactionClient | PrismaClient;

function isPostgresUrl(url: string) {
  return url.startsWith("postgres") || url.includes("supabase");
}

/**
 * Pose `app.tenant_id` **dans une transaction** (même connexion pooler).
 * No-op SQLite — isolation applicative via restaurantId.
 */
export async function withTenantRls<T>(
  tenantId: TenantId,
  fn: (db: TenantDb) => Promise<T>
): Promise<T> {
  const provider = process.env.DATABASE_URL || "";
  if (!isPostgresUrl(provider)) {
    return fn(prisma);
  }

  return prisma.$transaction(async (tx) => {
    try {
      // is_local=true OK : durée = transaction courante (même connexion)
      await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
    } catch (err) {
      console.warn("[tenant-rls] set_config skipped:", err);
    }
    return fn(tx);
  });
}

/** Exécute `fn` dans une tx si `db` est le client racine ; sinon réutilise la tx courante. */
export async function runTenantTx<T>(
  db: TenantDb,
  fn: (tx: TenantDb) => Promise<T>
): Promise<T> {
  if (
    "$transaction" in db &&
    typeof (db as PrismaClient).$transaction === "function"
  ) {
    return (db as PrismaClient).$transaction((tx) => fn(tx));
  }
  return fn(db);
}
