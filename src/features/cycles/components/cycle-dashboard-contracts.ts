import type { CycleState } from "@/shared/domain/types";
import type { CollectionFilter, DueFilter } from "@/features/cycles/dashboard-model";

export type CycleDashboardFormScope = { id: string; name: string };
export type CycleDashboardOrganizationOption = { id: string; name: string };

export type CycleDashboardInitialFilters = {
  search?: string;
  organizationId?: string;
  state?: CycleState | "";
  dueFilter?: DueFilter;
  collectionFilter?: CollectionFilter;
};

export type CycleDashboardPeriodOption = {
  id: string;
  label: string;
  periodCode: string;
};

export type CycleDashboardPeriodScope = {
  id: string;
  label: string;
  periodCode: string;
  responseDeadlineAt?: string | null;
};
