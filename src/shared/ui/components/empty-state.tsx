import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formSurface } from "@/shared/layout/form-surface";

/**
 * Estado vazio padronizado — título e descrição na hierarquia tipográfica oficial.
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className = "",
  iconWrapClassName,
  iconClassName,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
  iconWrapClassName?: string;
  iconClassName?: string;
}) {
  return (
    <div className={`${formSurface.empty.container} ${className}`.trim()}>
      {Icon ? (
        <span className={iconWrapClassName ?? formSurface.empty.iconWrap}>
          <Icon className={iconClassName ?? "h-6 w-6"} aria-hidden />
        </span>
      ) : null}
      <p className={formSurface.empty.title}>{title}</p>
      {description ? <p className={formSurface.empty.description}>{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}
