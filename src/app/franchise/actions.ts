"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/session";
import {
  assertSameNetwork,
  createSatelliteStore,
  ensureFranchiseNetwork,
  userCanAccessRestaurant,
} from "@/lib/franchise-network";

export async function requireFranchiseSession() {
  const session = await requireSession();
  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.user.restaurantId },
    select: { plan: true, networkId: true, name: true },
  });
  if (!restaurant) redirect("/login?error=session");

  let networkId = restaurant.networkId;
  if (restaurant.plan === "reseau" && !networkId) {
    const ensured = await ensureFranchiseNetwork(session.user.restaurantId);
    networkId = ensured.networkId;
  }
  if (!networkId || restaurant.plan !== "reseau") {
    redirect("/");
  }

  return {
    ...session,
    user: {
      ...session.user,
      plan: restaurant.plan,
      networkId,
      restaurantName: restaurant.name,
    },
  };
}

/** Active une boutique du réseau (home store + JWT via re-login soft). */
export async function switchFranchiseStoreAction(
  restaurantId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const session = await requireFranchiseSession();
  const targetId = String(restaurantId || "").trim();
  if (!targetId) return { ok: false, error: "Boutique invalide." };

  const allowed = await userCanAccessRestaurant(session.user.id, targetId);
  if (!allowed) return { ok: false, error: "Accès refusé à cette boutique." };

  const same = await assertSameNetwork(
    session.user.restaurantId,
    targetId
  );
  if (!same) {
    // Première boutique du network : home peut déjà être dans le network
    const target = await prisma.restaurant.findUnique({
      where: { id: targetId },
      select: { networkId: true },
    });
    if (target?.networkId !== session.user.networkId) {
      return { ok: false, error: "Boutique hors réseau." };
    }
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { restaurantId: targetId },
  });

  revalidatePath("/franchise");
  return { ok: true };
}

export async function createFranchiseStoreAction(formData: FormData) {
  const session = await requireFranchiseSession();
  const name = String(formData.get("name") || "").trim();
  const whatsapp = String(formData.get("whatsapp") || "").trim() || null;

  const result = await createSatelliteStore({
    networkId: session.user.networkId!,
    name,
    ownerUserId: session.user.id,
    whatsappTo: whatsapp,
  });

  if (!result.ok) {
    redirect(
      `/franchise/stores/new?error=${encodeURIComponent(result.error)}`
    );
  }

  revalidatePath("/franchise");
  redirect(`/franchise/stores/${result.restaurantId}?created=1`);
}

/** Active + redirect ops stock */
export async function activateFranchiseStoreAndRedirect(restaurantId: string) {
  const result = await switchFranchiseStoreAction(restaurantId);
  if (!result.ok) {
    redirect(
      `/franchise/stores/${restaurantId}?error=${encodeURIComponent(result.error)}`
    );
  }
  redirect(`/franchise/s/${restaurantId}/stock`);
}

export async function activateFranchiseStoreFormAction(formData: FormData) {
  const restaurantId = String(formData.get("restaurantId") || "").trim();
  await activateFranchiseStoreAndRedirect(restaurantId);
}

export async function updateFranchiseWhatsAppAction(formData: FormData) {
  const session = await requireFranchiseSession();
  const raw = String(formData.get("whatsappTo") || "").trim();
  const whatsappTo = raw
    ? raw.replace(/^whatsapp:/i, "").replace(/\s/g, "")
    : null;
  const rid = session.user.restaurantId;

  if (whatsappTo) {
    const taken = await prisma.restaurant.findFirst({
      where: {
        whatsappTo,
        NOT: { id: rid },
      },
      select: { id: true },
    });
    if (taken) {
      redirect(`/franchise/s/${rid}/settings?error=whatsapp_taken`);
    }
  }

  try {
    await prisma.restaurant.update({
      where: { id: rid },
      data: { whatsappTo },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Unique constraint|P2002/i.test(msg)) {
      redirect(`/franchise/s/${rid}/settings?error=whatsapp_taken`);
    }
    throw e;
  }
  revalidatePath(`/franchise/s/${rid}/settings`);
  redirect(`/franchise/s/${rid}/settings?saved=1`);
}

export async function franchiseLogoutAction() {
  redirect("/api/auth/signout?callbackUrl=/login");
}

export async function getFranchiseJwtHint() {
  const session = await getServerSession(authOptions);
  return {
    restaurantId: session?.user?.restaurantId ?? null,
    networkId: session?.user?.networkId ?? null,
    plan: session?.user?.plan ?? null,
  };
}
