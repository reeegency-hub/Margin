import "./partner.css";

export default function PartnerRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="partner">{children}</div>;
}
