"use client";

import { Download } from "lucide-react";
import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { RefreshActionButton } from "@/shared/ui/components/refresh-action-button";
import { formSurface } from "@/shared/layout/form-surface";

/** Mesma ilustração institucional do Resultado FAMI (admin/respondente). */
const HERO_IMAGE = "/assets/admin-maturidade-medal.png";

type Props = {
  onRefresh: () => void;
  refreshing: boolean;
  onExport: () => void;
  exportDisabled?: boolean;
};

export function RespondentFamiHero({
  onRefresh,
  refreshing,
  onExport,
  exportDisabled,
}: Props) {
  return (
    <IllustratedPageHero
      theme="respondent"
      size="compact"
      ariaLabel="Resultado FAMI"
      overline="Indicadores de maturidade"
      title="Resultado FAMI"
      description="Pontuação e nível oficiais do diagnóstico, com leitura por eixo, seção, evolução e acompanhamento quadrimestral."
      image={HERO_IMAGE}
      imageWidth={1024}
      imageHeight={1024}
      unoptimized
      priority
      actions={
        <>
          <RefreshActionButton onRefresh={onRefresh} refreshing={refreshing} />
          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled || refreshing}
            className={`${formSurface.secondaryButtonSm} disabled:opacity-50`}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Exportar
          </button>
        </>
      }
    />
  );
}
