"use client";

import { useMemo } from "react";
import type { RecommendationFilterOptions } from "@/features/improvement-management/recommendations/filter-options";

type SelectOption = { id: string; label: string };

export function useAdminMonitoringFilterOptions(
  options: RecommendationFilterOptions | null,
): {
  organizations: SelectOption[];
  forms: SelectOption[];
  axes: SelectOption[];
} {
  return useMemo(
    () => ({
      organizations: (options?.organizations ?? []).map((item) => ({
        id: item.id,
        label: item.name,
      })),
      forms: (options?.forms ?? []).map((item) => ({
        id: item.id,
        label: `${item.name} (v${item.version})`,
      })),
      axes: (options?.axes ?? []).map((item) => ({
        id: item.id,
        label: item.name,
      })),
    }),
    [options],
  );
}
