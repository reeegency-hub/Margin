import { redirect } from "next/navigation";
import { requireAmbassador } from "@/lib/partner-auth";
import { partnerLogoutAction } from "../actions";
import { PartnerNav } from "../PartnerNav";

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
        <PartnerNav />
        <form action={partnerLogoutAction}>
          <button type="submit">Déconnexion</button>
        </form>
      </header>
      {children}
    </>
  );
}
