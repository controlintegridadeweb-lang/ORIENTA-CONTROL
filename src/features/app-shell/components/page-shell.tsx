"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { layout } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import { isFormFillRoute } from "@/shared/layout/form-fill-route";

/**
 * Painel principal da área logada: contêiner elevado único por tela, alinhado ao
 * shell (`AppShell` → `<main>`). Hierarquia típica: `layout.pageStack` na raiz
 * do filho, seções com `layout.sectionStack`, blocos com `formSurface.dashboardPanel`.
 *
 * Em rotas de preenchimento de formulário, usa fundo cinza institucional em vez
 * do painel branco — o workspace do formulário fica centralizado no filho.
 */
export function PageShell({
  children,
  className = "",
}: {
  children: ReactNode;
  /** Classes extras no contêiner externo (ex.: `max-w-4xl mx-auto`). */
  className?: string;
}) {
  const pathname = usePathname() ?? "";

  if (isFormFillRoute(pathname)) {
    /** Recupera margem útil do `<main>` sem alterar o shell global. */
    const canvas = `${formSurface.formWorkspace.pageCanvas} -mx-1 sm:-mx-2 lg:-mx-3 xl:-mx-4 ${className}`.trim();
    return <div className={canvas}>{children}</div>;
  }

  const outer = `${layout.pageShellOuter} ${className}`.trim();
  return (
    <div className={outer}>
      <div className={`${layout.pageShell} ${layout.pageShellPadding}`}>{children}</div>
    </div>
  );
}
