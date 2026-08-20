import Link from "next/link";
import { listNetworkStores } from "@/lib/franchise-network";
import { requireFranchiseSession } from "../../actions";

export default async function FranchiseStoresPage() {
  const session = await requireFranchiseSession();
  const stores = await listNetworkStores(session.user.networkId!);

  return (
    <div className="franchise-page">
      <header className="franchise-page-head">
        <div className="franchise-page-head__row">
          <div>
            <p className="franchise-page-head__eyebrow">Réseau</p>
            <h1>Boutiques</h1>
            <p className="franchise-page-head__lead">
              Jusqu’à 3 commerces sur le plan Franchise.
            </p>
          </div>
          {stores.length < 3 ? (
            <Link href="/franchise/stores/new" className="franchise-btn">
              Nouvelle boutique
            </Link>
          ) : null}
        </div>
      </header>

      <ul className="franchise-store-list">
        {stores.map((s) => {
          const onboarded = Boolean(s.onboardingCompletedAt);
          const hasPos = s._count.externalPosConnections > 0;
          const hasWa = Boolean(s.whatsappTo);
          return (
            <li key={s.id}>
              <Link
                href={`/franchise/stores/${s.id}`}
                className="franchise-store-row"
              >
                <div>
                  <p className="franchise-store-row__name">{s.name}</p>
                  <p className="franchise-store-row__meta">
                    {onboarded ? "Onboardé" : "Onboarding à faire"}
                    {" · "}
                    {hasPos ? "Caisse branchée" : "Caisse à brancher"}
                    {" · "}
                    {hasWa ? "WhatsApp OK" : "WhatsApp manquant"}
                  </p>
                </div>
                <span
                  className={
                    s.id === session.user.restaurantId
                      ? "franchise-badge franchise-badge--ok"
                      : "franchise-badge"
                  }
                >
                  {s.id === session.user.restaurantId ? "Active" : "Ouvrir"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
