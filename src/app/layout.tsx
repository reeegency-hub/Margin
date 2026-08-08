import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Margin — Stock commerce relié à votre caisse",
    template: "%s · Margin",
  },
  description:
    "Logiciel de stock pour commerces de proximité : caisse branchée, stock à jour, alertes WhatsApp en cas de rupture. Formules Commerce et Franchise.",
  openGraph: {
    title: "Margin — Stock commerce relié à votre caisse",
    description:
      "Moins de ruptures, plus de marge. Synchronisez caisse et stock pour votre boutique de proximité.",
    locale: "fr_FR",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className={`${plusJakarta.variable} antialiased`}>{children}</body>
    </html>
  );
}
