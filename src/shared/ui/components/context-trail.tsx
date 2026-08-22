import Link from "next/link";
import { ChevronRight } from "lucide-react";

export type ContextTrailItem = {
  label: string;
  href?: string;
};

/**
 * Trilha contextual discreta para explicitar a hierarquia da informação sem
 * competir com o título da página. Funciona como breadcrumb quando houver
 * `href` e como contexto estrutural quando os itens forem apenas rótulos.
 */
export function ContextTrail({
  items,
  ariaLabel = "Contexto da página",
  className = "",
}: {
  items: ContextTrailItem[];
  ariaLabel?: string;
  className?: string;
}) {
  const visibleItems = items.filter((item) => item.label.trim().length > 0);
  if (visibleItems.length === 0) return null;

  return (
    <nav aria-label={ariaLabel} className={`min-w-0 ${className}`.trim()}>
      <ol className="scrollbar-thin flex min-w-0 items-center gap-1 overflow-x-auto pb-1 text-xs text-slate-500">
        {visibleItems.map((item, index) => {
          const current = index === visibleItems.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 shrink-0 items-center gap-1">
              {item.href && !current ? (
                <Link
                  href={item.href}
                  className="max-w-56 truncate rounded-sm font-medium text-slate-600 underline-offset-2 transition hover:text-slate-900 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={`${current ? "font-medium text-slate-700" : "text-slate-500"} max-w-64 truncate`}
                  aria-current={current ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
              {current ? null : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
