"use client";

import { statusPillBase } from "@/shared/ui/components/status-pill";
import { levelMeta } from "@/features/fami/respondent-presentation";

type Props = {
  level: number | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  showIcon?: boolean;
};

export function RespondentFamiLevelBadge({
  level,
  size = "sm",
  showLabel = true,
  showIcon = false,
}: Props) {
  const isNotApplicable = level == null;
  const meta = level == null ? null : levelMeta(level);
  const Icon = meta?.icon;
  const pad =
    size === "lg" ? "px-3 py-1.5" : size === "md" ? "px-2.5 py-1" : "px-2 py-0.5";
  const text =
    size === "lg" ? "text-sm" : size === "md" ? "text-xs" : "text-micro";
  return (
    <span
      className={`${statusPillBase} ${pad} ${text} ${
        isNotApplicable ? "bg-slate-100 text-slate-600 ring-1 ring-slate-200" : meta!.badgeClasses
      }`}
      title={isNotApplicable ? "Sem pergunta aplicável neste escopo" : meta!.description}
    >
      {showIcon && Icon ? (
        <Icon className={size === "lg" ? "mr-1 h-4 w-4" : "mr-0.5 h-3 w-3"} aria-hidden />
      ) : null}
      {showLabel ? (
        <span>
          {isNotApplicable ? "N/A" : `Nível ${meta!.level}${size !== "sm" ? ` · ${meta!.shortLabel}` : ""}`}
        </span>
      ) : (
        <span>{isNotApplicable ? "N/A" : `N${meta!.level}`}</span>
      )}
    </span>
  );
}