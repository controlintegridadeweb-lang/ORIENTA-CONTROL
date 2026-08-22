"use client";

import { AdminMonitoringFilters } from "@/features/improvement-management/monitoring/components/admin-monitoring-filters";
import { STATUS_META } from "@/features/improvement-management/recommendations/admin-presentation";
import type { RecommendationStatus } from "@/features/improvement-management/recommendations/schemas";
import { perguntaLabels } from "@/shared/labels/official-labels";

export type AdminFiltersState = {
  search: string;
  organizationId: string;
  formId: string;
  cycleId: string;
  axisId: string;
  status: "" | RecommendationStatus;
  from: string;
  to: string;
};

export const initialAdminFilters: AdminFiltersState = {
  search: "",
  organizationId: "",
  formId: "",
  cycleId: "",
  axisId: "",
  status: "",
  from: "",
  to: "",
};

type Option = { id: string; label: string };

type Props = {
  value: AdminFiltersState;
  organizations: Option[];
  forms: Option[];
  axes: Option[];
  onChange: (next: AdminFiltersState) => void;
  loading?: boolean;
};

export function AdminRecommendationFilters({
  value,
  organizations,
  forms,
  axes,
  onChange,
}: Props) {
  return (
    <AdminMonitoringFilters
      value={value}
      initialValue={initialAdminFilters}
      organizations={organizations}
      forms={forms}
      onChange={onChange}
      searchPlaceholder={perguntaLabels.filterPlaceholder}
      dateFromLabel="Período — de"
      gridClassName="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] xl:grid-cols-[minmax(0,1.6fr)_repeat(4,minmax(0,1fr))]"
      selectFields={[
        {
          key: "axisId",
          label: "Eixo",
          options: [
            { value: "", label: "Todos" },
            ...axes.map((axis) => ({ value: axis.id, label: axis.label })),
          ],
        },
        {
          key: "status",
          label: "Situação",
          options: [
            { value: "", label: "Todos" },
            { value: "generated", label: STATUS_META.generated.label },
            { value: "in_action_plan", label: STATUS_META.in_action_plan.label },
            { value: "adjustment_requested", label: STATUS_META.adjustment_requested.label },
            { value: "exception_requested", label: STATUS_META.exception_requested.label },
            { value: "awaiting_approval", label: STATUS_META.awaiting_approval.label },
            { value: "completed", label: STATUS_META.completed.label },
            { value: "dismissed", label: STATUS_META.dismissed.label },
          ],
        },
      ]}
    />
  );
}
