"use client";

import { FamiSectionDetailTable } from "@/features/fami/components/fami-section-detail-table";
import { PanelSection } from "@/shared/ui/components/panel-section";
import type { FamiSnapshotNonNull } from "../fami-maturity-helpers";

type Props = {
  snapshot: FamiSnapshotNonNull;
};

export function FamiSecoesTab({ snapshot }: Props) {
  return (
    <PanelSection
      title="Detalhamento por seção"
      description="Percentual, nível e pontuação de cada seção, agrupados pelo eixo do formulário."
      variant="card"
      contentClassName="overflow-hidden p-0"
    >
      <FamiSectionDetailTable sections={snapshot.sections} />
    </PanelSection>
  );
}
