import { redirect } from "next/navigation";
import { requireAmbassador } from "@/lib/partner-auth";
import { partnerLogoutAction } from "../actions";
import { PartnerNav } from "../PartnerNav";
import { MarginLogo } from "@/components/brand/MarginLogo";

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
        <MarginLogo tone="light" href="/partner" className="partner__logo" />
        <div className="partner__nav-meta">
          <p className="brand-eyebrow partner__eyebrow">Espace ambassadeur</p>
          <p className="partner__name">{me.name}</p>
        </div>
        <PartnerNav />
        <form action={partnerLogoutAction}>
          <button type="submit">Déconnexion</button>
        </form>
      </header>
      {children}
    </>
  );
}
