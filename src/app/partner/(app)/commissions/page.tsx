import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAmbassador } from "@/lib/partner-auth";
import { euro } from "@/lib/dashboard";
import {
  getAmbassadorRewardSummary,
  REWARD_STATUS_LABEL,
} from "@/lib/crm/rewards";

export default async function PartnerCommissionsPage() {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const { events, totals } = await getAmbassadorRewardSummary(me.id);

  return (
    <main className="partner__main">
      <div className="partner-page-head">
        <p className="brand-eyebrow">Espace ambassadeur</p>
        <h1>Commissions</h1>
        <p className="partner-muted">
          Historique des commissions générées à chaque facture payée par vos
          filleuls.
        </p>
      </div>

      <div className="partner-stats">
        <div className="partner-stat">
          <span>Total gagné</span>
          <strong>{euro(totals.earnedCents / 100)}</strong>
        </div>
        <div className="partner-stat">
          <span>Validées</span>
          <strong>{euro(totals.validatedCents / 100)}</strong>
        </div>
        <div className="partner-stat">
          <span>Versées</span>
          <strong>{euro(totals.paidCents / 100)}</strong>
        </div>
        <div className="partner-stat">
          <span>Événements</span>
          <strong>{totals.count}</strong>
        </div>
      </div>

      <div className="partner-card">
        <h2>Historique</h2>
        {!events.length ? (
          <p className="partner-muted">
            Aucune commission pour l&apos;instant. Elle apparaît dès la première
            facture payée d&apos;un magasin apporté.
          </p>
        ) : (
          events.map((e) => (
            <div key={e.id} className="partner-row">
              <div>
                <strong>{e.restaurant.name}</strong>
                <p className="partner-muted">
                  {e.earnedAt.toLocaleDateString("fr-FR")} · Facture{" "}
                  {euro(e.invoiceAmountCents / 100)} · {e.commissionPercent} %
                </p>
              </div>
              <div className="partner-row__end">
                <strong>{euro(e.commissionCents / 100)}</strong>
                <p className="partner-muted">
                  {REWARD_STATUS_LABEL[e.status as keyof typeof REWARD_STATUS_LABEL] ??
                    e.status}
                </p>
              </div>
            </div>
          ))
        )}
      </div>

      <p className="partner-muted">
        Les commissions sont calculées à chaque paiement Stripe réussi. Le
        versement est traité manuellement par Margin — contactez-nous pour le
        règlement.
      </p>

      <Link href="/partner/stores" className="partner-btn partner-btn--link">
        Voir mes magasins
      </Link>
    </main>
  );
}
