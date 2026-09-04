"use client";

import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { getAxisTheme, type AxisTheme } from "@/shared/theme/axis-theme";
import { PanelSection } from "@/shared/ui/components/panel-section";
import {
  OrganogramActionBranch,
  OrganogramChartNode,
  OrganogramStem,
} from "./organogram-primitives";

function OrganogramTree({
  axis,
  section,
  recommendation,
  theme,
  plans,
  selectedPlanId,
  onSelectAction,
}: {
  axis: string;
  section: string;
  recommendation: string;
  theme: AxisTheme;
  plans: ActionPlanAction[];
  selectedPlanId: string | null;
  onSelectAction: (planId: string) => void;
}) {
  return (
    <div
      className="mx-auto flex w-max min-w-full flex-col items-center"
      data-layout="organogram-tree"
    >
      {axis ? (
        <>
          <OrganogramChartNode
            node="eixo"
            label="Eixo"
            title={axis}
            shape="capsule"
            backgroundColor={theme.strong}
            inverse
          />
          {section || recommendation ? <OrganogramStem /> : null}
        </>
      ) : null}

      {section ? (
        <>
          <OrganogramChartNode
            node="secao"
            label="Seção"
            title={section}
            shape="rounded"
            backgroundColor={theme.primary}
            inverse
          />
          <OrganogramStem />
        </>
      ) : null}

      <OrganogramChartNode
        node="recomendacao"
        label="Recomendação"
        title={recommendation}
        shape="rounded"
        backgroundColor={theme.tint}
        inverse={false}
      />

      {plans.length > 0 ? (
        <>
          <OrganogramStem />
          <OrganogramActionBranch
            plans={plans}
            selectedPlanId={selectedPlanId}
            accentColor={theme.primary}
            onSelectAction={onSelectAction}
          />
        </>
      ) : (
        <p className="mt-5 text-center text-sm text-slate-500">Nenhuma ação vinculada.</p>
      )}
    </div>
  );
}

type Props = {
  axisName: string;
  sectionName: string;
  recommendationText: string;
  plans: ActionPlanAction[];
  selectedPlanId: string | null;
  onSelectAction: (planId: string) => void;
};

export function MonitoringOrganogram({
  axisName,
  sectionName,
  recommendationText,
  plans,
  selectedPlanId,
  onSelectAction,
}: Props) {
  const theme = getAxisTheme(axisName);
  const axis = axisName.trim();
  const section = sectionName.trim();
  const recommendation = recommendationText.trim() || "Recomendação";

  return (
    <PanelSection
      title="Árvore de problemas e soluções"
      size="compact"
      description="Eixo, seção, recomendação de origem e ações vinculadas."
    >
      <figure
        aria-label={`Árvore de problemas e soluções: ${[axis, section, recommendation].filter(Boolean).join(" → ")} → ${plans.length} ação(ões)`}
        className="overflow-x-auto rounded-xl bg-slate-50/50 px-3 py-6 sm:px-5 sm:py-8"
      >
        <OrganogramTree
          axis={axis}
          section={section}
          recommendation={recommendation}
          theme={theme}
          plans={plans}
          selectedPlanId={selectedPlanId}
          onSelectAction={onSelectAction}
        />
      </figure>
    </PanelSection>
  );
}
