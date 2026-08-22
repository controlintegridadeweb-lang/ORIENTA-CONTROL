"use client";

import { SidebarMenuButton } from "./sidebar-menu-button";

/**
 * Faixa superior esquerda no mobile: mesma identidade visual da sidebar,
 * com o menu integrado (não flutuando no header branco do conteúdo).
 */
export function SidebarMobileRail() {
  return (
    <div
      className={[
        "flex h-full w-19 shrink-0 items-center justify-center",
        "border-r border-white/10 bg-brand-800",
        "md:hidden",
      ].join(" ")}
      aria-hidden={false}
    >
      <SidebarMenuButton />
    </div>
  );
}
