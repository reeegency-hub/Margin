import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAmbassador } from "@/lib/partner-auth";
import { prisma } from "@/lib/db";
import { euro } from "@/lib/dashboard";
import { absoluteAmbassadorSignupUrl } from "@/lib/ambassador-referral";
import { ensureAmbassadorReferralCode } from "@/lib/ambassador-referral-code";
import { PartnerReferralCard } from "../PartnerReferralCard";

export default async function PartnerDashboardPage() {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const referralCode = await ensureAmbassadorReferralCode(me.id, me.name);
  const signupUrl = absoluteAmbassadorSignupUrl(referralCode);

  const [referrals, prospects] = await Promise.all([
    prisma.ambassadorReferral.findMany({
      where: { ambassadorId: me.id },
      include: {
        restaurant: {
          select: {
            id: true,
            name: true,
            stripeStatus: true,
            active: true,
            lastInvoiceAmountCents: true,
            lastInvoiceAt: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.prospect.findMany({
      where: { ambassadorId: me.id },
      select: { status: true },
    }),
  ]);

  const byStatus = prospects.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const activeShops = referrals.filter(
    (r) => r.restaurant.active && r.restaurant.stripeStatus === "active"
  ).length;

  let commissionCents = 0;
  for (const r of referrals) {
    const amt = r.restaurant.lastInvoiceAmountCents ?? 0;
    if (amt > 0) {
      commissionCents += Math.round((amt * r.commissionPercent) / 100);
    }
  }

  return (
    <main className="partner__main">
      <div className="partner-page-head partner-card partner-hero">
        <p className="brand-eyebrow">Espace ambassadeur</p>
        <h1>Bonjour {me.name}</h1>
        <p className="partner-muted">
          Suivez vos prospects, onboarder vos magasins et votre commission.
        </p>
      </div>

      <PartnerReferralCard code={referralCode} signupUrl={signupUrl} />

      <div className="partner-shortcuts">
        <Link href="/partner/stores/new" className="partner-shortcut">
          <strong>+ Nouveau magasin</strong>
          <span>Créer un compte client et l&apos;onboarder</span>
        </Link>
        <Link href="/partner/stores" className="partner-shortcut">
          <strong>Magasins</strong>
          <span>Configurer catalogue, caisse, accès client</span>
        </Link>
        <Link href="/partner/prospects" className="partner-shortcut">
          <strong>Prospects</strong>
          <span>Ajouter les commerces contactés (cold call / mail)</span>
        </Link>
        <Link href="/partner/agenda" className="partner-shortcut">
          <strong>Agenda</strong>
          <span>Voir les relances du jour et celles en retard</span>
        </Link>
      </div>

      <div className="partner-stats">
        <div className="partner-stat">
          <span>Magasins actifs</span>
          <strong>{activeShops}</strong>
        </div>
        <div className="partner-stat">
          <span>Apportés</span>
          <strong>{referrals.length}</strong>
        </div>
        <div className="partner-stat">
          <span>Prospects</span>
          <strong>{prospects.length}</strong>
        </div>
        <div className="partner-stat">
          <span>Commission estimée</span>
          <strong>{euro(commissionCents / 100)}</strong>
        </div>
      </div>

      <div className="partner-card">
        <h2>Prospects par statut</h2>
        <p className="partner-muted">
          Nouveau {byStatus.new ?? 0} · Contacté {byStatus.contacted ?? 0} · Relance{" "}
          {byStatus.follow_up ?? 0} · Gagné {byStatus.won ?? 0} · Perdu{" "}
          {byStatus.lost ?? 0}
        </p>
      </div>

      <div className="partner-card">
        <h2>Magasins apportés</h2>
        {!referrals.length ? (
          <p className="partner-muted">
            Aucun magasin lié. Le fondateur lie un pilote avec{" "}
            <code>link-ambassador-referral.ts</code>.
          </p>
        ) : (
          referrals.map((r) => (
            <div key={r.id} className="partner-row">
              <div>
                <strong>{r.restaurant.name}</strong>
                <p className="partner-muted">
                  {r.restaurant.stripeStatus ?? "none"} · {r.commissionPercent} %
                </p>
              </div>
              <div className="partner-muted">
                {r.restaurant.lastInvoiceAmountCents
                  ? euro(r.restaurant.lastInvoiceAmountCents / 100)
                  : "—"}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
