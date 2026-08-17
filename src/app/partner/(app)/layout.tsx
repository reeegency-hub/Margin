import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAmbassador } from "@/lib/partner-auth";
import { partnerLogoutAction } from "../actions";

export default async function PartnerAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireAmbassador();
  if (!me) redirect("/partner/login");

  return (
    <>
      <header className="partner__nav">
        <p className="partner__brand">Margin · {me.name}</p>
        <nav>
          <Link href="/partner">Tableau</Link>
          <Link href="/partner/prospects">Prospects</Link>
          <Link href="/partner/agenda">Agenda</Link>
        </nav>
        <form action={partnerLogoutAction}>
          <button type="submit">Déconnexion</button>
        </form>
      </header>
      {children}
    </>
  );
}
