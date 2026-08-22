import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { layout, typography } from "@/shared/layout/design-system";
import { PageHeader } from "@/shared/ui/components/page-header";

type SectionHeaderSize = "default" | "compact";

/**
 * Cabeçalho de seção (`<h2>`) ou, com `variant="page"`, delega ao `PageHeader`
 * (`<h1>` único da rota). Preferir `PageHeader` diretamente em páginas novas.
 */
export function SectionHeader({
  title,
  description,
  actions,
  kicker,
  icon: Icon,
  headingLevel = "h2",
  variant = "section",
  size = "default",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  kicker?: ReactNode;
  icon?: LucideIcon;
  /** @deprecated Use `variant="page"` + `PageHeader`. Mantido para migração. */
  headingLevel?: "h1" | "h2" | "h3";
  /** Cabeçalho principal da rota ou cabeçalho de seção interna. */
  variant?: "page" | "section";
  size?: SectionHeaderSize;
}) {
  if (variant === "page" || headingLevel === "h1") {
    return (
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        kicker={kicker}
        icon={Icon}
        size={size}
      />
    );
  }

  const Heading = headingLevel === "h3" ? "h3" : "h2";
  const titleClass =
    headingLevel === "h3" ? typography.subsectionTitle : typography.sectionTitle;
  const descriptionClass = typography.sectionDescription;
  const spacing =
    size === "compact"
      ? "mb-3"
      : "mb-4 sm:mb-6";

  return (
    <div className={spacing}>
      <div className={layout.pageHeaderRow}>
        <div className="min-w-0 flex-1">
          {kicker ? <div className={typography.panelEyebrow}>{kicker}</div> : null}
          <div className={`${kicker ? "mt-1" : ""} flex items-start gap-2.5`}>
            {Icon ? (
              <span className={`${typography.sectionTitleIconWrap} mt-0.5 shrink-0`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
            ) : null}
            <Heading className={titleClass}>{title}</Heading>
          </div>
          {description ? <p className={descriptionClass}>{description}</p> : null}
        </div>
        {actions ? <div className={layout.pageHeaderActions}>{actions}</div> : null}
      </div>
    </div>
  );
}
