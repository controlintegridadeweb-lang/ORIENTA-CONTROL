"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FileCheck2 } from "lucide-react";
import { LoadingButton } from "@/shared/ui/components/loading";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { getAutomationJob, importCsv } from "@/application/automation/client";
import type { ImportKind, ImportRowResult } from "@/application/automation/import-service";
import { formSurface } from "@/shared/layout/form-surface";
import { describeError, notify } from "@/infrastructure/notifications/notify";

const COPY: Record<ImportKind, {
  title: string;
  description: string;
  placeholder: string;
  fileLabel: string;
}> = {
  organizations: {
    title: "Importar organizações por CSV",
    description: "Use para cadastros em lote. O arquivo é validado antes de qualquer gravação.",
    placeholder: "nome;sigla\nSecretaria Exemplo;SEEX",
    fileLabel: "Arquivo de organizações",
  },
  respondents: {
    title: "Importar respondentes por CSV",
    description: "Crie contas em lote e vincule cada respondente pela sigla da organização. O acesso inicial é enviado somente após a criação consistente da conta e do perfil.",
    placeholder: "email;nome;sigla_org\nusuario@org.gov.br;Nome;SEEX",
    fileLabel: "Arquivo de respondentes",
  },
};

const IMPORT_STATUS_LABEL: Record<ImportRowResult["status"], string> = {
  valid: "Válido",
  created: "Criado",
  skipped: "Ignorado",
  failed: "Falha",
};

const JOB_STATUS_LABEL: Record<string, string> = {
  pending: "Aguardando processamento",
  processing: "Em processamento",
  completed: "Concluída",
  completed_with_errors: "Concluída com falhas",
  failed: "Falhou",
  cancelled: "Cancelada",
};

export function CsvImportPanel({ kind }: { kind: ImportKind }) {
  const router = useRouter();
  const copy = COPY[kind];
  const [csv, setCsv] = useState("");
  const [preview, setPreview] = useState<ImportRowResult[]>([]);
  const [processing, setProcessing] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const hasInvalidPreview = preview.some((item) => item.status === "failed");

  useEffect(() => {
    if (!activeJobId) return;
    const jobId = activeJobId;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      try {
        const job = await getAutomationJob(jobId);
        if (cancelled) return;
        setJobStatus(job.status);
        if (["completed", "completed_with_errors", "failed", "cancelled"].includes(job.status)) {
          if (job.results.length > 0) setPreview(job.results);
          const succeeded = Number(job.summary.succeeded ?? 0);
          const skipped = Number(job.summary.skipped ?? 0);
          const failed = Number(job.summary.failed ?? 0);
          if (job.status === "failed") {
            notify.error(job.errorMessage ?? "A importação não pôde ser concluída.");
          } else {
            notify.success(`Importação concluída: ${succeeded} criado(s), ${skipped} ignorado(s) e ${failed} com falha.`);
          }
          setActiveJobId(null);
          router.refresh();
          return;
        }
        timer = setTimeout(() => void poll(), 2000);
      } catch (caught) {
        if (cancelled) return;
        notify.error(describeError(caught, "Não foi possível acompanhar a importação."));
        setActiveJobId(null);
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [activeJobId, router]);

  async function validateFile() {
    if (!csv.trim()) {
      notify.error("Selecione um arquivo CSV ou cole o conteúdo antes de validar.");
      return;
    }
    setProcessing(true);
    try {
      const result = await importCsv({ kind, mode: "preview", csv });
      setPreview(result.results);
      notify.success(`${result.validCount ?? 0} linha(s) válida(s) para importação.`);
    } catch (caught) {
      notify.error(describeError(caught, "Não foi possível validar o arquivo."));
    } finally {
      setProcessing(false);
    }
  }

  async function confirmImport() {
    setProcessing(true);
    try {
      const result = await importCsv({ kind, mode: "commit", csv });
      setPreview(result.results);
      if (!result.jobId) throw new Error("A importação foi recebida sem identificador de acompanhamento.");
      setJobStatus(result.status ?? "pending");
      setActiveJobId(result.jobId);
      notify.info("Importação enfileirada. O andamento será atualizado nesta tela.");
    } catch (caught) {
      notify.error(describeError(caught, "Não foi possível enfileirar a importação."));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <PanelSection title={copy.title} description={copy.description} variant="plain">
      <details className={`group ${formSurface.dashboardPanel}`}>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-slate-600 [&::-webkit-details-marker]:hidden sm:px-6">
          <span>Selecionar arquivo e validar linhas</span>
          <span className="shrink-0 text-xs font-medium text-slate-500 group-open:hidden">
            Expandir
          </span>
          <span className="hidden shrink-0 text-xs font-medium text-slate-500 group-open:inline">
            Recolher
          </span>
        </summary>

        <div className="space-y-5 border-t border-slate-100 px-5 py-5 sm:px-6">
          <label className={formSurface.fieldGroup}>
            <span className={formSurface.label}>{copy.fileLabel}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800 hover:file:bg-slate-200"
              onChange={async (event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                setCsv(await file.text());
                setPreview([]);
              }}
            />
          </label>

          <label className={formSurface.fieldGroup}>
            <span className={formSurface.label}>Conteúdo para conferência</span>
            <textarea
              value={csv}
              onChange={(event) => {
                setCsv(event.target.value);
                setPreview([]);
              }}
              rows={6}
              className={`${formSurface.inputTextarea} font-mono text-xs`}
              placeholder={copy.placeholder}
            />
          </label>

          {activeJobId ? (
            <div
              className="rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900"
              role="status"
            >
              Importação em processamento. Situação atual:{" "}
              <strong>{JOB_STATUS_LABEL[jobStatus ?? "pending"] ?? "Em processamento"}</strong>.
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <LoadingButton
              pending={processing}
              type="button"
              onClick={() => void validateFile()}
              className={formSurface.secondaryButton}
            >
              <FileCheck2 className="size-4" aria-hidden />
              1. Validar arquivo
            </LoadingButton>
            <LoadingButton
              pending={processing}
              type="button"
              disabled={preview.length === 0 || hasInvalidPreview || Boolean(activeJobId)}
              onClick={() => void confirmImport()}
              className={formSurface.primaryButton}
            >
              2. Confirmar importação
            </LoadingButton>
          </div>

          {preview.length > 0 ? (
            <div className={formSurface.table.wrapper}>
              <table className={formSurface.table.table}>
                <thead className={formSurface.table.head}>
                  <tr>
                    <th className={formSurface.table.headCell}>Linha</th>
                    <th className={formSurface.table.headCell}>Identificação</th>
                    <th className={formSurface.table.headCell}>Situação</th>
                    <th className={formSurface.table.headCell}>Resultado</th>
                  </tr>
                </thead>
                <tbody className={formSurface.table.body}>
                  {preview.map((item) => (
                    <tr key={`${item.row}-${item.identity}`} className={formSurface.table.row}>
                      <td className={formSurface.table.cell}>{item.row}</td>
                      <td className={formSurface.table.cell}>{item.identity}</td>
                      <td className={formSurface.table.cell}>{IMPORT_STATUS_LABEL[item.status]}</td>
                      <td className={formSurface.table.cell}>{item.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      </details>
    </PanelSection>
  );
}
