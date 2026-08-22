"use client";

import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/shared/ui/components/empty-state";
import { formSurface } from "@/shared/layout/form-surface";

export type AdminMonitoringEmptyStateConfig = {
  icon: LucideIcon;
  title: string;
  description: string;
  iconBg?: string;
  iconColor?: string;
};

type Props<K extends string> = {
  kind: K;
  config: Record<K, AdminMonitoringEmptyStateConfig>;
  onClear?: () => void;
  clearLabel?: string;
};

export function AdminMonitoringEmptyState<K extends string>({
  kind,
  config,
  onClear,
  clearLabel = "Limpar filtros",
}: Props<K>) {
  const current = config[kind];

  return (
    <EmptyState
      icon={current.icon}
      title={current.title}
      description={current.description}
      className="rounded-xl border border-dashed border-slate-200/90 bg-white"
      iconWrapClassName={`flex h-12 w-12 items-center justify-center rounded-full ${current.iconBg ?? "bg-slate-50"}`}
      iconClassName={`h-6 w-6 ${current.iconColor ?? "text-slate-500"}`}
      action={
        onClear ? (
          <button type="button" onClick={onClear} className={formSurface.primaryButtonSm}>
            {clearLabel}
          </button>
        ) : null
      }
    />
  );
}
