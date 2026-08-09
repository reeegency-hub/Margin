/**
 * Client Prisma forçant `restaurantId` sur les modèles tenant-scoped.
 * Toute nouvelle route métier doit préférer ce wrapper à `prisma.*` nu.
 *
 * Usage:
 *   const tdb = tenantScopedClient(session.user.restaurantId);
 *   const rows = await tdb.stockUnit.findMany({ where: { … } });
 */
import type { Prisma } from "@prisma/client";
import { prisma, type TenantDb } from "@/lib/db";

export function tenantScopedClient(
  restaurantId: string,
  db: TenantDb = prisma
) {
  if (!restaurantId) {
    throw new Error("tenantScopedClient: restaurantId requis");
  }

  return {
    restaurantId,

    stockUnit: {
      findFirst: (args?: Prisma.StockUnitFindFirstArgs) =>
        db.stockUnit.findFirst({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
      findMany: (args?: Prisma.StockUnitFindManyArgs) =>
        db.stockUnit.findMany({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
      count: (args?: Prisma.StockUnitCountArgs) =>
        db.stockUnit.count({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
      create: (args: Prisma.StockUnitCreateArgs) =>
        db.stockUnit.create({
          ...args,
          data: {
            ...(args.data as Prisma.StockUnitUncheckedCreateInput),
            restaurantId,
          },
        }),
      updateMany: (args: Prisma.StockUnitUpdateManyArgs) =>
        db.stockUnit.updateMany({
          ...args,
          where: { ...args.where, restaurantId },
        }),
      deleteMany: (args?: Prisma.StockUnitDeleteManyArgs) =>
        db.stockUnit.deleteMany({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
    },

    alert: {
      findFirst: (args?: Prisma.AlertFindFirstArgs) =>
        db.alert.findFirst({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
      findMany: (args?: Prisma.AlertFindManyArgs) =>
        db.alert.findMany({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
      updateMany: (args: Prisma.AlertUpdateManyArgs) =>
        db.alert.updateMany({
          ...args,
          where: { ...args.where, restaurantId },
        }),
      create: (args: Prisma.AlertCreateArgs) =>
        db.alert.create({
          ...args,
          data: {
            ...(args.data as Prisma.AlertUncheckedCreateInput),
            restaurantId,
          },
        }),
    },

    inventoryCount: {
      findFirst: (args?: Prisma.InventoryCountFindFirstArgs) =>
        db.inventoryCount.findFirst({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
      findMany: (args?: Prisma.InventoryCountFindManyArgs) =>
        db.inventoryCount.findMany({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
    },

    employee: {
      findFirst: (args?: Prisma.EmployeeFindFirstArgs) =>
        db.employee.findFirst({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
      findMany: (args?: Prisma.EmployeeFindManyArgs) =>
        db.employee.findMany({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
    },

    externalPosConnection: {
      findFirst: (args?: Prisma.ExternalPosConnectionFindFirstArgs) =>
        db.externalPosConnection.findFirst({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
      findMany: (args?: Prisma.ExternalPosConnectionFindManyArgs) =>
        db.externalPosConnection.findMany({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
    },

    llmProviderCredential: {
      findFirst: (args?: Prisma.LlmProviderCredentialFindFirstArgs) =>
        db.llmProviderCredential.findFirst({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
      findMany: (args?: Prisma.LlmProviderCredentialFindManyArgs) =>
        db.llmProviderCredential.findMany({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
    },

    assistantDraft: {
      findFirst: (args?: Prisma.AssistantDraftFindFirstArgs) =>
        db.assistantDraft.findFirst({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
    },
  };
}

export type TenantScopedClient = ReturnType<typeof tenantScopedClient>;
