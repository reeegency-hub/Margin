import Link from "next/link";
import { MarginLogo } from "@/components/brand/MarginLogo";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="legal-page">
      <header className="legal-page__nav">
        <MarginLogo href="/welcome" />
        <Link href="/welcome" className="legal-page__back">
          ← Accueil
        </Link>
      </header>
      <main className="legal-page__main">{children}</main>
      <footer className="legal-page__foot">
        <nav aria-label="Documents légaux">
          <Link href="/legal/mentions">Mentions légales</Link>
          <Link href="/legal/confidentialite">Confidentialité</Link>
          <Link href="/legal/cgu">CGU</Link>
          <Link href="/legal/cgv">CGV</Link>
          <Link href="/legal/cookies">Cookies</Link>
        </nav>
      </footer>
    </div>
  );
}
