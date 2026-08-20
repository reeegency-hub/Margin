"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireAmbassador } from "@/lib/partner-auth";
import { generateWebhookSecret } from "@/lib/credentials";
import { importRetailCatalogCsv } from "@/lib/retail-catalog-import";
import {
  createPartnerStore,
  requirePartnerStore,
} from "@/lib/partner-store";

function storePath(id: string, query?: string) {
  return `/partner/stores/${id}${query ? `?${query}` : ""}`;
}

export async function partnerCreateStoreAction(formData: FormData) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const name = String(formData.get("name") || "").trim();
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "").trim();
  const whatsapp = String(formData.get("whatsapp") || "").trim() || null;
  const skipOnboarding = String(formData.get("skipOnboarding") || "") === "1";

  if (!name || !email || !password || password.length < 8) {
    redirect("/partner/stores/new?error=missing");
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    redirect("/partner/stores/new?error=email");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const restaurant = await createPartnerStore({
    ambassadorId: me.id,
    name,
    email,
    passwordHash,
    whatsapp,
    skipOnboarding,
  });

  revalidatePath("/partner");
  revalidatePath("/partner/stores");
  redirect(storePath(restaurant.id, "created=1"));
}

export async function partnerUpdateStoreAction(formData: FormData) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const restaurantId = String(formData.get("restaurantId") || "");
  const ref = await requirePartnerStore(me.id, restaurantId);
  if (!ref?.restaurant) redirect("/partner/stores?error=access");
  const store = ref.restaurant;

  const name = String(formData.get("name") || "").trim();
  const whatsapp = String(formData.get("whatsapp") || "").trim() || null;
  const completeOnboarding =
    String(formData.get("completeOnboarding") || "") === "1";

  if (!name) redirect(storePath(restaurantId, "error=missing"));

  await prisma.restaurant.update({
    where: { id: restaurantId },
    data: {
      name,
      whatsappTo: whatsapp,
      ...(completeOnboarding
        ? {
            onboardingCompletedAt: new Date(),
            procurementMode: store.procurementMode ?? "mixed",
          }
        : {}),
    },
  });

  if (completeOnboarding) {
    const { syncReferralStatusForRestaurant } = await import("@/lib/crm/activity");
    await syncReferralStatusForRestaurant(restaurantId);
  }

  revalidatePath(storePath(restaurantId));
  revalidatePath("/partner/stores");
  redirect(storePath(restaurantId, "saved=1"));
}

export async function partnerResetPasswordAction(formData: FormData) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const restaurantId = String(formData.get("restaurantId") || "");
  const password = String(formData.get("password") || "").trim();
  const ref = await requirePartnerStore(me.id, restaurantId);
  if (!ref?.restaurant) redirect("/partner/stores?error=access");
  const store = ref.restaurant;

  if (password.length < 8) {
    redirect(storePath(restaurantId, "error=password"));
  }

  const user = store.users[0];
  if (!user) redirect(storePath(restaurantId, "error=nouser"));

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await bcrypt.hash(password, 10),
      sessionVersion: { increment: 1 },
    },
  });

  redirect(storePath(restaurantId, "password=1"));
}

export async function partnerImportCatalogAction(formData: FormData) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const restaurantId = String(formData.get("restaurantId") || "");
  const csv = String(formData.get("csv") || "").trim();
  const ref = await requirePartnerStore(me.id, restaurantId);
  if (!ref?.restaurant) redirect("/partner/stores?error=access");

  if (!csv) redirect(storePath(restaurantId, "error=csv"));

  const result = await importRetailCatalogCsv(restaurantId, csv, prisma);
  revalidatePath(storePath(restaurantId));
  redirect(
    storePath(
      restaurantId,
      `import=1&created=${result.created}&updated=${result.updated}&skipped=${result.skipped}`
    )
  );
}

export async function partnerEnsurePosAction(formData: FormData) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const restaurantId = String(formData.get("restaurantId") || "");
  const ref = await requirePartnerStore(me.id, restaurantId);
  if (!ref?.restaurant) redirect("/partner/stores?error=access");
  const store = ref.restaurant;

  const existing = store.externalPosConnections[0];
  const secret = generateWebhookSecret();
  if (existing) {
    await prisma.externalPosConnection.update({
      where: { id: existing.id },
      data: {
        vendor: "generic",
        webhookSecret: secret,
        status: "PENDING",
        name: existing.name || "Caisse",
      },
    });
  } else {
    await prisma.externalPosConnection.create({
      data: {
        restaurantId,
        name: "Caisse principale",
        vendor: "generic",
        webhookSecret: secret,
        status: "PENDING",
      },
    });
  }

  revalidatePath(storePath(restaurantId));
  redirect(storePath(restaurantId, "pos=1"));
}

export async function partnerSeedTeamAction(formData: FormData) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const restaurantId = String(formData.get("restaurantId") || "");
  const ref = await requirePartnerStore(me.id, restaurantId);
  if (!ref?.restaurant) redirect("/partner/stores?error=access");

  const count = await prisma.employee.count({ where: { restaurantId } });
  if (count === 0) {
    await prisma.employee.createMany({
      data: [
        {
          restaurantId,
          name: "Caisse 1",
          role: "salle",
          hourlyRate: 12,
        },
        {
          restaurantId,
          name: "Rayon 1",
          role: "cuisine",
          hourlyRate: 13,
        },
      ],
    });
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { staffSalle: 1, staffCuisine: 1, staffLivreur: 0 },
    });
  }

  revalidatePath(storePath(restaurantId));
  redirect(storePath(restaurantId, "team=1"));
}
