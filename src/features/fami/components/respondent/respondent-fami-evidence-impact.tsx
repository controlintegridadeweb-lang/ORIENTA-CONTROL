"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { countLabel } from "@/shared/format/count-label";
import { PanelSection } from "@/shared/ui/components/panel-section";
import type { RespondentStatsResult } from "@/features/evidences";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  stats: RespondentStatsResult | null;
  evidencesLink?: string;
};

function buildSummary(stats: RespondentStatsResult): string {
  const pending = stats.aguardando + stats.complementacao;
  if (pending === 0 && stats.reprovadas === 0) {
    return stats.aprovadas > 0
      ? `${countLabel(stats.aprovadas, "evidência aprovada", "evidências aprovadas")}. Sem pendências.`
      : "As evidências estão sem pendências no acompanhamento atual.";
  }
  if (stats.reprovadas > 0 && pending === 0) {
    return `${countLabel(stats.reprovadas, "evidência não aprovada precisa", "evidências não aprovadas precisam")} de revisão.`;
  }
  if (pending > 0 && stats.reprovadas === 0) {
    return pending === 1
      ? "1 evidência aguarda validação ou ajuste."
      : `${countLabel(pending, "evidência aguarda", "evidências aguardam")} validação ou ajuste.`;
  }
  return `${countLabel(pending, "evidência pendente", "evidências pendentes")} e ${countLabel(stats.reprovadas, "não aprovada", "não aprovadas")}.`;
}

/** Linha compacta no Panorama FAMI — detalhe fica na tela de evidências. */
export function RespondentFamiEvidenceImpact({
  stats,
  evidencesLink = "/respondente/evidencias",
}: Props) {
  if (!stats) {
    return (
      <section className={formSurface.empty.container}>
        <p className={formSurface.empty.description}>
          Estatísticas de evidências indisponíveis no momento.
        </p>
      </section>
    );
  }

  return (
    <PanelSection
      title="Evidências"
      description={buildSummary(stats)}
      variant="plain"
      size="compact"
      actions={
        <Link href={evidencesLink} className={formSurface.secondaryButtonSm}>
          Abrir evidências
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      }
    />
  );
}
