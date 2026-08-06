import Link from "next/link";
import { unsubscribeByToken } from "@/lib/newsletter";

export default async function NewsletterUnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const result = token
    ? await unsubscribeByToken(token)
    : { ok: false as const, error: "Lien manquant." };

  return (
    <div className="marketing flex min-h-screen items-center justify-center px-4 py-10">
      <div className="brand-card brand-card--dark-card w-full max-w-md space-y-3">
        <h1 className="brand-card__title">Newsletter</h1>
        {result.ok ? (
          <p className="brand-card__proof">
            {result.email} est désinscrit(e). Vous ne recevrez plus nos
            conseils marketing.
          </p>
        ) : (
          <p className="brand-card__proof">{result.error}</p>
        )}
        <p className="text-[13px] opacity-70">
          <Link href="/welcome">Retour à l’accueil</Link>
          {" · "}
          <Link href="/login">Se connecter</Link>
        </p>
      </div>
    </div>
  );
}
