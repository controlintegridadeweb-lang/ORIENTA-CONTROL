"use client";

import { Network } from "lucide-react";
import type { SectionActionPlanGroup } from "@/features/improvement-management/action-plans/section-action-plan-model";
import { SECTION_PLAN_EMPTY } from "@/features/improvement-management/action-plans/section-action-plan-copy";
import {
  OrganogramActionBranch,
  OrganogramBranchItem,
  OrganogramChartNode,
  OrganogramStem,
} from "@/features/improvement-management/action-plans/components/monitoring/organogram-primitives";
import { getAxisTheme } from "@/shared/theme/axis-theme";
import { EmptyState } from "@/shared/ui/components/empty-state";
import {
  OverviewBlockTitle,
  OverviewSoftPanel,
  overviewStack,
} from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";

type Props = {
  section: SectionActionPlanGroup;
};

function RecommendationBranch({
  section,
}: {
  section: SectionActionPlanGroup;
}) {
  const theme = getAxisTheme(section.axisName);
  const recommendations = section.recommendations;

  return (
    <ul className="flex items-start justify-center" role="list">
      {recommendations.map((recommendation, index) => (
        <OrganogramBranchItem
          key={recommendation.recommendationId}
          index={index}
          total={recommendations.length}
        >
          <div className="flex flex-col items-center">
            <OrganogramChartNode
              node="pergunta"
              label="Pergunta / achado"
              title={recommendation.questionPrompt.trim() || "Pergunta de origem"}
              shape="rounded"
              backgroundColor={theme.softBackground}
              inverse={false}
            />
            <OrganogramStem />
            <OrganogramChartNode
              node="recomendacao"
              label="Recomendação"
              title={recommendation.recommendationText.trim() || "Recomendação"}
              shape="rounded"
              backgroundColor={theme.tint}
              inverse={false}
            />
            {recommendation.actions.length > 0 ? (
              <>
                <OrganogramStem />
                <OrganogramActionBranch
                  plans={recommendation.actions}
                  selectedPlanId={null}
                  accentColor={theme.primary}
                />
              </>
            ) : (
              <p className="mt-5 max-w-56 text-center text-sm text-slate-500">
                Nenhuma ação vinculada.
              </p>
            )}
          </div>
        </OrganogramBranchItem>
      ))}
    </ul>
  );
}

export function SectionProblemSolutionTree({ section }: Props) {
  const theme = getAxisTheme(section.axisName);
  const axis = section.axisName.trim();
  const sectionName = section.sectionName.trim();

  if (section.recommendations.length === 0) {
    return (
      <EmptyState
        icon={Network}
        title={SECTION_PLAN_EMPTY.treeTitle}
        description={SECTION_PLAN_EMPTY.treeDescription}
      />
    );
  }

  return (
    <section aria-labelledby="section-tree-heading" className={overviewStack}>
      <OverviewBlockTitle
        id="section-tree-heading"
        title="Árvore de problemas e soluções"
        description="Cadeia da seção: pergunta do diagnóstico, recomendação e ações vinculadas. Não há cadastro paralelo; esta visão é derivada do plano da seção."
      />
      <OverviewSoftPanel padded={false}>
        <figure
          aria-label={`Árvore de problemas e soluções da seção ${sectionName}: ${section.recommendations.length} recomendação(ões)`}
          className="overflow-x-auto px-3 py-6 sm:px-5 sm:py-8"
          data-section-id={section.sectionId}
        >
          <div
            className="mx-auto flex w-max min-w-full flex-col items-center"
            data-layout="section-organogram-tree"
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
                <OrganogramStem />
              </>
            ) : null}
            <OrganogramChartNode
              node="secao"
              label={`Seção ${section.sectionDisplayNumber}`}
              title={sectionName || "Seção"}
              shape="rounded"
              backgroundColor={theme.primary}
              inverse
            />
            <OrganogramStem />
            <RecommendationBranch section={section} />
          </div>
        </figure>
      </OverviewSoftPanel>
    </section>
  );
}
