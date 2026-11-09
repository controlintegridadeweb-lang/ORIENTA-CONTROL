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
  bimonthlyHistoryHref?: string | null;
};

export function FamiEvolucaoTab({
  data,
  cycleId,
  referenceYear,
  canMaterialize,
  preliminary,
  bimonthlyHistoryHref,
}: Props) {
  const global = data?.snapshot?.global;
  return (
    <div className={FAMI_SECTION_STACK}>
      <PanelSection
        title="Evolução interna"
        description="Processamentos concluídos deste diagnóstico, na ordem da versão. A diferença é em pontos percentuais e não usa o ano-calendário."
        variant="card"
        contentClassName="p-5 sm:p-6"
      >
        <div className="min-h-88">
          <FamiEvolutionChart variant="versions" data={data?.evolution ?? []} />
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
        bimonthlyHistoryHref={bimonthlyHistoryHref}
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
