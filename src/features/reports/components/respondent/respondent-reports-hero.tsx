"use client";

import { History, RefreshCw } from "lucide-react";
import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { formSurface } from "@/shared/layout/form-surface";
import { reportCatalogLabels } from "@/shared/labels/official-labels";

const HERO_IMAGE = "/assets/respondent-reports-hero.png";

type Props = {
  loading: boolean;
  onRefresh: () => void;
  onScrollHistory: () => void;
};

export function RespondentReportsHero({ loading, onRefresh, onScrollHistory }: Props) {
  return (
    <IllustratedPageHero
      theme="respondent"
      size="compact"
      ariaLabel={reportCatalogLabels.monitoringNav}
      overline="Acompanhamento da organização"
      title={reportCatalogLabels.monitoringNav}
      description={reportCatalogLabels.monitoringPageDescription}
      image={HERO_IMAGE}
      priority
      actions={
        <>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={formSurface.secondaryButtonSm}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Atualizar
          </button>
          <button type="button" onClick={onScrollHistory} className={formSurface.primaryButtonSm}>
            <History className="h-3.5 w-3.5" aria-hidden />
            Ver relatórios
          </button>
        </>
      }
    />
  );
}
