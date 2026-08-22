"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { countLabel } from "@/shared/format/count-label";
import { formSurface } from "@/shared/layout/form-surface";
import { PanelSection } from "@/shared/ui/components/panel-section";

type Props = {
  openCount: number;
  awaitingActionCount: number;
  recommendationsLink?: string;
};

function buildSummary(openCount: number, awaitingActionCount: number): string {
  if (openCount <= 0) {
    return "Nenhuma recomendação em acompanhamento neste diagnóstico.";
  }
  if (awaitingActionCount > 0) {
    return awaitingActionCount === openCount
      ? `${countLabel(awaitingActionCount, "recomendação", "recomendações")} sem ação cadastrada.`
      : `${countLabel(openCount, "recomendação em", "recomendações em")} acompanhamento · ${awaitingActionCount} sem ação cadastrada.`;
  }
  return `${countLabel(openCount, "recomendação em", "recomendações em")} acompanhamento.`;
}

/** Linha compacta no Panorama FAMI — detalhe fica no portfólio de recomendações. */
export function RespondentFamiRecommendationsImpact({
  openCount,
  awaitingActionCount,
  recommendationsLink = "/respondente/portfolio-recomendacoes",
}: Props) {
  return (
    <PanelSection
      title="Recomendações"
      description={buildSummary(openCount, awaitingActionCount)}
      variant="plain"
      size="compact"
      actions={
        <Link href={recommendationsLink} className={formSurface.secondaryButtonSm}>
          Abrir recomendações
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      }
    />
  );
}
