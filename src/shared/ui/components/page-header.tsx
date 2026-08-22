import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { layout, typography } from "@/shared/layout/design-system";

type PageHeaderSize = "default" | "compact";

/**
 * Cabeçalho principal da rota — único `<h1>` visível da página.
 * Fica fora dos containers de conteúdo (antes de painéis / grids).
 * No mobile, ações ficam abaixo do título e ocupam a largura disponível.
 */
export function PageHeader({
  title,
  description,
  actions,
  kicker,
  icon: Icon,
  size = "default",
  className = "",
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  kicker?: ReactNode;
  icon?: LucideIcon;
  size?: PageHeaderSize;
  className?: string;
}) {
  const spacing =
    size === "compact"
      ? "mb-6 border-b border-slate-200 pb-4"
      : "mb-6 border-b border-slate-200 pb-5 sm:mb-8 sm:pb-6";

  return (
    <header className={`${spacing} ${className}`.trim()}>
      <div className={layout.pageHeaderRow}>
        <div className="min-w-0 flex-1">
          {kicker ? <div className={typography.panelEyebrow}>{kicker}</div> : null}
          <div className={`${kicker ? "mt-1" : ""} flex items-start gap-2.5`}>
            {Icon ? (
              <span className={`${typography.sectionTitleIconWrap} mt-0.5 shrink-0`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
            ) : null}
            <h1 className={typography.pageTitle}>{title}</h1>
          </div>
          {description ? (
            typeof description === "string" ? (
              <p className={typography.pageDescription}>{description}</p>
            ) : (
              <div className={typography.pageDescription}>{description}</div>
            )
          ) : null}
        </div>
        {actions ? <div className={layout.pageHeaderActions}>{actions}</div> : null}
      </div>
    </header>
  );
}
