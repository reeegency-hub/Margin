"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { MarginLogo } from "@/components/brand/MarginLogo";
import { getPostLoginPath } from "@/app/actions";
import "@/components/auth/auth-shell.css";

export function LoginForm({ allowDemo }: { allowDemo: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionExpired = searchParams.get("error") === "session";
  const billingBlocked = searchParams.get("error") === "billing";
  const adminDenied = searchParams.get("error") === "admin";
  const justPaid = searchParams.get("paid") === "1";
  const emailFromUrl = searchParams.get("email") || "";
  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(
    sessionExpired
      ? "Session expirée. Reconnectez-vous."
      : billingBlocked
        ? "Votre abonnement est en pause. Contactez-nous pour le réactiver."
        : adminDenied
          ? "Accès admin refusé."
          : null
  );
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await signIn("credentials", {
      email: email.trim().toLowerCase(),
      password,
      redirect: false,
    });
    if (res?.error) {
      setLoading(false);
      try {
        const health = await fetch("/api/health/db", { cache: "no-store" });
        if (!health.ok) {
          const body = (await health.json().catch(() => null)) as {
            reason?: string;
          } | null;
          setError(
            body?.reason === "quota"
              ? "Base temporairement saturée (quota Neon). Réessayez plus tard ou contactez Margin."
              : "Service momentanément indisponible. Réessayez dans quelques minutes."
          );
          return;
        }
      } catch {
        /* ignore — tombe sur message identifiants */
      }
      setError("Email ou mot de passe incorrect.");
      return;
    }
    try {
      sessionStorage.removeItem("alerts-now-session-seen");
      sessionStorage.removeItem("margin-home-alert-hidden");
      sessionStorage.removeItem("alerts-now-dismissed");
    } catch {
      /* ignore */
    }
    const path = await getPostLoginPath();
    setLoading(false);
    router.push(path);
    router.refresh();
  }

  return (
    <div className="auth-shell">
      <div className="auth-shell__glow" aria-hidden />
      <form onSubmit={onSubmit} className="auth-panel">
        <MarginLogo tone="light" href="/welcome" className="auth-panel__logo" />
        <h1 className="auth-panel__title">
          {justPaid ? "Paiement reçu" : "Connexion"}
        </h1>
        <p className="auth-panel__lead">
          {justPaid
            ? "Entrez le mot de passe choisi à l’inscription pour ouvrir votre commerce."
            : "Email et mot de passe de votre compte Margin."}
        </p>

        <div className="auth-panel__fields">
          <Field label="Email">
            <input
              className={inputClass}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
            />
          </Field>
          <Field label="Mot de passe">
            <input
              className={inputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
        </div>

        {error ? <p className="auth-error">{error}</p> : null}

        <button type="submit" className="auth-cta" disabled={loading}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>

        {allowDemo ? (
          <p className="auth-foot">
            <a href="/api/demo-login">Connexion démo (local)</a>
          </p>
        ) : null}
        <p className="auth-foot">
          Pas encore de compte ? <Link href="/signup">S’inscrire</Link>
          {" · "}
          <Link href="/welcome">Accueil</Link>
        </p>
      </form>
    </div>
  );
}
