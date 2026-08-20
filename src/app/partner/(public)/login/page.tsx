import { partnerLoginAction } from "../../actions";
import { MarginLogo } from "@/components/brand/MarginLogo";

export default async function PartnerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const err =
    params.error === "invalid"
      ? "Email ou mot de passe incorrect."
      : params.error === "missing"
        ? "Email et mot de passe requis."
        : params.error === "rate"
          ? "Trop de tentatives. Réessayez dans quelques minutes."
          : null;

  return (
    <div className="partner-login">
      <section className="partner-login__brand" aria-label="Margin">
        <div className="partner-login__brand-inner">
          <MarginLogo tone="light" href="/welcome" className="partner__logo" />
          <p className="partner-login__kicker">Espace ambassadeur</p>
          <h1 className="partner-login__title">Margin</h1>
          <p className="partner-login__lead">
            Onboardez des commerces, suivez vos commissions, relancez au bon
            moment.
          </p>
        </div>
        <ul className="partner-login__perks">
          <li>Magasins — créer et configurer</li>
          <li>Parrainage — code et lien perso</li>
          <li>Prospects & agenda — relances</li>
        </ul>
      </section>

      <section className="partner-login__form-wrap">
        <form action={partnerLoginAction} className="partner-login__form">
          <h2>Connexion</h2>
          <p className="partner-muted">
            Compte séparé du login commerce.
          </p>
          <label>
            Email
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </label>
          <label>
            Mot de passe
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </label>
          {err ? <p className="flash flash-warn">{err}</p> : null}
          <button type="submit" className="partner-btn">
            Se connecter
          </button>
          <p className="partner-login__note">
            Commerce ? <a href="/login">Aller au login boutique</a>
          </p>
        </form>
      </section>
    </div>
  );
}
