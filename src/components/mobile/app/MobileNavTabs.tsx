"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import "@/components/mobile/app/mobile-app.css";

function IconHome({ active }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.7}
      aria-hidden
    >
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z" />
    </svg>
  );
}

function IconSettings({ active }: { active?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.7}
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3V20.5M4.8 7.2l1.7 1.2M17.5 15.6l1.7 1.2M4.8 16.8l1.7-1.2M17.5 8.4l1.7-1.2" />
    </svg>
  );
}

const TABS = [
  {
    href: "/",
    label: "Accueil",
    Icon: IconHome,
    match: (p: string) => p === "/" || p.startsWith("/assistant"),
  },
  {
    href: "/settings",
    label: "Réglages",
    Icon: IconSettings,
    match: (p: string) => p.startsWith("/settings"),
  },
] as const;

export function MobileNavTabs() {
  const pathname = usePathname();

  return (
    <nav className="mapp-tabs" aria-label="Navigation mobile">
      <div className="mapp-tabs__row mapp-tabs__row--two">
        {TABS.map(({ href, label, Icon, match }) => {
          const active = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              className={`mapp-tabs__link${active ? " is-active" : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <Icon active={active} />
              <span className="mapp-tabs__sr">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
