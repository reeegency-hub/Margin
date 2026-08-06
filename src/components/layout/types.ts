import type { ReactNode } from "react";

export type NavItemConfig = {
  id: string;
  href: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
  match?: string[];
  /** Sous-pages (affichées quand la section est active) */
  children?: NavItemConfig[];
};

export type NavGroupConfig = {
  id: string;
  label?: string;
  items: NavItemConfig[];
};

export type AccountOption = {
  id: string;
  name: string;
  subtitle?: string;
};

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type CommandPaletteItem = {
  id: string;
  label: string;
  href?: string;
  onSelect?: () => void;
  keywords?: string[];
};

export type CommandPaletteGroup = {
  id: string;
  label: string;
  items: CommandPaletteItem[];
};
