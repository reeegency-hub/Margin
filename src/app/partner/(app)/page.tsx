import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAmbassador } from "@/lib/partner-auth";
import { prisma } from "@/lib/db";
import { euro } from "@/lib/dashboard";
import { absoluteAmbassadorSignupUrl } from "@/lib/ambassador-referral";
import { ensureAmbassadorReferralCode } from "@/lib/ambassador-referral-code";
import { REFERRAL_STATUS_LABEL } from "@/lib/crm/activity";
import { PartnerReferralCard } from "@/app/partner/PartnerReferralCard";
import { getAmbassadorRewardSummary } from "@/lib/crm/rewards";
import { pricingSummaryForAmbassador } from "@/lib/ambassador-pricing";

export default async function PartnerDashboardPage() {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const referralCode = await ensureAmbassadorReferralCode(me.id, me.name);
  const signupUrl = absoluteAmbassadorSignupUrl(referralCode);
  const pricingSummary = pricingSummaryForAmbassador({
    referralCode,
    name: me.name,
  });

  const [referrals, prospects, rewards] = await Promise.all([
    prisma.referral.findMany({
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
    getAmbassadorRewardSummary(me.id),
  ]);

  const byStatus = prospects.reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const activeShops = referrals.filter(
    (r) =>
      r.restaurant?.active && r.restaurant.stripeStatus === "active"
  ).length;

  let commissionCents = 0;
  for (const r of referrals) {
    const amt = r.restaurant?.lastInvoiceAmountCents ?? 0;
    if (amt > 0) {
      commissionCents += Math.round((amt * r.commissionPercent) / 100);
    }
  }

  return (
    <main className="partner__main">
      <header className="partner-page-head">
        <p className="brand-eyebrow">Tableau</p>
        <h1>
          Bonjour <em>{me.name}</em>
        </h1>
        <p className="partner-muted partner-page-head__lead">
          Onboardez des commerces, suivez les commissions, relancez au bon
          moment.
        </p>
      </header>

      <PartnerReferralCard
        code={referralCode}
        signupUrl={signupUrl}
        pricingSummary={pricingSummary}
      />

      <div className="partner-shortcuts" aria-label="Raccourcis">
        <Link href="/partner/stores/new" className="partner-shortcut partner-shortcut--accent">
          <strong>Nouveau magasin</strong>
          <span>Créer un compte client et l&apos;onboarder</span>
        </Link>
        <Link href="/partner/stores" className="partner-shortcut">
          <strong>Magasins</strong>
          <span>Catalogue, caisse, accès client</span>
        </Link>
        <Link href="/partner/commissions" className="partner-shortcut">
          <strong>Commissions</strong>
          <span>{euro(rewards.totals.earnedCents / 100)} gagnés</span>
        </Link>
        <Link href="/partner/prospects" className="partner-shortcut">
          <strong>Prospects</strong>
          <span>Commerces contactés</span>
        </Link>
        <Link href="/partner/agenda" className="partner-shortcut">
          <strong>Agenda</strong>
          <span>Relances du jour</span>
        </Link>
      </div>

      <div className="partner-stats" aria-label="Indicateurs">
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
          <span>Commission</span>
          <strong>{euro(rewards.totals.earnedCents / 100)}</strong>
        </div>
        <div className="partner-stat">
          <span>Dernière facture</span>
          <strong>{euro(commissionCents / 100)}</strong>
        </div>
      </div>

      <div className="partner-panel-grid">
        <section className="partner-card">
          <h2>Prospects par statut</h2>
          <ul className="partner-status-pills">
            <li>
              <span>Nouveau</span>
              <strong>{byStatus.new ?? 0}</strong>
            </li>
            <li>
              <span>Contacté</span>
              <strong>{byStatus.contacted ?? 0}</strong>
            </li>
            <li>
              <span>Relance</span>
              <strong>{byStatus.follow_up ?? 0}</strong>
            </li>
            <li>
              <span>Gagné</span>
              <strong>{byStatus.won ?? 0}</strong>
            </li>
            <li>
              <span>Perdu</span>
              <strong>{byStatus.lost ?? 0}</strong>
            </li>
          </ul>
        </section>

        <section className="partner-card">
          <h2>Magasins apportés</h2>
          {!referrals.length ? (
            <p className="partner-muted">
              Aucun magasin lié pour l&apos;instant. Créez-en un ou partagez
              votre code.
            </p>
          ) : (
            referrals.map((r) => (
              <div key={r.id} className="partner-row">
                <div>
                  <strong className="partner-row__title">
                    {r.restaurant?.name ?? "—"}
                  </strong>
                  <p className="partner-muted">
                    {REFERRAL_STATUS_LABEL[
                      r.status as keyof typeof REFERRAL_STATUS_LABEL
                    ] ?? r.status}
                    {" · "}
                    {r.restaurant?.stripeStatus ?? "none"} · {r.commissionPercent}{" "}
                    %
                  </p>
                </div>
                <div className="partner-row__value">
                  {r.restaurant?.lastInvoiceAmountCents
                    ? euro(r.restaurant.lastInvoiceAmountCents / 100)
                    : "—"}
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </main>
  );
}
