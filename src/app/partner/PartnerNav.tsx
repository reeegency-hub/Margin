"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/partner", label: "Tableau", exact: true },
  { href: "/partner/stores", label: "Magasins" },
  { href: "/partner/prospects", label: "Prospects" },
  { href: "/partner/agenda", label: "Agenda" },
] as const;

export function PartnerNav() {
  const pathname = usePathname();

  return (
    <nav className="partner__navlinks" aria-label="Espace ambassadeur">
      {LINKS.map(({ href, label, ...rest }) => {
        const exact = "exact" in rest && rest.exact;
        const active = exact ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={active ? "partner__navlink partner__navlink--active" : "partner__navlink"}
            aria-current={active ? "page" : undefined}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
