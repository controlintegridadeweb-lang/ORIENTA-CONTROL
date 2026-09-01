"use client";

import { Download, RefreshCw } from "lucide-react";
import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { ADMIN_MATURIDADE_HERO_IMAGE } from "@/shared/config/page-assets/admin-maturidade-hero-image";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  loading?: boolean;
  reconciliationLoading?: boolean;
  ready?: boolean;
  reconciliationDisabled?: boolean;
  reconciliationTitle?: string;
  exportDisabled?: boolean;
  onRefresh: () => void;
  onExport: () => void;
  onReconcile: () => void;
};

export function AdminFamiMaturityHero({
  loading,
  reconciliationLoading,
  ready = true,
  reconciliationDisabled,
  reconciliationTitle,
  exportDisabled,
  onRefresh,
  onExport,
  onReconcile,
}: Props) {
  const reconciliationBlocked = !ready || reconciliationDisabled;

  return (
    <IllustratedPageHero
      theme="admin"
      ariaLabel="Resultado FAMI"
      overline="Indicadores de maturidade"
      title="Resultado FAMI"
      description="Acompanhe o Resultado FAMI oficial, o desempenho por eixo e o acompanhamento quadrimestral do plano de integridade e compliance."
      image={ADMIN_MATURIDADE_HERO_IMAGE}
      imageWidth={1024}
      imageHeight={1024}
      unoptimized
      priority
      actions={
        <>
          <button
            type="button"
            onClick={onRefresh}
            disabled={!ready || loading}
            className={`${formSurface.secondaryButtonSm} disabled:opacity-50`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            {loading ? "Atualizando…" : "Atualizar"}
          </button>
          <button
            type="button"
            onClick={onExport}
            disabled={exportDisabled}
            className={`${formSurface.secondaryButtonSm} disabled:opacity-50`}
          >
            <Download className="h-3.5 w-3.5" aria-hidden />
            Exportar CSV
          </button>
          <button
            type="button"
            onClick={onReconcile}
            disabled={reconciliationBlocked || reconciliationLoading}
            className={`${formSurface.primaryButtonSm} disabled:opacity-50`}
          >
            {reconciliationLoading ? "Conferindo…" : "Conferir FAMI"}
          </button>
        </>
      }
    >
      {reconciliationBlocked && reconciliationTitle ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-600">{reconciliationTitle}</p>
      ) : null}
    </IllustratedPageHero>
  );
}
