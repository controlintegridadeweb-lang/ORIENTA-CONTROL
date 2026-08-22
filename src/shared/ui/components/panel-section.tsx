import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cards, layout } from "@/shared/layout/design-system";
import { SectionHeader } from "@/shared/ui/components/section-header";

type PanelSectionProps = {
  title: string;
  description?: string;
  kicker?: string;
  icon?: LucideIcon;
  actions?: ReactNode;
  /** `plain`: título + conteúdo; `card`: painel branco com borda (padrão dashboard). */
  variant?: "plain" | "card";
  /** Encaminhado ao `SectionHeader` — use `compact` em linhas de ação empilhadas. */
  size?: "default" | "compact";
  /**
   * Omite o título visual quando um controle externo (abas) já nomeia o painel.
   * Descrição e ações continuam visíveis.
   */
  hideTitle?: boolean;
  className?: string;
  contentClassName?: string;
  id?: string;
  children?: ReactNode;
};

/**
 * Bloco de conteúdo com título e subtítulo consistentes (`SectionHeader`).
 * O cabeçalho fica sempre fora do container; o painel (`card`) só envolve o conteúdo.
 */
export function PanelSection({
  title,
  description,
  kicker,
  icon,
  actions,
  variant = "plain",
  size = "default",
  hideTitle = false,
  className = "",
  contentClassName = "",
  id,
  children,
}: PanelSectionProps) {
  const header = hideTitle ? (
    description || actions ? (
      <div className={size === "compact" ? "mb-3" : "mb-4 sm:mb-6"}>
        <div className={layout.pageHeaderRow}>
          {description ? (
            <p className="min-w-0 flex-1 text-sm font-normal leading-relaxed break-words text-slate-600">
              {description}
            </p>
          ) : (
            <div className="min-w-0 flex-1" />
          )}
          {actions ? <div className={layout.pageHeaderActions}>{actions}</div> : null}
        </div>
      </div>
    ) : null
  ) : (
    <SectionHeader
      title={title}
      description={description}
      kicker={kicker}
      icon={icon}
      actions={actions}
      size={size}
    />
  );

  const hasBody = children != null && children !== false;

  const labelledBy = hideTitle ? { "aria-label": title } : {};

  if (variant === "card") {
    return (
      <section id={id} className={`${layout.sectionStack} ${className}`.trim()} {...labelledBy}>
        {header}
        {hasBody ? (
          <div
            className={`${cards.dashboardPanel} ${cards.dashboardPanelPadding} ${contentClassName}`.trim()}
          >
            {children}
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section id={id} className={`${layout.sectionStack} ${className}`.trim()} {...labelledBy}>
      {header}
      {hasBody ? (
        <div className={contentClassName.trim() || undefined}>{children}</div>
      ) : null}
    </section>
  );
}
