/**
 * Client Prisma forçant `restaurantId` sur les modèles tenant-scoped.
 * Toute nouvelle route métier doit préférer ce wrapper à `prisma.*` nu.
 *
 * Usage:
 *   const tdb = tenantScopedClient(session.user.restaurantId);
 *   const rows = await tdb.ingredient.findMany({ where: { … } });
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

    ingredient: {
      findFirst: (args?: Prisma.IngredientFindFirstArgs) =>
        db.ingredient.findFirst({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
      findMany: (args?: Prisma.IngredientFindManyArgs) =>
        db.ingredient.findMany({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
      count: (args?: Prisma.IngredientCountArgs) =>
        db.ingredient.count({
          ...args,
          where: { ...args?.where, restaurantId },
        }),
      create: (args: Prisma.IngredientCreateArgs) =>
        db.ingredient.create({
          ...args,
          data: { ...args.data, restaurantId },
        }),
      updateMany: (args: Prisma.IngredientUpdateManyArgs) =>
        db.ingredient.updateMany({
          ...args,
          where: { ...args.where, restaurantId },
        }),
      deleteMany: (args?: Prisma.IngredientDeleteManyArgs) =>
        db.ingredient.deleteMany({
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
          data: { ...args.data, restaurantId },
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
