import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAmbassador } from "@/lib/partner-auth";
import { requirePartnerStore } from "@/lib/partner-store";
import {
  partnerEnsurePosAction,
  partnerImportCatalogAction,
  partnerResetPasswordAction,
  partnerSeedTeamAction,
  partnerUpdateStoreAction,
} from "../../../store-actions";

export default async function PartnerStorePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  const { id } = await params;
  const q = await searchParams;
  const ref = await requirePartnerStore(me.id, id);
  if (!ref?.restaurant) redirect("/partner/stores?error=access");

  const store = ref.restaurant;
  const user = store.users[0];
  const pos = store.externalPosConnections[0];
  const baseUrl = (
    process.env.NEXTAUTH_URL ||
    process.env.WEBHOOK_BASE_URL ||
    "https://margin-shop.vercel.app"
  ).replace(/\/$/, "");
  const loginUrl = `${baseUrl}/login`;
  const webhookUrl = pos ? `${baseUrl}/api/webhooks/pos/${pos.id}` : null;

  return (
    <main className="partner__main">
      <header className="partner-page-head">
        <Link href="/partner/stores" className="partner-back">
          ← Magasins
        </Link>
        <p className="brand-eyebrow">Fiche magasin</p>
        <h1>
          <em>{store.name}</em>
        </h1>
        <p className="partner-muted partner-page-head__lead">
          Onboarding · {store._count.products} produits · commission{" "}
          {ref.commissionPercent} %
        </p>
      </header>

      {q.created ? (
        <p className="flash">Magasin créé — terminez la configuration.</p>
      ) : null}
      {q.saved ? <p className="flash">Enregistré.</p> : null}
      {q.password ? <p className="flash">Mot de passe mis à jour.</p> : null}
      {q.pos ? (
        <p className="flash">Lien caisse prêt — copiez le webhook.</p>
      ) : null}
      {q.team ? <p className="flash">Équipe de base créée.</p> : null}
      {q.import ? (
        <p className="flash">
          Catalogue importé : +{q.created ?? 0} créés, {q.updated ?? 0} mis à
          jour.
        </p>
      ) : null}
      {q.error === "password" ? (
        <p className="flash flash-warn">Mot de passe trop court (8+).</p>
      ) : null}
      {q.error === "csv" ? (
        <p className="flash flash-warn">
          Collez un CSV avec en-tête Nom;Stock;Seuil;Unite;Prix
        </p>
      ) : null}

      <section className="partner-card">
        <div className="partner-step">
          <span className="partner-step__n">1</span>
          <h2 className="partner-step__title">Accès client</h2>
        </div>
        <p className="partner-muted">
          URL : <a href={loginUrl}>{loginUrl}</a>
          <br />
          Email : <strong>{user?.email ?? "—"}</strong>
        </p>
        <form action={partnerResetPasswordAction} className="partner-form">
          <input type="hidden" name="restaurantId" value={store.id} />
          <label>
            Nouveau mot de passe (8+)
            <input name="password" type="text" minLength={8} required />
          </label>
          <button type="submit" className="partner-btn">
            Réinitialiser le mot de passe
          </button>
        </form>
      </section>

      <form action={partnerUpdateStoreAction} className="partner-card partner-form">
        <input type="hidden" name="restaurantId" value={store.id} />
        <div className="partner-step">
          <span className="partner-step__n">2</span>
          <h2 className="partner-step__title">Identité & WhatsApp</h2>
        </div>
        <div className="partner-form-grid partner-form-grid--2">
          <label>
            Nom du commerce
            <input name="name" defaultValue={store.name} required />
          </label>
          <label>
            WhatsApp alertes stock
            <input
              name="whatsapp"
              defaultValue={store.whatsappTo ?? ""}
              placeholder="+336..."
            />
          </label>
        </div>
        {!store.onboardingCompletedAt ? (
          <label className="partner-check">
            <input type="checkbox" name="completeOnboarding" value="1" />
            Onboarding terminé (client peut aller sur l&apos;app)
          </label>
        ) : (
          <p className="partner-muted">Onboarding marqué terminé.</p>
        )}
        <button type="submit" className="partner-btn partner-btn--lime">
          Enregistrer
        </button>
      </form>

      <form
        action={partnerImportCatalogAction}
        className="partner-card partner-form"
      >
        <input type="hidden" name="restaurantId" value={store.id} />
        <div className="partner-step">
          <span className="partner-step__n">3</span>
          <h2 className="partner-step__title">Catalogue produits</h2>
        </div>
        <p className="partner-muted">
          Format : <code>Nom;Stock;Seuil;Unite;Prix</code> — ex.{" "}
          <code>Lait entier;12;6;L;1.20</code>
        </p>
        <textarea
          name="csv"
          rows={8}
          placeholder={
            "Nom;Stock;Seuil;Unite;Prix\nPain;20;5;u;1.50\nLait;12;6;L;1.20"
          }
        />
        <button type="submit" className="partner-btn">
          Importer le catalogue
        </button>
      </form>

      <section className="partner-card">
        <div className="partner-step">
          <span className="partner-step__n">4</span>
          <h2 className="partner-step__title">Caisse POS</h2>
        </div>
        {!pos ? (
          <p className="partner-muted">Pas encore de lien caisse.</p>
        ) : (
          <div className="partner-code-block">
            <p className="partner-muted">
              Webhook (secret visible une fois après régénération) :
            </p>
            <code>{webhookUrl}</code>
            {pos.webhookSecret ? (
              <>
                <p className="partner-muted" style={{ marginTop: 10 }}>
                  Secret :
                </p>
                <code>{pos.webhookSecret}</code>
              </>
            ) : null}
          </div>
        )}
        <form action={partnerEnsurePosAction}>
          <input type="hidden" name="restaurantId" value={store.id} />
          <button type="submit" className="partner-btn">
            {pos ? "Regénérer le lien caisse" : "Créer le lien caisse"}
          </button>
        </form>
      </section>

      <section className="partner-card">
        <div className="partner-step">
          <span className="partner-step__n">5</span>
          <h2 className="partner-step__title">Équipe</h2>
        </div>
        <p className="partner-muted">
          {store._count.employees} employé(s) · stub caisse/rayon si vide
        </p>
        <form action={partnerSeedTeamAction}>
          <input type="hidden" name="restaurantId" value={store.id} />
          <button type="submit" className="partner-btn">
            Créer équipe de base
          </button>
        </form>
      </section>

      <section className="partner-card partner-checklist">
        <h2>Checklist onboarding</h2>
        <ul>
          <li className={user ? "done" : ""}>
            Compte créé + identifiants transmis
          </li>
          <li className={store.whatsappTo ? "done" : ""}>WhatsApp renseigné</li>
          <li className={store._count.products > 0 ? "done" : ""}>
            Catalogue importé ({store._count.products} produits)
          </li>
          <li className={pos ? "done" : ""}>Lien caisse configuré</li>
          <li className={store.onboardingCompletedAt ? "done" : ""}>
            Onboarding marqué terminé
          </li>
          <li className={store.stripeStatus === "active" ? "done" : ""}>
            Abonnement Stripe actif ({store.stripeStatus ?? "none"})
          </li>
        </ul>
      </section>
    </main>
  );
}
