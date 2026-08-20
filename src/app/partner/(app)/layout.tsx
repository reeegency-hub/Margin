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
    <div className="partner-shell">
      <aside className="partner-rail">
        <div className="partner-rail__brand">
          <MarginLogo tone="light" href="/partner" className="partner__logo" />
        <p className="partner-rail__eyebrow">Ambassadeur</p>
        </div>
        <p className="partner-rail__name">{me.name}</p>
        <PartnerNav />
        <form action={partnerLogoutAction} className="partner-rail__logout">
          <button type="submit">Déconnexion</button>
        </form>
      </aside>
      <div className="partner-workspace">{children}</div>
    </div>
  );
}
