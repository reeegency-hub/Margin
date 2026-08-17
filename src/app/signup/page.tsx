import Link from "next/link";
import { MarginLogo } from "@/components/brand/MarginLogo";
import { supportMailto, SUPPORT } from "@/lib/support";
import "@/components/auth/auth-shell.css";

/**
 * Soft launch fermé : pas de self-serve.
 * Les comptes pilotes sont créés à la main (fondateur).
 */
export default function SignupPage() {
  return (
    <div className="marketing flex min-h-screen items-center justify-center px-4 py-10">
      <div className="auth-card w-full max-w-md text-center">
        <MarginLogo tone="dark" href="/welcome" className="mx-auto mb-6" />
        <h1 className="text-xl font-semibold tracking-tight">
          Inscription sur invitation
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-[var(--text-secondary)]">
          Margin ouvre un programme pilote limité (5 commerces). Pas
          d’inscription libre pour l’instant — on crée votre compte avec vous.
        </p>
        <div className="mt-8 flex flex-col gap-3">
          <a
            href={supportMailto("Demande place pilote Margin")}
            className="btn-lime w-full justify-center"
          >
            Demander une place — {SUPPORT.email}
          </a>
          <Link href="/login" className="btn-ghost w-full justify-center">
            J’ai déjà un compte
          </Link>
          <Link
            href="/welcome"
            className="text-sm text-[var(--text-secondary)] underline-offset-2 hover:underline"
          >
            Retour à l’accueil
          </Link>
        </div>
      </div>
    </div>
  );
}
