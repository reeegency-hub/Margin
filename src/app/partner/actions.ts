"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import {
  clearPartnerCookie,
  requireAmbassador,
  setPartnerCookie,
} from "@/lib/partner-auth";
import { revalidatePath } from "next/cache";

const STATUSES = ["new", "contacted", "follow_up", "won", "lost"] as const;

export async function partnerLoginAction(formData: FormData) {
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  if (!email || !password) {
    redirect("/partner/login?error=missing");
  }

  const ambassador = await prisma.ambassador.findUnique({ where: { email } });
  if (!ambassador?.active) {
    redirect("/partner/login?error=invalid");
  }
  const ok = await bcrypt.compare(password, ambassador.passwordHash);
  if (!ok) {
    redirect("/partner/login?error=invalid");
  }

  await setPartnerCookie(ambassador);
  redirect("/partner");
}

export async function partnerLogoutAction() {
  await clearPartnerCookie();
  redirect("/partner/login");
}

export async function createProspectAction(formData: FormData) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const contactName = String(formData.get("contactName") || "").trim();
  const businessName = String(formData.get("businessName") || "").trim();
  if (!contactName || !businessName) {
    redirect("/partner/prospects?error=missing");
  }

  const follow = String(formData.get("nextFollowUpAt") || "").trim();
  await prisma.prospect.create({
    data: {
      ambassadorId: me.id,
      contactName,
      businessName,
      city: String(formData.get("city") || "").trim() || null,
      phone: String(formData.get("phone") || "").trim() || null,
      email: String(formData.get("email") || "").trim().toLowerCase() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      nextFollowUpAt: follow ? new Date(follow) : null,
    },
  });
  revalidatePath("/partner");
  revalidatePath("/partner/prospects");
  revalidatePath("/partner/agenda");
  redirect("/partner/prospects?ok=1");
}

export async function updateProspectStatusAction(formData: FormData) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    redirect("/partner/prospects?error=status");
  }

  await prisma.prospect.updateMany({
    where: { id, ambassadorId: me.id },
    data: { status },
  });
  revalidatePath("/partner");
  revalidatePath("/partner/prospects");
  revalidatePath("/partner/agenda");
}

export async function deleteProspectAction(formData: FormData) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const id = String(formData.get("id") || "");
  if (!id) redirect("/partner/prospects");

  await prisma.prospect.deleteMany({
    where: { id, ambassadorId: me.id },
  });
  revalidatePath("/partner");
  revalidatePath("/partner/prospects");
  revalidatePath("/partner/agenda");
}
