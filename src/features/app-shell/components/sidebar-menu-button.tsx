"use client";

import { SidebarMenuIcon } from "./sidebar-menu-icon";
import { useSidebar } from "./sidebar-shell";

type Props = {
  className?: string;
};

const sidebarBaseClass =
  "inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-0";

const sizeClass = "h-9 w-9 min-h-9 min-w-9";

const sidebarVariantClass =
  "text-white/90 hover:bg-white/10 hover:text-white active:bg-white/15";

export function SidebarMenuButton({ className = "" }: Props) {
  const { menuIconOpen, toggleMenu, menuAriaLabel } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggleMenu}
      aria-label={menuAriaLabel}
      aria-expanded={menuIconOpen}
      aria-controls="orienta-sidebar"
      title={menuAriaLabel}
      className={[sidebarBaseClass, sizeClass, sidebarVariantClass, className]
        .filter(Boolean)
        .join(" ")}
    >
      <SidebarMenuIcon open={menuIconOpen} />
    </button>
  );
}
