"use client";

import { SidebarMenuButton } from "./sidebar-menu-button";
import { useSidebar } from "./sidebar-shell";

/** Topo da sidebar: menu integrado + marca (sempre visível dentro do painel lateral). */
export function SidebarBrandHeader() {
  const { collapsed } = useSidebar();

  return (
    <div
      className={[
        "sb-brand flex min-h-[var(--header-h)] shrink-0 items-center gap-2.5 border-b border-white/10",
        collapsed ? "md:justify-center md:gap-0 md:px-0" : "px-3 sm:px-4",
      ].join(" ")}
    >
      <SidebarMenuButton className="hidden md:inline-flex" />
      <p
        className={[
          "sb-label min-w-0 flex-1 truncate text-base font-medium tracking-normal text-white",
          collapsed ? "md:hidden" : "",
        ].join(" ")}
      >
        Plataforma Orienta
      </p>
    </div>
  );
}
