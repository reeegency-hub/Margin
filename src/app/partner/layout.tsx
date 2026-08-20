import { Syne } from "next/font/google";
import "./partner.css";

const syne = Syne({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-partner-display",
});

export default function PartnerRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className={`partner ${syne.variable}`}>{children}</div>;
}
