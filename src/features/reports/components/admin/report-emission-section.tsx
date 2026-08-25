import { Download } from "lucide-react";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { formSurface } from "@/shared/layout/form-surface";
import { countLabel } from "@/shared/format/count-label";
import { cycleStateLabelOrFallback } from "@/shared/domain/cycle-labels";
import { REPORT_LIFECYCLE_LABEL } from "@/shared/domain/report-lifecycle";
import { ReportCycleSelector } from "./report-cycle-selector";
import { ReportReferencePeriodEditor } from "./report-reference-period-editor";
import { ReportModeBadge } from "./report-shell-display";
import {
  REPORT_CYCLE_PAGE_SIZE,
} from "./reports-controller-model";
import type { ReportsController } from "./use-reports-controller";

export function ReportEmissionSection({ controller }: { controller: ReportsController }) {
  const {
    state,
    patch,
    selectedCycle,
    isReissue,
    canGenerate,
    loadCycles,
    selectOrganization,
    searchCycles,
    selectCycle,
    changeCyclePage,
    saveReferencePeriod,
    generate,
  } = controller;

  return (
    <>
      {state.scopeError ? (
        <AsyncErrorState
          title="Não foi possível carregar as organizações"
          message={state.scopeError}
          onRetry={controller.loadOrganizations}
          retrying={state.loadingScopes}
        />
      ) : null}

      {state.cyclesError ? (
        <AsyncErrorState
          title="Não foi possível carregar os diagnósticos"
          message={state.cyclesError}
          onRetry={async () => {
            await loadCycles(state.organizationId, state.cycleId);
          }}
          retrying={state.loadingCycles}
        />
      ) : null}

      <PanelSection
        title="Emitir PDF oficial"
        description="A primeira emissão é iniciada automaticamente no encerramento. Esta área permite acompanhar, retomar uma falha de emissão e criar reemissões auditadas sem substituir versões anteriores."
        variant="card"
        contentClassName="space-y-5"
        actions={<ReportModeBadge label="Administrativo" />}
      >
        <div className="grid gap-4 md:grid-cols-2 md:gap-5 lg:grid-cols-3">
          <div className={`min-w-0 ${formSurface.fieldGroup}`}>
            <label htmlFor="report-organization" className={formSurface.label}>Organização</label>
            <select
              id="report-organization"
              className={formSurface.inputSelect}
              value={state.organizationId}
              onChange={(event) => selectOrganization(event.target.value)}
              disabled={state.loadingScopes || state.generating}
            >
              <option value="">{state.loadingScopes ? "Carregando..." : "Selecione"}</option>
              {state.organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>{organization.name}</option>
              ))}
            </select>
          </div>

          <ReportCycleSelector
            organizationId={state.organizationId}
            cycles={state.cycles}
            cycleId={state.cycleId}
            cycleSearch={state.cycleSearch}
            cycleOffset={state.cycleOffset}
            cycleTotal={state.cycleTotal}
            cycleHasMore={state.cycleHasMore}
            pageSize={REPORT_CYCLE_PAGE_SIZE}
            loading={state.loadingCycles}
            generating={state.generating}
            onSearchChange={(cycleSearch) => patch({ cycleSearch })}
            onSearch={searchCycles}
            onSelect={selectCycle}
            onPreviousPage={() => changeCyclePage(
              Math.max(0, state.cycleOffset - REPORT_CYCLE_PAGE_SIZE),
            )}
            onNextPage={() => changeCyclePage(state.cycleOffset + REPORT_CYCLE_PAGE_SIZE)}
          />
        </div>

        {selectedCycle ? (
          <div
            className={`rounded-lg border px-3.5 py-2.5 text-sm ${
              selectedCycle.reportStatus === "emission_failed"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : selectedCycle.reportStatus === "available"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
            role="status"
          >
            <strong>{REPORT_LIFECYCLE_LABEL[selectedCycle.reportStatus]}.</strong>{" "}
            {selectedCycle.reportStatus === "emission_failed"
              ? "A avaliação permanece encerrada. Retome a emissão antes de reabrir o diagnóstico."
              : selectedCycle.reportStatus === "emitting"
                ? "O PDF oficial está sendo processado."
                : selectedCycle.reportStatus === "available"
                  ? "A primeira emissão já está preservada; uma nova emissão exige justificativa."
                  : selectedCycle.reportStatus === "ready_to_emit"
                    ? "O encerramento foi concluído, mas ainda não existe um PDF oficial vigente."
                    : "O relatório oficial ainda não está disponível para este estado do diagnóstico."}
          </div>
        ) : null}

        {selectedCycle ? (
          <ReportReferencePeriodEditor
            key={selectedCycle.cycleId}
            cycle={selectedCycle}
            disabled={state.generating || state.loadingCycles}
            onSaved={async (reference) => saveReferencePeriod(reference)}
          />
        ) : null}

        {selectedCycle && selectedCycle.cycleState !== "completed" ? (
          <p
            className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-950"
            role="status"
          >
            Situação atual: <strong>{cycleStateLabelOrFallback(selectedCycle.cycleState)}</strong>.
            Encerre a avaliação em{" "}
            <a
              href={`/admin/ciclos/${encodeURIComponent(selectedCycle.cycleId)}`}
              className="font-semibold underline underline-offset-2"
            >
              Diagnósticos
            </a>{" "}
            antes de emitir o relatório oficial.
          </p>
        ) : null}

        {isReissue ? (
          <div className="max-w-3xl rounded-xl border border-amber-200 bg-amber-50 p-4">
            <label htmlFor="report-reissue-reason" className={formSurface.label}>
              Motivo da reemissão
            </label>
            <textarea
              id="report-reissue-reason"
              className={`${formSurface.input} mt-1 min-h-20`}
              value={state.reissueReason}
              onChange={(event) => patch({ reissueReason: event.target.value })}
              maxLength={1000}
              placeholder="Ex.: correção de informação consolidada após revisão administrativa."
              disabled={state.generating}
            />
            <p className="mt-1 text-xs text-amber-800">
              {(selectedCycle?.emissionCount ?? 0) === 1
                ? "Já existe 1 emissão para este processamento."
                : `Já existem ${countLabel(selectedCycle?.emissionCount ?? 0, "emissão", "emissões")} para este processamento.`}{" "}
              A nova versão não substitui os arquivos anteriores. Informe pelo menos 3 caracteres para habilitar a emissão.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-relaxed text-slate-500">
            Formato: PDF oficial.
            {!state.cycleId
              ? " Selecione o diagnóstico para emitir."
              : isReissue && state.reissueReason.trim().length < 3
                ? " Preencha o motivo da reemissão para continuar."
                : null}
          </p>
          <button
            type="button"
            className={`${formSurface.primaryButton} w-full sm:w-auto`}
            onClick={() => void generate()}
            disabled={state.generating || state.loadingScopes || !canGenerate}
          >
            <Download className="h-4 w-4" aria-hidden />
            {state.generating
              ? "Emitindo..."
              : selectedCycle?.reportStatus === "emission_failed"
                ? "Tentar emitir novamente e baixar"
                : selectedCycle?.reportStatus === "emitting"
                  ? "Emissão em andamento…"
                  : isReissue
                    ? "Emitir nova versão e baixar"
                    : "Emitir agora e baixar"}
          </button>
        </div>
      </PanelSection>
    </>
  );
}
