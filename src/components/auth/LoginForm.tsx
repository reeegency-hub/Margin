"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Field, inputClass } from "@/components/ui";
import { MarginLogo } from "@/components/brand/MarginLogo";
import { getPostLoginPath } from "@/app/actions";

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
        ? "Abonnement requis ou paiement en attente. Terminez le checkout Stripe, puis reconnectez-vous."
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
      setError("Identifiants incorrects");
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
    <div className="marketing flex min-h-screen items-center justify-center px-4">
      <form
        onSubmit={onSubmit}
        className="brand-card brand-card--dark-card w-full max-w-md"
      >
        <MarginLogo tone="light" href="/welcome" />
        <h1 className="brand-card__title mt-3">
          {justPaid ? "Paiement reçu" : "Connexion"}
        </h1>
        <p className="brand-card__proof">
          {justPaid
            ? "Entrez le mot de passe choisi à l’inscription pour ouvrir votre magasin."
            : "Retour au magasin — email et mot de passe de votre compte."}
        </p>
        <div className="login-fields space-y-3">
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
          {error ? (
            <p className="text-[14px] text-[var(--accent-lime)]">{error}</p>
          ) : null}
        </div>
        <button type="submit" className="brand-cta w-full" disabled={loading}>
          {loading ? "Connexion…" : "Se connecter"}
        </button>
        {allowDemo ? (
          <p className="mt-3 text-center text-[13px] opacity-70">
            <a href="/api/demo-login">Connexion démo (local)</a>
          </p>
        ) : null}
        <p className="mt-4 text-center text-[13px] opacity-70">
          <Link href="/welcome">Retour à l’accueil</Link>
        </p>
      </form>
    </div>
  );
}
