"use client";

import type { AxisMaturity } from "@/features/fami/types";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { RespondentFamiRadarChart } from "@/features/fami/components/respondent/respondent-fami-radar-chart";
import { FAMI_SECTION_STACK } from "../fami-maturity-helpers";

type Props = {
  axes: AxisMaturity[];
};

/** Visão por eixo: radar relativo do processamento selecionado. */
export function FamiEixosTab({ axes }: Props) {
  return (
    <div className={FAMI_SECTION_STACK}>
      <PanelSection
        title="Maturidade por eixo"
        description="Forma relativa dos eixos no processamento selecionado."
        variant="card"
        contentClassName="space-y-6"
      >
        <div className="mx-auto min-h-88 max-w-3xl">
          <RespondentFamiRadarChart embedded axes={axes} title="Radar de eixos" />
        </div>
      </PanelSection>
    </div>
  );
}
