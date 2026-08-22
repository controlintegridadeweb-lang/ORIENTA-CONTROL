"use client";

import { useMemo, type Dispatch, type SetStateAction } from "react";
import type { AdminListScopePart } from "@/shared/ui/admin/admin-list-scope-banner";

type ScopeFilters = {
  organizationId: string;
  formId: string;
  cycleId: string;
};

type SelectOption = { id: string; label: string };

/** Monta o resumo removível de escopo usado nas filas administrativas. */
export function useAdminMonitoringScopeParts<TFilters extends ScopeFilters>({
  filters,
  setFilters,
  organizationOptions,
  formOptions,
  selectedCycleLabel,
}: {
  filters: TFilters;
  setFilters: Dispatch<SetStateAction<TFilters>>;
  organizationOptions: readonly SelectOption[];
  formOptions: readonly SelectOption[];
  selectedCycleLabel?: string | null;
}): AdminListScopePart[] {
  return useMemo(() => {
    const parts: AdminListScopePart[] = [];

    if (filters.organizationId) {
      const organization = organizationOptions.find(
        (option) => option.id === filters.organizationId,
      );
      parts.push({
        label: "Organização",
        value: organization?.label ?? "Selecionada",
        onClear: () =>
          setFilters((current) => ({
            ...current,
            organizationId: "",
            formId: "",
            cycleId: "",
          })),
      });
    }

    if (filters.formId) {
      const form = formOptions.find((option) => option.id === filters.formId);
      parts.push({
        label: "Formulário",
        value: form?.label ?? "Selecionado",
        onClear: () =>
          setFilters((current) => ({ ...current, formId: "", cycleId: "" })),
      });
    }

    if (filters.cycleId) {
      parts.push({
        label: "Diagnóstico",
        value: selectedCycleLabel ?? "Diagnóstico selecionado",
        onClear: () => setFilters((current) => ({ ...current, cycleId: "" })),
      });
    }

    return parts;
  }, [
    filters.organizationId,
    filters.formId,
    filters.cycleId,
    organizationOptions,
    formOptions,
    selectedCycleLabel,
    setFilters,
  ]);
}
