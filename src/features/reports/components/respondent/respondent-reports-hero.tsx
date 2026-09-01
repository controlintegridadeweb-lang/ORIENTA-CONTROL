"use client";

import { History, RefreshCw } from "lucide-react";
import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { formSurface } from "@/shared/layout/form-surface";

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
      ariaLabel="Relatórios"
      overline="Documentos da organização"
      title="Relatórios"
      description="Consulte, visualize, baixe e compartilhe os relatórios anuais e os relatórios bimestrais gerados para sua organização."
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
            Histórico
          </button>
        </>
      }
    />
  );
}
