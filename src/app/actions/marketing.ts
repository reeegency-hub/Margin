"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdminSession } from "@/lib/admin";
import {
  COLD_SEQUENCE,
  scoreInfluencerFit,
} from "@/lib/marketing-playbook";

async function assertAdmin() {
  const session = await requireAdminSession();
  if (!session) redirect("/login?error=admin");
  return session;
}

function revalidateMarketing() {
  revalidatePath("/admin/marketing");
  revalidatePath("/admin");
}

export async function createProspectAction(formData: FormData) {
  await assertAdmin();
  const email = String(formData.get("email") || "")
    .trim()
    .toLowerCase();
  const contactName = String(formData.get("contactName") || "").trim() || null;
  const businessName =
    String(formData.get("businessName") || "").trim() || null;
  const city = String(formData.get("city") || "").trim() || null;
  const segment = String(formData.get("segment") || "epicerie").trim();
  const posVendor = String(formData.get("posVendor") || "").trim() || null;
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false as const, error: "Email prospect invalide." };
  }

  try {
    await prisma.marketingProspect.create({
      data: {
        email,
        contactName,
        businessName,
        city,
        segment,
        posVendor,
        notes,
        status: "new",
        source: "manual",
      },
    });
  } catch {
    return { ok: false as const, error: "Cet email est déjà dans le pipeline." };
  }

  revalidateMarketing();
  return { ok: true as const };
}

export async function updateProspectStatusAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !status) return { ok: false as const, error: "Données manquantes." };

  await prisma.marketingProspect.update({
    where: { id },
    data: { status },
  });
  revalidateMarketing();
  return { ok: true as const };
}

export async function advanceProspectSequenceAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return { ok: false as const, error: "ID manquant." };

  const p = await prisma.marketingProspect.findUnique({ where: { id } });
  if (!p) return { ok: false as const, error: "Prospect introuvable." };

  const nextStep = Math.min(3, (p.sequenceStep || 0) + 1);
  const stepMeta = COLD_SEQUENCE.find((s) => s.step === nextStep);
  const delay = stepMeta?.delayDays ?? 3;
  const nextFollowUpAt =
    nextStep < 3
      ? new Date(Date.now() + Math.max(delay, 3) * 24 * 60 * 60 * 1000)
      : null;

  await prisma.marketingProspect.update({
    where: { id },
    data: {
      sequenceStep: nextStep,
      status: nextStep >= 3 && p.status === "sequenced" ? "sequenced" : "sequenced",
      lastContactedAt: new Date(),
      nextFollowUpAt,
    },
  });
  revalidateMarketing();
  return { ok: true as const, step: nextStep };
}

export async function deleteProspectAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.marketingProspect.delete({ where: { id } }).catch(() => null);
  revalidateMarketing();
}

export async function createInfluencerAction(formData: FormData) {
  await assertAdmin();
  const handle = String(formData.get("handle") || "")
    .trim()
    .replace(/^@/, "");
  const displayName =
    String(formData.get("displayName") || "").trim() || null;
  const platform = String(formData.get("platform") || "instagram").trim();
  const profileUrl =
    String(formData.get("profileUrl") || "").trim() || null;
  const email = String(formData.get("email") || "").trim().toLowerCase() || null;
  const city = String(formData.get("city") || "").trim() || null;
  const niche = String(formData.get("niche") || "retail").trim();
  const followers = Math.max(
    0,
    parseInt(String(formData.get("followers") || "0"), 10) || 0
  );
  const engagementRaw = String(formData.get("engagementPct") || "").trim();
  const engagementPct = engagementRaw
    ? Math.max(0, parseFloat(engagementRaw.replace(",", ".")) || 0)
    : null;
  const notes = String(formData.get("notes") || "").trim() || null;
  const dealType = String(formData.get("dealType") || "").trim() || null;

  if (!handle) return { ok: false as const, error: "Pseudo requis." };

  const fitScore = scoreInfluencerFit({
    followers,
    engagementPct,
    niche,
    platform,
    hasEmail: Boolean(email),
  });

  try {
    await prisma.marketingInfluencer.create({
      data: {
        handle,
        displayName,
        platform,
        profileUrl,
        email,
        city,
        niche,
        followers,
        engagementPct,
        fitScore,
        notes,
        dealType,
        status: "research",
      },
    });
  } catch {
    return {
      ok: false as const,
      error: "Ce compte existe déjà sur cette plateforme.",
    };
  }

  revalidateMarketing();
  return { ok: true as const, fitScore };
}

export async function updateInfluencerStatusAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!id || !status) return { ok: false as const, error: "Données manquantes." };

  await prisma.marketingInfluencer.update({
    where: { id },
    data: {
      status,
      lastContactedAt:
        status === "contacted" || status === "negotiating"
          ? new Date()
          : undefined,
    },
  });
  revalidateMarketing();
  return { ok: true as const };
}

export async function deleteInfluencerAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return;
  await prisma.marketingInfluencer.delete({ where: { id } }).catch(() => null);
  revalidateMarketing();
}

export async function rescoreInfluencerAction(formData: FormData) {
  await assertAdmin();
  const id = String(formData.get("id") || "");
  if (!id) return { ok: false as const, error: "ID manquant." };
  const row = await prisma.marketingInfluencer.findUnique({ where: { id } });
  if (!row) return { ok: false as const, error: "Introuvable." };

  const fitScore = scoreInfluencerFit({
    followers: row.followers,
    engagementPct: row.engagementPct,
    niche: row.niche,
    platform: row.platform,
    hasEmail: Boolean(row.email),
  });
  await prisma.marketingInfluencer.update({
    where: { id },
    data: { fitScore },
  });
  revalidateMarketing();
  return { ok: true as const, fitScore };
}
