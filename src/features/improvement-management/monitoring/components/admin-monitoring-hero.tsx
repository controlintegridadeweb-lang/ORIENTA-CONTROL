"use client";

import Link from "next/link";
import type { ImageProps } from "next/image";
import type { ReactNode } from "react";
import { Download, FileBarChart, RefreshCw } from "lucide-react";
import { IllustratedPageHero } from "@/shared/ui/components/illustrated-page-hero";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  ariaLabel: string;
  overline: string;
  title: string;
  description: string;
  image: ImageProps["src"];
  loading?: boolean;
  onRefresh: () => void;
  /** Botão CSV legado. Preferir `exportAction` para menus multi-formato. */
  onExport?: () => void;
  exportAction?: ReactNode;
  /** Atalho para o catálogo (ex.: relatórios bimestrais). */
  catalogAction?: ReactNode;
  /** Quando omitido, o botão "Gerar relatório" não é exibido. */
  reportHref?: string;
};

export function AdminMonitoringHero({
  ariaLabel,
  overline,
  title,
  description,
  image,
  loading,
  onRefresh,
  onExport,
  exportAction,
  catalogAction,
  reportHref,
}: Props) {
  return (
    <IllustratedPageHero
      theme="admin"
      ariaLabel={ariaLabel}
      overline={overline}
      title={title}
      description={description}
      image={image}
      priority
      actions={
        <>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className={`${formSurface.secondaryButtonSm} disabled:opacity-50`}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden />
            Atualizar
          </button>
          {exportAction ??
            (onExport ? (
              <button type="button" onClick={onExport} className={formSurface.secondaryButtonSm}>
                <Download className="h-3.5 w-3.5" aria-hidden />
                Exportar CSV
              </button>
            ) : null)}
          {catalogAction}
          {reportHref ? (
            <Link href={reportHref} className={formSurface.primaryButtonSm}>
              <FileBarChart className="h-3.5 w-3.5" aria-hidden />
              Gerar relatório
            </Link>
          ) : null}
        </>
      }
    />
  );
}
