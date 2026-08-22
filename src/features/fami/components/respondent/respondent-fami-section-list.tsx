"use client";

import { FamiSectionDetailTable } from "@/features/fami/components/fami-section-detail-table";
import type { FamiSectionSnapshot } from "@/features/fami/queries";
import { PanelSection } from "@/shared/ui/components/panel-section";

type Props = {
  sections: FamiSectionSnapshot[];
};

/** Visão por seção do respondente — mesma organização e cores do detalhamento admin. */
export function RespondentFamiSectionList({ sections }: Props) {
  return (
    <PanelSection
      title="Detalhamento por seção"
      description="Percentual, nível e pontuação de cada seção, agrupados pelo eixo do formulário."
      variant="card"
      contentClassName="overflow-hidden p-0"
    >
      <FamiSectionDetailTable sections={sections} />
    </PanelSection>
  );
}
