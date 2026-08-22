"use client";

import { SegmentedTabs } from "@/shared/ui/components/segmented-tabs";

export type AdminMonitoringViewMode = "list" | "organization";

type Props<T extends string = AdminMonitoringViewMode> = {
  value: T;
  onChange: (next: T) => void;
  ariaLabel?: string;
  options?: Array<{ value: T; label: string }>;
};

const DEFAULT_OPTIONS: Array<{ value: AdminMonitoringViewMode; label: string }> = [
  { value: "list", label: "Lista" },
  { value: "organization", label: "Por organização" },
];

export function AdminMonitoringViewSwitcher<T extends string = AdminMonitoringViewMode>({
  value,
  onChange,
  ariaLabel = "Modo de visualização",
  options,
}: Props<T>) {
  const items = (options ?? DEFAULT_OPTIONS) as Array<{ value: T; label: string }>;
  return (
    <SegmentedTabs<T>
      aria-label={ariaLabel}
      value={value}
      onChange={onChange}
      variant="bare"
      items={items.map((option) => ({ id: option.value, label: option.label }))}
    />
  );
}
