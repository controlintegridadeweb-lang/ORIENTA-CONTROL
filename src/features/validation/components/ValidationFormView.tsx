"use client";

import { typography } from "@/shared/layout/design-system";

import Link from "next/link";
import { PageHeader } from "@/shared/ui/components/page-header";
import type { UnifiedFormCriterion } from "../contracts";
import type {
  FormViewSummary,
  QueueSituationFilter,
} from "../form-view-model";
import type { ValidationPageSize } from "../pagination";
import {
  ALL_SECTIONS_PARAM,
  type QueueProgress,
  type QueueSectionSummary,
} from "../queue-model";
import { ValidationFormSummary } from "./ValidationFormSummary";
import { ValidationQueueFilters } from "./ValidationFormFilters";
import { ValidationSectionNavigation } from "./ValidationSectionNavigation";
import { ValidationQueuePagination } from "./ValidationQueuePagination";
import { ValidationQueueTransitionActions } from "./ValidationQueueTransitionActions";
import { ValidationBatchActions } from "./ValidationBatchActions";
import { ValidationCriterionList } from "./ValidationCriterionList";
import {
  useValidationWorkspaceController,
  type ValidationWorkspaceCallbacks,
} from "./useValidationWorkspaceController";
import {
  ValidationDraftAutosaveProvider,
  useValidationDraftAutosave,
} from "./validation-draft-autosave-context";
import { formSurface } from "@/shared/layout/form-surface";
import { countLabel } from "@/shared/format/count-label";

export type ValidationFormViewProps = ValidationWorkspaceCallbacks & {
  cycleId: string;
  organizationName: string;
  formName: string;
  periodLabel: string;
  returnTo?: string | null;
  targetEvidenceId?: string | null;
  initialCriteria: UnifiedFormCriterion[];
  formSummary: FormViewSummary;
  formSections: QueueSectionSummary[];
  validationReopened?: boolean;
  pagination: {
    page: number;
    pageSize: ValidationPageSize;
    totalItems: number;
    sectionId: string | null;
    axisId: string | null;
    queueSituation: QueueSituationFilter;
    search: string;
  };
  progress: QueueProgress;
};

/** Fila operacional: exibe somente critérios que podem exigir decisão. */
export function ValidationFormView(props: ValidationFormViewProps) {
  return (
    <ValidationDraftAutosaveProvider cycleId={props.cycleId}>
      <ValidationFormViewInner {...props} />
    </ValidationDraftAutosaveProvider>
  );
}

function ValidationFormViewInner(props: ValidationFormViewProps) {
  const draftAutosave = useValidationDraftAutosave();
  const workspace = useValidationWorkspaceController({
    ...props,
    flushPendingAutosave: draftAutosave.flushAll,
    hasUnconfirmedAutosave: draftAutosave.hasUnconfirmedAutosave,
  });
  const {
    criteria,
    selectedSection,
    selectedSectionId,
    totalItems,
    queueLocked,
  } = workspace;

  return (
    <div className="flex flex-col gap-5" aria-busy={queueLocked}>
      <PageHeader
        title="Validação do diagnóstico"
        description={
          "Analise somente os critérios que exigem decisão administrativa. " +
          "Use o formulário completo para consultar todas as respostas."
        }
        actions={
          <Link
            href={workspace.cycleHref}
            className={formSurface.secondaryButtonSm}
          >
            ← Voltar ao diagnóstico
          </Link>
        }
      />
      <CycleContext
        organizationName={props.organizationName}
        formName={props.formName}
        periodLabel={props.periodLabel}
      />
      {props.validationReopened ? <ValidationReopenedNotice /> : null}
      <ValidationFormSummary summary={props.formSummary} />

      <ValidationQueueFilters
        situation={workspace.queueSituation}
        search={workspace.searchDraft}
        onSituationChange={(value) =>
          workspace.replaceParams({ queueSituation: value, resetPage: true })
        }
        onSearchChange={workspace.setSearchDraft}
        fullFormHref={workspace.fullFormHref}
        sectionNavigation={
          <ValidationSectionNavigation
            compact
            groups={workspace.sectionNav.groups}
            sections={workspace.sectionNav.sections}
            totalPending={workspace.sectionNav.totalPending}
            totalCount={workspace.sectionNav.total}
            selectedAxisId={workspace.selectedAxisId}
            selectedSectionId={selectedSectionId}
            onSelectAxis={(axisId) =>
              workspace.replaceParams({
                axisId,
                resetPage: true,
              })
            }
            onSelect={(sectionId) =>
              workspace.replaceParams({
                sectionId:
                  sectionId === ALL_SECTIONS_PARAM ? null : sectionId,
                resetPage: true,
              })
            }
          />
        }
        toolbarStart={
          <BatchSelectionStatus
            batchMode={workspace.batchMode}
            selectedCount={workspace.selectedCount}
            situationLabel={workspace.queueSituationLabel}
          />
        }
        toolbarActions={
          <button
            type="button"
            disabled={queueLocked}
            onClick={workspace.toggleBatchMode}
            className={`${formSurface.secondaryButtonSm} shrink-0`}
          >
            {workspace.batchMode
              ? "Encerrar seleção em lote"
              : "Selecionar em lote"}
          </button>
        }
      />

      {workspace.batchMode ? (
        <ValidationBatchActions
          selectedCount={workspace.selectedCount}
          options={workspace.batchSelection.options}
          pending={workspace.batchPending}
          error={workspace.batchError}
          onApply={workspace.applyBatch}
          onClear={workspace.clearBatchSelection}
        />
      ) : null}

      <div className="min-w-0 space-y-4">
        <SectionHeading
          title={selectedSection?.title ?? "Todas as seções"}
          axisName={selectedSection?.axisName ?? null}
          totalItems={totalItems}
        />

        <ValidationCriterionList
          criteria={criteria}
          progress={props.progress}
          queueSituation={workspace.queueSituation}
          batchMode={workspace.batchMode}
          selectedEvidenceIds={workspace.selectedEvidenceIds}
          selectedNaIds={workspace.selectedNaIds}
          selectedSectionId={selectedSectionId}
          targetEvidenceId={workspace.targetEvidenceId}
          disabled={queueLocked}
          isBatchSelectable={workspace.isCriterionBatchSelectable}
          onToggleSelection={workspace.toggleCriterionSelection}
          onClearFilters={workspace.clearFilters}
          onVerdict={workspace.handleVerdict}
          onNaVerdict={workspace.handleNaVerdict}
          onMarkAdminNotApplicable={workspace.handleMarkAdminNotApplicable}
          onAbsentProofDecision={workspace.handleAbsentProofDecision}
          onRevertAdminNotApplicable={
            workspace.handleRevertAdminNotApplicable
          }
        />

        <ValidationQueuePagination
          page={workspace.safePage}
          pageSize={workspace.pageSize}
          totalItems={totalItems}
          pageItemCount={criteria.length}
          onPageChange={(page) => workspace.replaceParams({ page })}
        />
      </div>

      <ValidationQueueTransitionActions
        progress={props.progress}
        dispatchingAdjustments={workspace.dispatchingAdjustments}
        adjustmentDispatchError={workspace.adjustmentDispatchError}
        consolidating={workspace.consolidating}
        consolidationError={workspace.consolidationError}
        itemOrBatchPending={workspace.itemPending || workspace.batchPending}
        onDispatchAdjustments={() =>
          void workspace.handleDispatchAdjustments()
        }
        onConsolidate={() => void workspace.handleConsolidate()}
      />
    </div>
  );
}

function CycleContext({
  organizationName,
  formName,
  periodLabel,
}: {
  organizationName: string;
  formName: string;
  periodLabel: string;
}) {
  return (
    <dl
      className={
        "-mt-2 mb-1 grid gap-3 border-b border-slate-200 pb-5 " +
        "text-sm text-slate-500 sm:-mt-4 sm:mb-2 sm:grid-cols-3 sm:pb-6"
      }
    >
      {[
        ["Organização", organizationName],
        ["Diagnóstico", formName],
        ["Período", periodLabel],
      ].map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </dt>
          <dd className="mt-0.5 text-slate-700">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ValidationReopenedNotice() {
  return (
    <div
      role="status"
      className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p className="font-medium">Validação reaberta.</p>
      <p className="mt-1 text-amber-900">
        Revise a fila. Um novo Resultado FAMI será gerado após a conclusão desta
        rodada.
      </p>
    </div>
  );
}

function BatchSelectionStatus({
  batchMode,
  selectedCount,
  situationLabel,
}: {
  batchMode: boolean;
  selectedCount: number;
  situationLabel: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm text-slate-600">Situação: {situationLabel}</p>
      {batchMode ? (
        <p className="text-sm text-slate-600" role="note">
          Selecione critérios do mesmo tipo de decisão.
          {selectedCount > 0 ? ` ${selectedCount} selecionado(s).` : ""}
        </p>
      ) : null}
    </div>
  );
}

function SectionHeading({
  title,
  axisName,
  totalItems,
}: {
  title: string;
  axisName: string | null;
  totalItems: number;
}) {
  return (
    <div className="space-y-2">
      <h2 className={typography.sectionTitle}>{title}</h2>
      <p className="text-sm text-slate-500">
        {axisName ? `${axisName} · ` : ""}
        {countLabel(totalItems, "critério na fila", "critérios na fila")}
      </p>
    </div>
  );
}
