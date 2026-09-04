import { computeActionPlanMetrics } from "@/features/improvement-management/action-plans/plan-metrics";
import { countLabel } from "@/shared/format/count-label";
import { DonutChart } from "@/shared/ui/charts/donut-chart";
import { ProgressRing } from "@/shared/ui/charts/progress-ring";
import { formSurface } from "@/shared/layout/form-surface";
import { layout, typography } from "@/shared/layout/design-system";
import {
  OverviewBlockTitle,
  overviewStack,
} from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";
import { ActionProgressChart } from "./action-progress-chart";
import {
  monitoringActionBars,
  monitoringSituationSlices,
  type MonitoringChartItem,
} from "./monitoring-chart-model";

type Props = {
  items: MonitoringChartItem[];
  description: string;
};

export function ActionPlanMonitoringDashboard({ items, description }: Props) {
  const actions = items.map((item) => item.action);
  const metrics = computeActionPlanMetrics(actions);
  const slices = monitoringSituationSlices(actions);
  const bars = monitoringActionBars(items);
  const overdueCount = slices.find((slice) => slice.key === "overdue")?.value ?? 0;
  const overdueNote =
    overdueCount > 0
      ? countLabel(overdueCount, "ação em atraso", "ações em atraso")
      : "Nenhuma ação em atraso";

  return (
    <section aria-labelledby="monitoring-dashboard-heading" className={overviewStack}>
      <OverviewBlockTitle
        id="monitoring-dashboard-heading"
        title="Monitoramento"
        description={description}
      />
      <div className={layout.twoPanelGrid}>
        <div className={`${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}>
          <h3 className={typography.subsectionTitle}>Situação das ações</h3>
          <p className={typography.sectionDescription}>Cada ação aparece em um único grupo.</p>
          <div className="mt-4">
            <DonutChart
              slices={slices}
              centerValue={metrics.total}
              centerLabel={metrics.total === 1 ? "ação" : "ações"}
              ariaLabel="Situação das ações"
              emptyTitle="Nenhuma ação para exibir"
              emptyDescription="A rosca aparece quando houver ações cadastradas."
            />
          </div>
        </div>
        <div className={`${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}>
          <h3 className={typography.subsectionTitle}>Execução média</h3>
          <p className={typography.sectionDescription}>Média do progresso das ações ativas.</p>
          <div className="mt-4 flex flex-col items-center">
            <ProgressRing
              percentage={metrics.progress}
              label="executado"
              ariaLabel={`Execução média de ${metrics.progress} por cento`}
            />
            <p className="mt-2 text-sm font-medium text-slate-600">{overdueNote}</p>
          </div>
        </div>
      </div>
      <div className={`${formSurface.dashboardPanel} ${formSurface.dashboardPanelPadding}`}>
        <h3 className={typography.subsectionTitle}>Progresso por ação</h3>
        <p className={typography.sectionDescription}>Percentual informado em cada ação do recorte.</p>
        <div className="mt-4">
          <ActionProgressChart bars={bars} />
        </div>
      </div>
    </section>
  );
}
