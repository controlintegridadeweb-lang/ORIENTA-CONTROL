"use client";

import type { FamiSnapshotResponse } from "@/features/fami/client";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { FamiEvolutionChart } from "../fami-evolution-chart";
import { FamiAnnualResultCard } from "@/features/fami/components/fami-annual-result-card";
import { FamiPreliminaryPanel } from "@/features/fami/components/preliminary/fami-preliminary-panel";
import type { FamiPreliminaryController } from "@/features/fami/components/preliminary/use-fami-preliminary";
import { FAMI_SECTION_STACK } from "../fami-maturity-helpers";

type Props = {
  data: FamiSnapshotResponse | null;
  cycleId: string | null | undefined;
  referenceYear: number;
  canMaterialize: boolean;
  preliminary: FamiPreliminaryController;
};

export function FamiEvolucaoTab({
  data,
  cycleId,
  referenceYear,
  canMaterialize,
  preliminary,
}: Props) {
  const global = data?.snapshot?.global;
  return (
    <div className={FAMI_SECTION_STACK}>
      <PanelSection
        title="Evolução temporal"
        description="Comparativo entre processamentos oficiais do diagnóstico e o acompanhamento do plano de integridade e compliance no mesmo ano."
        variant="card"
        contentClassName="p-5 sm:p-6"
      >
        <div className="min-h-88">
          <FamiEvolutionChart variant="years" data={data?.evolutionByYear ?? []} />
        </div>
      </PanelSection>

      <FamiPreliminaryPanel
        cycleId={cycleId}
        referenceYear={referenceYear}
        canMaterialize={canMaterialize}
        payload={preliminary.payload}
        loading={preliminary.loading}
        submitting={preliminary.submitting}
        error={preliminary.error}
        message={preliminary.message}
        onRetry={() => void preliminary.reload()}
        onCalculate={(quadrimester) => void preliminary.calculate(quadrimester)}
      />

      <FamiAnnualResultCard
        referenceYear={referenceYear}
        percentage={global?.percentage}
        maturityLevel={global?.maturityLevel}
        pointsObtained={global?.pointsObtained}
        pointsPossible={global?.pointsPossible}
        consolidatedAt={data?.latestVersionMeta?.createdAt ?? global?.createdAt}
      />
    </div>
  );
}
