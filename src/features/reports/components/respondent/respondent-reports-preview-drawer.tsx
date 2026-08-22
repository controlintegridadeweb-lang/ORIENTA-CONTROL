"use client";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { Download } from "lucide-react";
import { Drawer } from "@/shared/ui/components/drawer";
import { formSurface } from "@/shared/layout/form-surface";
import type { RespondentReportHistoryRow } from "@/features/reports/ui/respondent-presentation";
import { REPORT_KIND_META } from "@/features/reports/ui/respondent-presentation";

type Props = {
  open: boolean;
  onClose: () => void;
  row: RespondentReportHistoryRow | null;
  previewUrl: string | null;
  previewLoading: boolean;
  onDownload: () => void;
};

export function RespondentReportsPreviewDrawer({
  open,
  onClose,
  row,
  previewUrl,
  previewLoading,
  onDownload,
}: Props) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={row ? `Pré-visualização · ${row.formName}` : "Pré-visualização"}
      description="Capa e resumo do relatório oficial. O PDF completo é obtido pelo botão baixar."
      footer={
        <button
          type="button"
          className={formSurface.primaryButton}
          onClick={onDownload}
          disabled={!row || previewLoading}
        >
          <Download className="h-4 w-4" aria-hidden />
          Baixar PDF
        </button>
      }
    >
      {!row ? null : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-2xs font-semibold uppercase tracking-wider text-slate-500">
              Capa institucional
            </p>
            <p className="mt-1 text-lg font-semibold text-slate-900">Orienta · Relatório oficial</p>
            <p className="text-sm text-slate-600">{row.formName}</p>
            <p className="mt-2 text-xs text-slate-500">
              Emissão v{row.emissionVersion} · Processamento nº {row.processingVersion} · Política FAMI {row.policyVersion} ·{" "}
              {formatPlatformDateTime(row.generatedAt, { dateStyle: "short", timeStyle: "short" })}
            </p>
          </div>
          <div className="space-y-1 text-sm">
            <p>
              <span className="text-slate-500">Tipo:</span>{" "}
              <strong>{REPORT_KIND_META[row.reportKind].label}</strong>
            </p>
            <p>
              <span className="text-slate-500">Formato:</span> <strong>PDF</strong>
            </p>
            <p>
              <span className="text-slate-500">Gerado por:</span>{" "}
              <strong>{row.generatedByLabel}</strong>
            </p>
            <p>
              <span className="text-slate-500">Identificador:</span>{" "}
              <strong className="font-mono text-xs">{row.id}</strong>
            </p>
            {row.fileSha256 ? (
              <p>
                <span className="text-slate-500">SHA-256:</span>{" "}
                <strong className="font-mono text-xs">{row.fileSha256}</strong>
              </p>
            ) : null}
            {row.outdatedReason ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                {row.outdatedReason}
              </p>
            ) : null}
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            {previewLoading ? (
              <div className="flex h-64 items-center justify-center text-sm text-slate-500">
                Carregando PDF…
              </div>
            ) : previewUrl ? (
              <iframe
                title="Pré-visualização PDF"
                src={previewUrl}
                className="h-[min(70vh,90dvh)] w-full min-h-80"
              />
            ) : (
              <div className="px-4 py-8 text-center text-xs text-slate-500">
                Não foi possível carregar a pré-visualização.
              </div>
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
