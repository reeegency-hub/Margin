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
      <section className="partner-login__brand" aria-label="Margin ambassadeur">
        <div className="partner-login__brand-bg" aria-hidden />
        <div className="partner-login__brand-inner">
          <MarginLogo tone="light" href="/welcome" className="partner__logo" />
          <h1 className="partner-login__title">
            Amenez des commerces.
            <em> Gagnez à chaque facture.</em>
          </h1>
          <p className="partner-login__lead">
            Espace ambassadeur — onboard, commissions, relances. Compte séparé
            du login boutique.
          </p>
        </div>

        <ul className="partner-login__gains">
          <li>
            <strong>Magasins</strong>
            <span>Créer le compte client et le configurer</span>
          </li>
          <li>
            <strong>Commissions</strong>
            <span>Suivre ce que chaque filleul génère</span>
          </li>
          <li>
            <strong>Relances</strong>
            <span>Prospects et agenda du jour</span>
          </li>
        </ul>
      </section>

      <section className="partner-login__form-wrap">
        <div className="partner-login__form-panel">
          <p className="partner-login__eyebrow">Espace ambassadeur</p>
          <form action={partnerLoginAction} className="partner-login__form">
            <h2>Connexion</h2>
            <p className="partner-muted">
              Email et mot de passe ambassadeur.
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
              Vous gérez une boutique ?{" "}
              <a href="/login">Aller au login commerce</a>
            </p>
          </form>
        </div>
      </section>
    </div>
  );
}
