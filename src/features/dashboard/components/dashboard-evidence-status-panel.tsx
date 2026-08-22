"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { InlineLoader } from "@/shared/ui/components/loading";
import {
  loadRecommendationFilters,
  type RecommendationFilterOptions,
} from "@/features/improvement-management";
import { StatusPieChart } from "@/shared/ui/charts/status-pie-chart";
import { SectionHeader } from "@/shared/ui/components/section-header";
import { fetchDashboardEvidenceStatus } from "@/features/dashboard/client";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  initialData: Record<string, number>;
  /** Valor inicial do filtro: "" = todas, ou id da organizacao */
  initialOrganizationId: string;
  filterOptions?: RecommendationFilterOptions;
};

export function DashboardEvidenceStatusPanel({
  initialData,
  initialOrganizationId,
  filterOptions: filterOptionsProp,
}: Props) {
  const [filters, setFilters] = useState<RecommendationFilterOptions | null>(
    filterOptionsProp ?? null,
  );
  const [filterError, setFilterError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState(initialOrganizationId);
  const [data, setData] = useState<Record<string, number>>(initialData);
  const [scopeHint, setScopeHint] = useState<string | null>(() =>
    initialOrganizationId ? "Validações desta organização." : "Todas as organizações.",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (filterOptionsProp) return;
    void loadRecommendationFilters()
      .then(setFilters)
      .catch((e: unknown) =>
        setFilterError(e instanceof Error ? e.message : "Falha ao carregar organizações."),
      );
  }, [filterOptionsProp]);

  const load = useCallback(async (orgId: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDashboardEvidenceStatus(orgId.length > 0 ? orgId : null);
      setData(res.data);
      setScopeHint(
        res.scope === "global" ? "Todas as organizações." : "Validações desta organização.",
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao carregar.");
      setData({});
    } finally {
      setLoading(false);
    }
  }, []);

  const skipFirstOrgEffect = useRef(true);
  useEffect(() => {
    if (skipFirstOrgEffect.current) {
      skipFirstOrgEffect.current = false;
      return;
    }
    void load(organizationId);
  }, [organizationId, load]);

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <SectionHeader
        kicker="Evidências"
        title="Situação das evidências"
        description="Distribuição das validações"
      />
      <div
        className={`flex min-h-0 flex-1 flex-col ${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}
      >
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-600">
          Organização
          <select
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            className={`${formSurface.inputSelect} w-full max-w-full text-sm sm:max-w-72`}
          >
            <option value="">Todas</option>
            {filters?.organizations.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        {loading ? (
          <InlineLoader
            label="Atualizando…"
            className="inline-flex items-center gap-2 text-sm text-slate-500"
          />
        ) : null}
      </div>
      {filterError ? <p className="mb-2 text-sm text-rose-600">{filterError}</p> : null}
      {scopeHint ? <p className="mb-3 text-sm leading-relaxed text-slate-500">{scopeHint}</p> : null}
      {error ? <p className="mb-2 text-sm text-rose-600">{error}</p> : null}
      <div className="flex-1">
        <StatusPieChart data={data} />
      </div>
      </div>
    </div>
  );
}
