import Link from "next/link";
import { supportMailto } from "@/lib/support";

/** Footer minimal. */
export function MobileLandingFooter() {
  return (
    <footer className="mland-foot">
      <nav className="mland-foot__links" aria-label="Liens">
        <Link href="/legal/mentions">Mentions</Link>
        <Link href="/legal/cgu">CGU</Link>
        <a href={supportMailto()}>Contact</a>
        <Link href="/login">Se connecter</Link>
      </nav>
      <p className="mland-foot__copy">
        © {new Date().getFullYear()} Margin
      </p>
    </footer>
  );
}
