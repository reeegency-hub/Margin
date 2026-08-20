import "./partner.css";

/** Même typo que l’espace Commerce (Plus Jakarta via root layout). */
export default function PartnerRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="partner">{children}</div>;
}
