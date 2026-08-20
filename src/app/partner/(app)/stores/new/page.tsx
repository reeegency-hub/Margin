import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAmbassador } from "@/lib/partner-auth";
import { partnerCreateStoreAction } from "../../../store-actions";

export default async function PartnerNewStorePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");
  const params = await searchParams;

  const err =
    params.error === "email"
      ? "Cet email est déjà utilisé."
      : params.error === "missing"
        ? "Nom, email et mot de passe (8+ caractères) requis."
        : null;

  return (
    <main className="partner__main">
      <div className="partner-page-head">
        <Link href="/partner/stores" className="partner-muted">
          ← Magasins
        </Link>
        <h1>Nouveau magasin</h1>
        <p className="partner-muted">
          Crée le compte commerce et le lie automatiquement à votre espace (
          {me.name}).
        </p>
      </div>
      <div className="partner-card">
        {err ? <p className="flash flash-warn">{err}</p> : null}
        <form action={partnerCreateStoreAction} className="partner-form">
          <label>
            Nom du commerce *
            <input name="name" required placeholder="Épicerie du Centre" />
          </label>
          <label>
            Email gérant *
            <input name="email" type="email" required placeholder="gerant@..." />
          </label>
          <label>
            Mot de passe temporaire * (8+ car.)
            <input name="password" type="text" required minLength={8} />
          </label>
          <label>
            WhatsApp commerce
            <input name="whatsapp" placeholder="+336..." />
          </label>
          <label className="partner-check">
            <input type="checkbox" name="skipOnboarding" value="1" />
            Marquer onboarding comme fait (config faite par vous)
          </label>
          <button type="submit" className="partner-btn">
            Créer et configurer
          </button>
        </form>
      </div>
    </main>
  );
}
