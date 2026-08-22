import type { ActionPlanListItem } from "@/features/improvement-management/action-plans/types";
import {
  OverviewBlockTitle,
  OverviewMetaGrid,
  OverviewMetaItem,
  OverviewSoftPanel,
  overviewStack,
} from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";
import { recommendationTypeLabel } from "@/shared/ui/status-registry";
import { AxisBadge } from "@/shared/ui/components/axis-badge";
import { typography } from "@/shared/layout/design-system";

type Props = {
  row: ActionPlanListItem;
};

/** Cabeçalho de escopo (Eixo + Seção) — primeiro bloco da Visão geral. */
export function RecommendationScopeHeader({ row }: Props) {
  return (
    <OverviewSoftPanel className="space-y-3">
      <AxisBadge axisName={row.axisName} />

      {row.sectionName ? (
        <div className="border-t border-slate-200/70 pt-3">
          <p className={typography.contextLabel}>Seção</p>
          <p className={`mt-1 ${typography.cardTitle}`}>{row.sectionName}</p>
        </div>
      ) : null}
    </OverviewSoftPanel>
  );
}

export function RecommendationContextSection({ row }: Props) {
  const cycleLabel = row.periodLabel?.trim() || row.cycleState;

  return (
    <section aria-labelledby="rec-context-heading" className={overviewStack}>
      <OverviewBlockTitle
        id="rec-context-heading"
        title="Contexto"
        description="Onde esta recomendação se encaixa no diagnóstico."
      />

      <OverviewSoftPanel>
        <OverviewMetaGrid>
          <OverviewMetaItem
            label="Formulário"
            value={`${row.formName} · Versão ${row.formVersion}`}
          />
          <OverviewMetaItem label="Órgão" value={row.organizationName} />
          <OverviewMetaItem
            label="Tipo"
            value={recommendationTypeLabel(row.recommendationType)}
          />
          <OverviewMetaItem label="Ciclo" value={cycleLabel} />
        </OverviewMetaGrid>
      </OverviewSoftPanel>
    </section>
  );
}
