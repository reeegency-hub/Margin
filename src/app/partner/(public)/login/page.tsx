import { partnerLoginAction } from "../../actions";
import { MarginLogo } from "@/components/brand/MarginLogo";
import { Field, inputClass } from "@/components/ui";
import "@/components/auth/auth-shell.css";

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
    <div className="auth-shell">
      <div className="auth-shell__glow" aria-hidden />
      <form action={partnerLoginAction} className="auth-panel">
        <MarginLogo tone="light" href="/welcome" className="auth-panel__logo" />
        <h1 className="auth-panel__title">Espace ambassadeur</h1>
        <p className="auth-panel__lead">
          Email et mot de passe ambassadeur — même écran que le login commerce.
        </p>
        <div className="auth-panel__fields">
          <Field label="Email">
            <input
              className={inputClass}
              type="email"
              name="email"
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Mot de passe">
            <input
              className={inputClass}
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </Field>
        </div>
        {err ? <p className="auth-error">{err}</p> : null}
        <button type="submit" className="auth-cta">
          Se connecter
        </button>
        <p className="auth-foot">
          Vous gérez une boutique ? <a href="/login">Login commerce</a>
          {" · "}
          <a href="/welcome">Accueil</a>
        </p>
      </form>
    </div>
  );
}
