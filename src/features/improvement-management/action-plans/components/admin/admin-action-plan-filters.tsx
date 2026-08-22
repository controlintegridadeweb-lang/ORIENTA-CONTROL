"use client";

import { AdminMonitoringFilters } from "@/features/improvement-management/monitoring/components/admin-monitoring-filters";
import { STATUS_META, type AdminPlanView } from "@/features/improvement-management/action-plans/admin-monitoring";

export type AdminPlanFiltersState = {
  search: string;
  organizationId: string;
  formId: string;
  cycleId: string;
  view: "" | AdminPlanView;
  from: string;
  to: string;
};

export const initialAdminPlanFilters: AdminPlanFiltersState = {
  search: "",
  organizationId: "",
  formId: "",
  cycleId: "",
  view: "",
  from: "",
  to: "",
};

type Option = { id: string; label: string };

type Props = {
  value: AdminPlanFiltersState;
  organizations: Option[];
  forms: Option[];
  onChange: (next: AdminPlanFiltersState) => void;
};

export function AdminActionPlanFilters({ value, organizations, forms, onChange }: Props) {
  return (
    <AdminMonitoringFilters
      value={value}
      initialValue={initialAdminPlanFilters}
      organizations={organizations}
      forms={forms}
      onChange={onChange}
      searchPlaceholder="Organização, ação ou recomendação…"
      dateFromLabel="Prazo — de"
      gridClassName="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,1fr))] xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]"
      selectFields={[
        {
          key: "view",
          label: "Situação",
          options: [
            { value: "", label: "Todos" },
            { value: "not_started", label: STATUS_META.not_started.label },
            { value: "in_progress", label: STATUS_META.in_progress.label },
            { value: "overdue", label: "Em atraso" },
            { value: "completed", label: STATUS_META.completed.label },
            { value: "cancelled", label: STATUS_META.cancelled.label },
          ],
        },
      ]}
    />
  );
}
