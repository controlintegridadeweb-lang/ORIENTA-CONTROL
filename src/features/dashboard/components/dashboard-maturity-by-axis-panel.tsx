"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { InlineLoader } from "@/shared/ui/components/loading";
import {
  loadRecommendationFilters,
  type RecommendationFilterOptions,
} from "@/features/improvement-management";
import { AxisBarChart } from "@/shared/ui/charts/axis-bar-chart";
import { SectionHeader } from "@/shared/ui/components/section-header";
import { YearSelect } from "@/shared/ui/components/year-select";
import type { AxisMaturity } from "@/features/fami";
import { fetchDashboardMaturityByAxis } from "@/features/dashboard/client";
import { formSurface } from "@/shared/layout/form-surface";
import { FamiScopeBanner } from "./fami-scope-banner";

type ScopeMeta = {
  cycleId: string | null;
  formId: string | null;
  formName: string | null;
  cycleState: string | null;
  isOfficialScore: boolean;
  applicableQuestions: number;
  waivedQuestions: number;
  notApplicableResponses: number;
  calculatedAt: string | null;
  overallPercentage: number | null;
  snapshotYearApplied: number | null;
};

const EMPTY_SCOPE_META: ScopeMeta = {
  cycleId: null,
  formId: null,
  formName: null,
  cycleState: null,
  isOfficialScore: false,
  applicableQuestions: 0,
  waivedQuestions: 0,
  notApplicableResponses: 0,
  calculatedAt: null,
  overallPercentage: null,
  snapshotYearApplied: null,
};

type Props = {
  initialAxes: AxisMaturity[];
  filterOptions?: RecommendationFilterOptions;
};

/**
 * O Resultado FAMI é oficial apenas por diagnóstico. O dashboard permite
 * selecionar uma organização e mostra o processamento mais recente dela, mas
 * não calcula média entre organizações, formulários ou períodos distintos.
 *
 * Hierarquia de leitura: filtros → contexto oficial → resultado/ação → gráfico.
 */
export function DashboardMaturityByAxisPanel({
  initialAxes,
  filterOptions: filterOptionsProp,
}: Props) {
  const [filters, setFilters] = useState<RecommendationFilterOptions | null>(
    filterOptionsProp ?? null,
  );
  const [filterError, setFilterError] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState("");
  const [closingYearFilter, setClosingYearFilter] = useState<number | null>(null);
  const [axes, setAxes] = useState<AxisMaturity[]>(initialAxes);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [scopeMeta, setScopeMeta] = useState<ScopeMeta>(EMPTY_SCOPE_META);
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

  const load = useCallback(
    async (orgId: string, yearSnapshot: number | null) => {
      if (!orgId) {
        setAxes([]);
        setAvailableYears([]);
        setScopeMeta(EMPTY_SCOPE_META);
        setError(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const res = await fetchDashboardMaturityByAxis(orgId, {
          year: yearSnapshot ?? undefined,
        });
        setAxes(res.items);
        setAvailableYears(res.availableYears);
        setScopeMeta({
          cycleId: res.cycleId,
          formId: res.formId,
          formName: res.formName,
          cycleState: res.cycleState,
          isOfficialScore: res.isOfficialScore,
          applicableQuestions: res.applicableQuestions,
          waivedQuestions: res.waivedQuestions,
          notApplicableResponses: res.notApplicableResponses,
          calculatedAt: res.calculatedAt,
          overallPercentage: res.overallPercentage,
          snapshotYearApplied: res.snapshotYearApplied,
        });
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Falha ao carregar.");
        setAxes([]);
        setScopeMeta(EMPTY_SCOPE_META);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const skipInitialLoad = useRef(true);
  useEffect(() => {
    if (skipInitialLoad.current) {
      skipInitialLoad.current = false;
      return;
    }
    void load(organizationId, closingYearFilter);
  }, [organizationId, closingYearFilter, load]);

  const globalScore =
    scopeMeta.overallPercentage != null ? Math.round(scopeMeta.overallPercentage) : null;
  const hasOfficialNotApplicableResult =
    scopeMeta.isOfficialScore && scopeMeta.cycleId != null && globalScore == null;

  const showResultStrip =
    Boolean(organizationId) &&
    !loading &&
    (globalScore != null || hasOfficialNotApplicableResult || Boolean(scopeMeta.cycleId));

  const yearFilterHint =
    "Opcional: mostra o processamento mais recente daquele ano para a organização selecionada.";

  return (
    <section className="flex h-full min-h-0 flex-col gap-4">
      <SectionHeader
        kicker="Resultado FAMI"
        title="Maturidade por eixo"
        description="Selecione uma organização para visualizar o Resultado FAMI do diagnóstico concluído mais recente."
      />

      <div
        className={`flex min-h-0 flex-1 flex-col ${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}
      >
        <div className="flex flex-col gap-6">
          <div className="space-y-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
              <label className={`min-w-0 w-full ${formSurface.fieldGroup}`}>
                <span className={formSurface.label}>Organização</span>
                <select
                  value={organizationId}
                  onChange={(event) => {
                    setClosingYearFilter(null);
                    setOrganizationId(event.target.value);
                  }}
                  className={`${formSurface.inputSelect} w-full`}
                >
                  <option value="" disabled>
                    Selecione uma organização
                  </option>
                  {filters?.organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
                {/* Reserva a mesma altura estrutural do helper do campo ao lado. */}
                <span className="invisible text-micro leading-relaxed" aria-hidden>
                  {yearFilterHint}
                </span>
              </label>

              <YearSelect
                id="dashboard-fami-closing-year"
                label="Ano do processamento FAMI"
                hint={yearFilterHint}
                years={availableYears}
                value={closingYearFilter}
                onChange={setClosingYearFilter}
                disabled={loading || !organizationId}
                className="min-w-0 w-full"
              />
            </div>
            {loading ? (
              <InlineLoader
                label="Atualizando…"
                className="inline-flex items-center gap-2 text-sm text-slate-500"
              />
            ) : null}
          </div>

          {filterError ? <p className="text-sm text-rose-600">{filterError}</p> : null}

          {organizationId ? (
            <FamiScopeBanner
              formName={scopeMeta.formName}
              cycleState={scopeMeta.cycleState}
              isOfficialScore={scopeMeta.isOfficialScore}
              applicableQuestions={scopeMeta.applicableQuestions}
              waivedQuestions={scopeMeta.waivedQuestions}
              notApplicableResponses={scopeMeta.notApplicableResponses}
              snapshotYearApplied={scopeMeta.snapshotYearApplied}
              calculatedAt={scopeMeta.calculatedAt}
            />
          ) : (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
              O Resultado FAMI é oficial por diagnóstico. Escolha uma organização para visualizar
              um resultado específico, sem misturar formulários ou períodos.
            </p>
          )}

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          {showResultStrip ? (
            <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {globalScore != null ? (
                  <span className="inline-flex items-center rounded-lg bg-brand-50 px-2.5 py-1.5 text-sm font-semibold text-brand-800 ring-1 ring-inset ring-brand-100">
                    Resultado FAMI {globalScore}%
                  </span>
                ) : hasOfficialNotApplicableResult ? (
                  <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                    Resultado FAMI N/A
                  </span>
                ) : null}
                {hasOfficialNotApplicableResult ? (
                  <span className="inline-flex items-center rounded-lg bg-slate-100 px-2.5 py-1.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200">
                    Sem eixos aplicáveis
                  </span>
                ) : null}
              </div>
              {scopeMeta.cycleId ? (
                <Link
                  href={`/admin/maturidade?organizationId=${encodeURIComponent(organizationId)}&cycleId=${encodeURIComponent(scopeMeta.cycleId)}`}
                  className="text-sm font-semibold text-brand-800 hover:underline"
                >
                  Abrir Resultado FAMI completo
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="h-[260px] md:h-[280px]">
            <AxisBarChart data={axes} density="compact" />
          </div>
        </div>
      </div>
    </section>
  );
}
