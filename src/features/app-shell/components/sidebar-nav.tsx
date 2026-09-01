"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { sidebar } from "@/shared/layout/design-system";
import { useSidebar } from "./sidebar-shell";

/**
 * Roots de cada perfil (Dashboard) que devem casar SOMENTE com a rota exata.
 * Sem esta lista, "/admin" fica ativo em todas as sub-rotas (ex.: /admin/biblioteca),
 * e dois itens do menu pintam como ativos ao mesmo tempo.
 */
const EXACT_MATCH_ROOTS = new Set(["/", "/admin", "/respondente"]);

export function isSidebarNavActive(pathname: string, href: string, search = ""): boolean {
  const [hrefPathname = href, hrefSearch = ""] = href.split("?", 2);
  const currentParams = new URLSearchParams(search);
  const hrefParams = new URLSearchParams(hrefSearch);

  if (
    hrefPathname === "/respondente/portfolio-recomendacoes" &&
    !hrefParams.has("view")
  ) {
    return (
      pathname === "/respondente/portfolio-recomendacoes" &&
      currentParams.get("view") !== "action-plan"
    );
  }

  if (hrefPathname === "/respondente/plano-acao") {
    if (pathname.startsWith("/respondente/plano-acao")) return true;
    return (
      pathname === "/respondente/portfolio-recomendacoes" &&
      currentParams.get("view") === "action-plan"
    );
  }

  if (hrefPathname === "/respondente/formularios" && pathname.startsWith("/respondente/ciclos/")) {
    return true;
  }
  if (EXACT_MATCH_ROOTS.has(hrefPathname)) return pathname === hrefPathname;
  if (pathname === hrefPathname) return true;
  return pathname.startsWith(`${hrefPathname}/`);
}

export function SidebarNavLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const active = isSidebarNavActive(pathname, href, searchParams.toString());
  const { closeDrawer } = useSidebar();

  return (
    <Link
      href={href}
      title={label}
      aria-current={active ? "page" : undefined}
      onClick={closeDrawer}
      // Item ativo: fundo escuro + ring sutil. Item inativo: hover suave.
      // Sem border-l-4: o "tab" lateral ficava feio quando o menu colapsa para
      // so icones; o ring/bg ja diferenciam ativo de forma legivel nos 2 modos.
      className={active ? sidebar.linkActive : sidebar.link}
    >
      {children}
      <span className="sb-label truncate">{label}</span>
    </Link>
  );
}
