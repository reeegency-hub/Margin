import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAmbassador } from "@/lib/partner-auth";
import { REFERRAL_STATUS_LABEL } from "@/lib/crm/activity";
import { listPartnerStores } from "@/lib/partner-store";

export default async function PartnerStoresPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");
  const params = await searchParams;

  const stores = await listPartnerStores(me.id);

  return (
    <main className="partner__main">
      <div className="partner-page-head partner-card">
        <div className="partner-row" style={{ border: 0, padding: 0 }}>
          <div>
            <p className="brand-eyebrow">Espace ambassadeur</p>
            <h1>Magasins</h1>
            <p className="partner-muted">
              Créez et configurez les commerces que vous amenez.
            </p>
          </div>
          <Link href="/partner/stores/new" className="partner-btn partner-btn--link">
            + Nouveau magasin
          </Link>
        </div>
      </div>

      {params.error === "access" ? (
        <p className="flash flash-warn">Accès refusé à ce magasin.</p>
      ) : null}

      {!stores.length ? (
        <div className="partner-card">
          <p className="partner-muted">
            Aucun magasin pour l&apos;instant. Créez le premier compte client.
          </p>
          <Link href="/partner/stores/new" className="partner-btn partner-btn--link">
            Créer un magasin
          </Link>
        </div>
      ) : (
        stores
          .filter((row): row is typeof row & { restaurant: NonNullable<typeof row.restaurant> } =>
            row.restaurant != null
          )
          .map(({ restaurant: s, commissionPercent, status }) => (
          <Link
            key={s.id}
            href={`/partner/stores/${s.id}`}
            className="partner-card partner-store-link"
          >
            <div className="partner-row" style={{ border: 0, padding: 0 }}>
              <div>
                <strong>{s.name}</strong>
                <p className="partner-muted">
                  {REFERRAL_STATUS_LABEL[status as keyof typeof REFERRAL_STATUS_LABEL] ?? status}
                  {" · "}
                  {s.users[0]?.email ?? "—"} · {s._count.products} produits
                </p>
              </div>
              <div className="partner-muted partner-store-link__meta">
                {s.onboardingCompletedAt ? "Onboardé" : "Setup en cours"} ·{" "}
                {commissionPercent} %
              </div>
            </div>
          </Link>
        ))
      )}
    </main>
  );
}
