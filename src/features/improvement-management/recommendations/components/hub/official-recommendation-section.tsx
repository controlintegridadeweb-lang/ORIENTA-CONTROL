"use client";

import { ClipboardCopy } from "lucide-react";
import { notify } from "@/infrastructure/notifications/notify";
import { getAxisTheme } from "@/shared/theme/axis-theme";
import {
  OverviewBlockTitle,
  OverviewSoftPanel,
  RecommendationCardText,
  overviewStack,
} from "./overview-section-primitives";

type Props = {
  recommendationText: string;
  axisName?: string;
};

export function OfficialRecommendationSection({
  recommendationText,
  axisName,
}: Props) {
  const text = recommendationText.trim() || "(sem texto)";
  const theme = getAxisTheme(axisName);

  async function copyRecommendation() {
    try {
      await navigator.clipboard.writeText(recommendationText);
      notify.success("Texto copiado.");
    } catch {
      notify.error("Não foi possível copiar.");
    }
  }

  return (
    <section aria-labelledby="rec-official-heading" className={overviewStack}>
      <OverviewBlockTitle
        id="rec-official-heading"
        title="Recomendação"
        description="Texto institucional a ser executado pela organização."
      />

      <OverviewSoftPanel className="space-y-4">
        <div
          className="rounded-lg px-3.5 py-3 sm:px-4 sm:py-3.5"
          style={{ backgroundColor: theme.primary }}
        >
          <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed text-white">
            {text}
          </p>
        </div>

        <RecommendationCardText variant="body">
          <span className="font-semibold text-slate-900">Impacto futuro:</span>{" "}
          a implementação desta recomendação poderá contribuir para avaliações
          posteriores, sem alterar o resultado FAMI já consolidado.
        </RecommendationCardText>

        <div>
          <button
            type="button"
            className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => void copyRecommendation()}
          >
            <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />
            Copiar
          </button>
        </div>
      </OverviewSoftPanel>
    </section>
  );
}
