"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { InlineLoader } from "@/shared/ui/components/loading";
import { PanelSection } from "@/shared/ui/components/panel-section";
import type { RespondentProgress } from "@/features/respondent-progress";
import {
  respondentDashboardYearOptions,
  RESPONDENT_DASHBOARD_MIN_YEAR,
  RESPONDENT_DASHBOARD_MAX_YEAR,
} from "@/features/respondent-progress";
import { useRespondentYearProgress } from "@/features/respondent-progress";
import { YearSelect } from "@/shared/ui/components/year-select";
import { RespondentFormsYearEmptyState } from "@/features/workbench/components/respondent-form/respondent-forms-year-empty-state";
import { RespondentFormProgressItem } from "@/features/workbench/components/respondent-form/respondent-form-progress-item";
import { RespondentFormulariosHero } from "@/features/workbench/components/respondent-form/respondent-forms-hero";
import { RESPONDENT_PAGE_HERO_BLEED } from "@/shared/layout/respondent-page-layout";
import { formSurface } from "@/shared/layout/form-surface";
import { layout } from "@/shared/layout/design-system";

type Props = {
  initialForms: RespondentProgress[];
  initialYear: number;
};

export function RespondentFormulariosSection({ initialForms, initialYear }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { year, setYear, forms, loading, error } = useRespondentYearProgress({
    initialForms,
    initialYear,
  });

  return (
    <div className={layout.pageStack}>
      <div className={RESPONDENT_PAGE_HERO_BLEED}>
        <RespondentFormulariosHero />
      </div>

      <div className={`${layout.pageStack} pt-1`}>
        {error ? <p className="text-sm text-rose-600">{error}</p> : null}

        <PanelSection
          title="Período de referência"
          description={`Acompanhamento e histórico dos diagnósticos de ${year} (horário oficial da plataforma — Fortaleza, UTC−3).`}
          variant="plain"
          className={loading ? "opacity-60 transition-opacity" : undefined}
          actions={
            <div className="flex flex-wrap items-end gap-3">
              <YearSelect
                id="respondent-formularios-year"
                label="Ano"
                className="w-full sm:w-40"
                minYear={RESPONDENT_DASHBOARD_MIN_YEAR}
                maxYear={RESPONDENT_DASHBOARD_MAX_YEAR}
                years={respondentDashboardYearOptions()}
                value={year}
                onChange={(y) => {
                  if (y == null) return;
                  setYear(y);
                  const next = new URLSearchParams(searchParams.toString());
                  next.set("year", String(y));
                  next.delete("submission");
                  next.delete("cycleId");
                  router.replace(`${pathname}?${next.toString()}`, { scroll: false });
                }}
                includeAllOption={false}
                disabled={loading}
              />
              {loading ? (
                <InlineLoader
                  label="Atualizando…"
                  className="inline-flex items-center gap-2 pb-2 text-sm text-slate-500"
                />
              ) : null}
            </div>
          }
        >
          <div
            className={`${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}
            aria-busy={loading}
            aria-label={`Diagnósticos de ${year}`}
          >
            {forms.length === 0 ? (
              <RespondentFormsYearEmptyState year={year} loading={loading} />
            ) : (
              <ul className="space-y-3" key={year}>
                {forms.map((form) => (
                  <RespondentFormProgressItem
                    key={form.cycleId}
                    form={form}
                    variant="card"
                    contextYear={year}
                  />
                ))}
              </ul>
            )}
          </div>
        </PanelSection>
      </div>
    </div>
  );
}
