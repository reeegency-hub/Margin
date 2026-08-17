import Link from "next/link";

const LINKS = [
  { href: "/admin", label: "Ops clients", exact: true },
  { href: "/admin/ambassadors", label: "Ambassadeurs", exact: false },
  { href: "/admin/marketing", label: "Marketing", exact: false },
  { href: "/admin/newsletter", label: "Newsletter", exact: false },
] as const;

export function FounderSubnav({ current }: { current: string }) {
  return (
    <nav className="founder-subnav" aria-label="Espace fondateur">
      {LINKS.map((link) => {
        const active = link.exact
          ? current === link.href
          : current === link.href || current.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`founder-subnav__link${active ? " is-active" : ""}`}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
