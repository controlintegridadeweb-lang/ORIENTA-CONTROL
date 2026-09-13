"use client";

import { SidebarMenuIcon } from "./sidebar-menu-icon";
import { useSidebar } from "./sidebar-shell";

type Props = {
  className?: string;
  /** `sidebar`: ícone claro no painel teal. `header`: mesmo casco do sino no topo. */
  variant?: "sidebar" | "header";
};

const baseClass =
  "inline-flex shrink-0 items-center justify-center transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0";

const sizeClass = "size-10";

const variantClass = {
  sidebar:
    "rounded-md text-white/90 hover:bg-white/10 hover:text-white active:bg-white/15 focus-visible:ring-white/35",
  header:
    "rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400",
} as const;

export function SidebarMenuButton({ className = "", variant = "sidebar" }: Props) {
  const { menuIconOpen, toggleMenu, menuAriaLabel } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleMenu}
      aria-label={menuAriaLabel}
      aria-expanded={menuIconOpen}
      aria-controls="orienta-sidebar"
      title={menuAriaLabel}
      className={[baseClass, sizeClass, variantClass[variant], className]
        .filter(Boolean)
        .join(" ")}
    >
      <SidebarMenuIcon open={menuIconOpen} />
    </button>
  );
}
