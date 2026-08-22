import { CheckCircle2, FileArchive, LockKeyhole } from "lucide-react";
import { LoadingButton } from "@/shared/ui/components/loading";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { formSurface } from "@/shared/layout/form-surface";

export type CycleBulkAction = "finalize_validation" | "close_cycle" | "reports";

function actionDescription(action: CycleBulkAction): string {
  if (action === "finalize_validation") return "conclusão das validações prontas";
  if (action === "close_cycle") return "encerramento das avaliações aptas";
  return "geração do pacote de relatórios";
}

export function CycleBulkActions({
  visibleCount,
  validationCount,
  finalizationCount,
  closingCount,
  reportsCount,
  pendingAction,
  pendingCount,
  running,
  result,
  onSelect,
  onConfirm,
  onCancel,
}: {
  visibleCount: number;
  validationCount: number;
  finalizationCount: number;
  closingCount: number;
  reportsCount: number;
  pendingAction: CycleBulkAction | null;
  pendingCount: number;
  running: boolean;
  result: string | null;
  onSelect(action: CycleBulkAction): void;
  onConfirm(): void | Promise<void>;
  onCancel(): void;
}) {
  return (
    <PanelSection
      title="Operações em lote"
      description={`O lote considera os ${visibleCount} órgãos visíveis; a conclusão usa somente diagnósticos prontos.`}
      variant="plain"
    >
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" aria-label="Operações em lote">
        {validationCount > 0 ? (
          <dl className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
            <div className="flex items-baseline gap-1.5">
              <dt>Em validação:</dt>
              <dd className="font-semibold text-slate-900">{validationCount}</dd>
            </div>
            <div className="flex items-baseline gap-1.5">
              <dt>Prontos para concluir:</dt>
              <dd className="font-semibold text-slate-900">{finalizationCount}</dd>
            </div>
          </dl>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={finalizationCount === 0 || running}
            onClick={() => onSelect("finalize_validation")}
            className={`${formSurface.secondaryButtonSm} gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Concluir validações prontas ({finalizationCount})
          </button>
          <button
            type="button"
            disabled={closingCount === 0 || running}
            onClick={() => onSelect("close_cycle")}
            className={`${formSurface.secondaryButtonSm} gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <LockKeyhole className="h-4 w-4" aria-hidden />
            Encerrar avaliações ({closingCount})
          </button>
          <button
            type="button"
            disabled={reportsCount === 0 || running}
            onClick={() => onSelect("reports")}
            className={`${formSurface.secondaryButtonSm} gap-1.5 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <FileArchive className="h-4 w-4" aria-hidden />
            Baixar relatórios ({reportsCount})
          </button>
        </div>
        {pendingAction ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-950">
              Confirmar {actionDescription(pendingAction)} para {pendingCount} órgão(s)?
            </p>
            <div className="mt-3 flex gap-2">
              <LoadingButton
                type="button"
                pending={running}
                onClick={() => void onConfirm()}
                className={formSurface.primaryButton}
              >
                Confirmar operação
              </LoadingButton>
              <button
                type="button"
                disabled={running}
                onClick={onCancel}
                className={formSurface.secondaryButton}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : null}
        {result ? (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{result}</p>
        ) : null}
      </section>
    </PanelSection>
  );
}
