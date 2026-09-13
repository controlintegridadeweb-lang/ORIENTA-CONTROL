"use client";

import { SidebarMenuButton } from "./sidebar-menu-button";

/**
 * Faixa superior esquerda no mobile/tablet: mesma identidade visual da sidebar,
 * com o menu integrado (não flutuando no header branco do conteúdo).
 * Largura compacta (48px) — o `w-19` da sidebar recolhida é só do desktop.
 */
export function SidebarMobileRail() {
  return (
    <div
      className={[
        "flex h-full w-12 shrink-0 items-center justify-center",
        "border-r border-white/10 bg-brand-800",
        "lg:hidden",
      ].join(" ")}
      aria-hidden={false}
    >
      <SidebarMenuButton />
    </div>
  );
}
