"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { evidenceLabels } from "@/shared/labels/official-labels";
import { InlineLoader } from "@/shared/ui/components/loading";
import type { RespondentProgress } from "@/features/respondent-progress";
import type { RespondentDashboardSummary } from "@/features/respondent-progress";
import {
  respondentDashboardYearOptions,
  RESPONDENT_DASHBOARD_MIN_YEAR,
  RESPONDENT_DASHBOARD_MAX_YEAR,
} from "@/features/respondent-progress";
import { useRespondentYearProgress } from "@/features/respondent-progress";
import { RespondentDashboardFormsPanel } from "@/features/dashboard/components/respondent-dashboard-forms-panel";
import { selectDashboardForms } from "@/features/respondent-progress";
import { RespondentDashboardHero } from "@/features/dashboard/components/respondent-dashboard-hero";
import { MetricCard } from "@/shared/ui/components/metric-card";
import { YearSelect } from "@/shared/ui/components/year-select";
import { formSurface } from "@/shared/layout/form-surface";
import { layout, typography } from "@/shared/layout/design-system";
import { RESPONDENT_PAGE_HERO_BLEED } from "@/shared/layout/respondent-page-layout";

type Props = {
  initialForms: RespondentProgress[];
  initialYear: number;
  initialSummary: RespondentDashboardSummary;
};

export function RespondentDashboardSection({
  initialForms,
  initialYear,
  initialSummary,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reloadToken = searchParams.get("cycleId")?.trim() ?? null;
  const { year, setYear, forms, summary, loading, error } = useRespondentYearProgress({
    initialForms,
    initialYear,
    initialSummary,
    reloadToken,
  });

  const progressHint = `${summary.progressPct}% de progresso em ${year}`;
  const dashboardForms = selectDashboardForms(forms);

  return (
    <div className={layout.pageStack}>
      <div className={RESPONDENT_PAGE_HERO_BLEED}>
        <RespondentDashboardHero year={year} />
      </div>

      <div className={`${layout.pageStack} pt-1`}>
        <div
          className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end"
          role="group"
          aria-label="Filtro por período"
        >
          <YearSelect
            id="respondent-dashboard-year"
            label="Ano"
            labelClassName={typography.sectionTitle}
            minYear={RESPONDENT_DASHBOARD_MIN_YEAR}
            maxYear={RESPONDENT_DASHBOARD_MAX_YEAR}
            years={respondentDashboardYearOptions()}
            value={year}
            onChange={(y) => {
              if (y == null) return;
              setYear(y);
              const next = new URLSearchParams(searchParams.toString());
              next.set("year", String(y));
              router.replace(`${pathname}?${next.toString()}`, { scroll: false });
            }}
            includeAllOption={false}
            disabled={loading}
          />
          {loading ? (
            <InlineLoader
              label="Atualizando…"
              className="inline-flex items-center gap-2 pb-0.5 text-sm text-slate-500 sm:pb-2"
            />
          ) : null}
        </div>

        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <section
          className={`${layout.sectionStack} ${loading ? "opacity-60 transition-opacity" : ""}`}
          aria-busy={loading}
        >
          <h2 className={typography.sectionTitle}>Resumo</h2>
          <div className={layout.kpiGrid3}>
            <MetricCard
              density="compact"
              label="Diagnósticos para responder"
              value={summary.openForms}
              variant="warning"
              htmlTitle="Diagnósticos em preenchimento ou com ajustes solicitados no ano selecionado."
            />
            <MetricCard
              density="compact"
              label="Perguntas respondidas"
              value={`${summary.totalAnswered}/${summary.totalQuestions}`}
              variant="info"
              secondary={progressHint}
              htmlTitle="Progresso consolidado das respostas no ano."
            />
            <MetricCard
              density="compact"
              label={evidenceLabels.kpiLabel}
              value={summary.totalComplementation}
              variant={summary.totalComplementation > 0 ? "warning" : "neutral"}
              href={`/respondente/evidencias?view=all&from=${year}-01-01&to=${year}-12-31${summary.totalComplementation > 0 ? "&status=adjustment_requested&pendingOnly=1" : ""}`}
              ctaLabel={
                summary.totalComplementation > 0 ? "Ver pendências" : "Ver evidências"
              }
              secondary={
                summary.totalComplementation > 0
                  ? evidenceLabels.kpiHintPending
                  : evidenceLabels.kpiHintEmpty
              }
              htmlTitle="Pendências de ajuste ou comprovação no ano selecionado."
            />
          </div>
        </section>

        <section className={layout.sectionStack}>
          <h2 className={typography.sectionTitle}>Diagnósticos</h2>
          <div className={`${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}>
            <RespondentDashboardFormsPanel
              forms={dashboardForms}
              totalForms={forms.length}
              year={year}
              loading={loading}
            />
          </div>
        </section>
      </div>
    </div>
  );
}
