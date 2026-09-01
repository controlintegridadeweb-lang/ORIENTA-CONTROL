"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type UnderlineTabItem = {
  href: string;
  label: string;
  /** Tooltip nativo para rótulos longos ou contexto extra. */
  title?: string;
  /** Use quando o estado ativo depende de query string ou de uma rota agregada. */
  active?: boolean;
};

export function underlineTabLinkClass(active: boolean, embedded = false): string {
  const base =
    "relative shrink-0 whitespace-nowrap border-b-2 text-sm font-medium transition-[color,background-color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/30 focus-visible:ring-offset-2 ";

  if (embedded) {
    return (
      base +
      "rounded-t-lg px-4 py-3.5 sm:px-5 " +
      (active
        ? "-mb-px border-brand bg-brand/5 text-brand-700"
        : "border-transparent text-slate-600 hover:border-slate-300 hover:bg-slate-50/90 hover:text-slate-900")
    );
  }

  return (
    base +
    "px-4 py-2.5 " +
    (active
      ? "border-brand bg-white text-brand-700 shadow-[inset_0_1px_0_0_rgb(255_255_255)]"
      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900")
  );
}

function hrefPathname(href: string): string {
  return href.split("?", 1)[0] ?? href;
}

export function UnderlineTabs({
  tabs,
  embedded = false,
  "aria-label": ariaLabel,
}: {
  tabs: UnderlineTabItem[];
  /** Abas dentro de um painel (continuidade com o conteúdo abaixo). */
  embedded?: boolean;
  /** Navegação principal entre rotas secundárias. */
  "aria-label": string;
}) {
  const pathname = usePathname() ?? "";
  return (
    <nav
      className={
        embedded
          ? "scrollbar-thin flex flex-nowrap gap-x-1 overflow-x-auto overflow-y-hidden border-b border-slate-200/80 bg-white px-2 sm:px-4"
          : "scrollbar-thin flex flex-nowrap gap-x-1 overflow-x-auto overflow-y-hidden border-b border-slate-200/90 bg-slate-50/40 px-1"
      }
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const active = tab.active ?? pathname.startsWith(hrefPathname(tab.href));
        return (
          <Link
            key={tab.href}
            href={tab.href}
            title={tab.title}
            className={underlineTabLinkClass(active, embedded)}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
