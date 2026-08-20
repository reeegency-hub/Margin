import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./partner.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-partner-display",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-partner-body",
});

export default function PartnerRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`partner ${bricolage.variable} ${manrope.variable}`}>
      {children}
    </div>
  );
}
