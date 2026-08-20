import { Bricolage_Grotesque, Manrope } from "next/font/google";
import "./franchise.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["700", "800"],
  variable: "--font-franchise-display",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-franchise-body",
});

export default function FranchiseRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={`franchise ${bricolage.variable} ${manrope.variable}`}>
      {children}
    </div>
  );
}
