import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  activateFranchiseStoreFormAction,
  requireFranchiseSession,
} from "../../../actions";
import { userCanAccessRestaurant } from "@/lib/franchise-network";

export default async function FranchiseStoreDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; error?: string }>;
}) {
  const session = await requireFranchiseSession();
  const { id } = await params;
  const q = await searchParams;

  const allowed = await userCanAccessRestaurant(session.user.id, id);
  if (!allowed) notFound();

  const store = await prisma.restaurant.findFirst({
    where: { id, networkId: session.user.networkId! },
    select: {
      id: true,
      name: true,
      active: true,
      onboardingCompletedAt: true,
      whatsappTo: true,
      _count: {
        select: {
          externalPosConnections: true,
          stockUnits: true,
          employees: true,
        },
      },
    },
  });
  if (!store) notFound();

  const isActive = store.id === session.user.restaurantId;

  return (
    <div className="franchise-page">
      <Link href="/franchise/stores" className="franchise-back">
        ← Boutiques
      </Link>
      <header className="franchise-page-head">
        <p className="franchise-page-head__eyebrow">Boutique</p>
        <h1>{store.name}</h1>
        <p className="franchise-page-head__lead">
          {store._count.stockUnits} produits · {store._count.employees}{" "}
          employés ·{" "}
          {store._count.externalPosConnections > 0
            ? "Caisse branchée"
            : "Caisse à brancher"}
        </p>
      </header>

      {q.created ? (
        <p className="franchise-form__ok">Boutique créée.</p>
      ) : null}
      {q.error ? (
        <p className="franchise-form__error" role="alert">
          {q.error}
        </p>
      ) : null}

      <div className="franchise-inline-actions" style={{ marginTop: "1.25rem" }}>
        {isActive ? (
          <Link
            href={`/franchise/s/${store.id}/stock`}
            className="franchise-btn"
          >
            Ouvrir le stock
          </Link>
        ) : (
          <form action={activateFranchiseStoreFormAction}>
            <input type="hidden" name="restaurantId" value={store.id} />
            <button type="submit" className="franchise-btn">
              Activer cette boutique
            </button>
          </form>
        )}
        <Link
          href={`/franchise/s/${store.id}/settings`}
          className="franchise-btn franchise-btn--ghost"
        >
          Réglages
        </Link>
      </div>
    </div>
  );
}
