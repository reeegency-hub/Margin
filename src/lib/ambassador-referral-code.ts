import { prisma } from "@/lib/db";
import { codeFromAmbassador } from "@/lib/ambassador-referral";

/** Génère et persiste un code ambassadeur s’il manque (idempotent). */
export async function ensureAmbassadorReferralCode(
  ambassadorId: string,
  name: string
): Promise<string> {
  const existing = await prisma.ambassador.findUnique({
    where: { id: ambassadorId },
    select: { referralCode: true },
  });
  if (existing?.referralCode) return existing.referralCode;

  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate =
      attempt === 0
        ? codeFromAmbassador(name, ambassadorId)
        : `${codeFromAmbassador(name, ambassadorId)}${attempt}`;
    try {
      const updated = await prisma.ambassador.update({
        where: { id: ambassadorId },
        data: { referralCode: candidate },
        select: { referralCode: true },
      });
      return updated.referralCode!;
    } catch {
      // collision unique → retry
    }
  }

  const fallback = `AMB-${ambassadorId.slice(-8).toUpperCase()}`;
  const updated = await prisma.ambassador.update({
    where: { id: ambassadorId },
    data: { referralCode: fallback },
    select: { referralCode: true },
  });
  return updated.referralCode!;
}
