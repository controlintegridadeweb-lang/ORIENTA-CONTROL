"use client";

import { statusPillBase } from "@/shared/ui/components/status-pill";
import {
  workflowStatusEntry,
  type WorkflowStatusDomain,
  type WorkflowStatusMap,
} from "@/shared/ui/status-registry";

type BaseProps = {
  className?: string;
  /** Classes extras no ícone (ex.: `animate-spin` para processamento). */
  iconClassName?: string;
  /** `compact` para listas densas; `md` para drawers. */
  size?: "compact" | "default" | "md";
  /** Prefixo opcional para aria-label / contextualização */
  ariaPrefix?: string;
  /** Ícones desligados por padrão (visual minimalista). */
  showIcon?: boolean;
};

export type WorkflowStatusBadgeProps = {
  [D in WorkflowStatusDomain]: BaseProps & { domain: D; status: WorkflowStatusMap[D] };
}[WorkflowStatusDomain];

/**
 * Badge único para status de workflow: rótulos/cores via {@link workflowStatusEntry}.
 */
export function WorkflowStatusBadge(props: WorkflowStatusBadgeProps) {
  const {
    domain,
    status,
    className = "",
    iconClassName = "",
    size = "default",
    ariaPrefix,
    showIcon = false,
  } = props;

  const meta = workflowStatusEntry(domain, status as never);
  const Icon = meta.icon;
  const surfaceClass = meta.chipColorClass ?? meta.colorClass;

  const textSize = size === "compact" ? "text-2xs" : "text-xs";
  const pad =
    size === "compact"
      ? "min-h-5 px-1.5 py-0.5"
      : size === "md"
        ? "min-h-7 px-2.5 py-1"
        : "min-h-6 px-2 py-1";

  const labelParts = [ariaPrefix, meta.label].filter(Boolean);

  return (
    <span
      className={`${statusPillBase} ${pad} ${textSize} ${surfaceClass} ${className}`.trim()}
      title={meta.description ?? meta.label}
      aria-label={labelParts.join(": ")}
    >
      {showIcon && Icon ? (
        <Icon
          className={`mr-0.5 h-3 w-3 shrink-0 opacity-85 ${iconClassName}`.trim()}
          aria-hidden
        />
      ) : null}
      {meta.label}
    </span>
  );
}