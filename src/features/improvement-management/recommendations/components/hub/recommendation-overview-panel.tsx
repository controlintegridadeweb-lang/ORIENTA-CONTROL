"use client";

import { PanelSection } from "@/shared/ui/components/panel-section";
import { RecommendationActions } from "@/features/improvement-management/recommendations/components/hub/recommendation-actions";
import { OverviewStrategicLayout } from "./overview-strategic-layout";
import { useRecommendationDetailContext } from "./recommendation-detail-context";
import { RecommendationExceptionPanel } from "./recommendation-exception-panel";

export function RecommendationOverviewPanel() {
  const ctx = useRecommendationDetailContext();
  const row = ctx.row;

  if (!row) return null;

  return (
    <div className="space-y-8">
      <OverviewStrategicLayout row={row} />

      <RecommendationExceptionPanel />

      {ctx.role === "admin" ? (
        <PanelSection
          title="Acompanhamento da recomendação"
          description="A situação é derivada do plano de ação e o texto permanece congelado no diagnóstico."
          variant="card"
        >
          <RecommendationActions item={{
            id: row.recommendationId,
            cycleId: row.cycleId ?? "",
            formId: row.formId,
            formName: row.formName,
            formVersion: row.formVersion,
            organizationId: row.organizationId,
            organizationName: row.organizationName,
            questionId: row.questionId,
            questionPrompt: row.questionPrompt,
            sectionName: row.sectionName,
            axisName: row.axisName,
            recommendationType: row.recommendationType,
            originalText: row.recommendationText,
            currentText: row.recommendationText,
            status: row.recommendationStatus,
            createdAt: row.recommendationCreatedAt ?? "",
            updatedAt: row.recommendationCreatedAt ?? "",
            hasActionPlan: row.plans.length > 0,
          }} />
        </PanelSection>
      ) : null}
    </div>
  );
}
