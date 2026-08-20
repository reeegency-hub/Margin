import Link from "next/link";
import { createFranchiseStoreAction } from "../../../actions";
import { requireFranchiseSession } from "../../../actions";
import { listNetworkStores } from "@/lib/franchise-network";
import { redirect } from "next/navigation";

export default async function FranchiseNewStorePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireFranchiseSession();
  const stores = await listNetworkStores(session.user.networkId!);
  if (stores.length >= 3) {
    redirect("/franchise/stores?error=limit");
  }
  const params = await searchParams;

  return (
    <div className="franchise-page">
      <Link href="/franchise/stores" className="franchise-back">
        ← Boutiques
      </Link>
      <header className="franchise-page-head">
        <p className="franchise-page-head__eyebrow">Nouvelle boutique</p>
        <h1>Ajouter un commerce</h1>
        <p className="franchise-page-head__lead">
          Satellite du réseau — facturation sur le HQ Franchise.
        </p>
      </header>

      {params.error ? (
        <p className="franchise-form__error" role="alert">
          {params.error}
        </p>
      ) : null}

      <form action={createFranchiseStoreAction} className="franchise-form">
        <label className="franchise-field">
          <span>Nom de la boutique</span>
          <input name="name" required placeholder="Ex. Margin Bastille" />
        </label>
        <label className="franchise-field">
          <span>WhatsApp (optionnel)</span>
          <input name="whatsapp" placeholder="+33…" />
        </label>
        <button type="submit" className="franchise-btn">
          Créer la boutique
        </button>
      </form>
    </div>
  );
}
