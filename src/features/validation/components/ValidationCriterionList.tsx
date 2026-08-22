"use client";

import type {
  AbsentProofDecisionAction,
  EvidenceDecisionAction,
  UnifiedFormCriterion,
} from "../contracts";
import type { QueueSituationFilter } from "../form-view-model";
import { ALL_SECTIONS_PARAM, type QueueProgress } from "../queue-model";
import { EvidenceCard } from "./EvidenceCard";
import { NotApplicableCard } from "./NotApplicableCard";
import { ReadonlyCriterionCard } from "./ReadonlyCriterionCard";
import { formSurface } from "@/shared/layout/form-surface";

export function ValidationCriterionList({
  criteria,
  progress,
  queueSituation,
  batchMode,
  selectedEvidenceIds,
  selectedNaIds,
  selectedSectionId,
  targetEvidenceId,
  disabled,
  isBatchSelectable,
  onToggleSelection,
  onClearFilters,
  onVerdict,
  onNaVerdict,
  onMarkAdminNotApplicable,
  onAbsentProofDecision,
  onRevertAdminNotApplicable,
}: {
  criteria: UnifiedFormCriterion[];
  progress: QueueProgress;
  queueSituation: QueueSituationFilter;
  batchMode: boolean;
  selectedEvidenceIds: Set<string>;
  selectedNaIds: Set<string>;
  selectedSectionId: string;
  targetEvidenceId?: string | null;
  disabled: boolean;
  isBatchSelectable: (criterion: UnifiedFormCriterion) => boolean;
  onToggleSelection: (criterion: UnifiedFormCriterion) => void;
  onClearFilters: () => void;
  onVerdict: (
    evidenceId: string,
    action: EvidenceDecisionAction,
    justification: string,
  ) => Promise<void>;
  onNaVerdict: (
    responseId: string,
    action: "approve" | "reject",
    rejectionReason: string,
  ) => Promise<void>;
  onMarkAdminNotApplicable: (
    responseId: string,
    justification: string,
  ) => Promise<void>;
  onAbsentProofDecision: (
    responseId: string,
    action: AbsentProofDecisionAction,
    observation: string,
  ) => Promise<void>;
  onRevertAdminNotApplicable: (
    responseId: string,
    justification: string,
  ) => Promise<void>;
}) {
  if (criteria.length === 0) {
    return (
      <ValidationQueueEmptyState
        progress={progress}
        queueSituation={queueSituation}
        onClearFilters={onClearFilters}
      />
    );
  }

  const showSectionContext = selectedSectionId === ALL_SECTIONS_PARAM;
  return (
    <ul className="space-y-4">
      {criteria.map((criterion) => {
        const selectable = isBatchSelectable(criterion);
        const selected =
          selectedEvidenceIds.has(criterion.responseId) ||
          selectedNaIds.has(criterion.responseId);
        return (
          <li
            key={criterion.responseId}
            id={`criterion-${criterion.responseId}`}
            tabIndex={-1}
            className={
              "scroll-mt-24 outline-none focus-visible:ring-2 " +
              "focus-visible:ring-brand-500 focus-visible:ring-offset-4"
            }
          >
            {batchMode ? (
              selectable ? (
                <label className="mb-2 flex items-center gap-2 px-1 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={disabled}
                    onChange={() => onToggleSelection(criterion)}
                  />
                  Selecionar critério
                </label>
              ) : (
                <p className="mb-2 px-1 text-xs text-slate-500">
                  Este critério exige uma decisão individual.
                </p>
              )
            ) : null}
            <CriterionStatusBanner criterion={criterion} />
            {criterion.evidenceGroup ? (
              <EvidenceCard
                group={criterion.evidenceGroup}
                disabled={disabled}
                showSectionContext={showSectionContext}
                highlightedEvidenceId={targetEvidenceId}
                onVerdict={onVerdict}
                onMarkAdminNotApplicable={onMarkAdminNotApplicable}
                onAbsentProofDecision={onAbsentProofDecision}
                canRequestProof
              />
            ) : criterion.notApplicableItem ? (
              <NotApplicableCard
                item={criterion.notApplicableItem}
                disabled={disabled}
                showSectionContext={showSectionContext}
                onVerdict={onNaVerdict}
                onRevertAdminNotApplicable={onRevertAdminNotApplicable}
              />
            ) : (
              <ReadonlyCriterionCard
                criterion={criterion}
                showSectionContext={showSectionContext}
                disabled={disabled}
                onMarkAdminNotApplicable={onMarkAdminNotApplicable}
                onAbsentProofDecision={onAbsentProofDecision}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function ValidationQueueEmptyState({
  progress,
  queueSituation,
  onClearFilters,
}: {
  progress: QueueProgress;
  queueSituation: QueueSituationFilter;
  onClearFilters: () => void;
}) {
  const pending =
    progress.pending + progress.naPending + progress.notPresented;
  if (progress.total === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
        <p className="text-sm font-medium text-emerald-950">
          Não há itens operacionais para validar.
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          O diagnóstico pode seguir para a conclusão da validação e o cálculo do FAMI.
        </p>
      </div>
    );
  }
  if (queueSituation === "pending" && pending === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
        <p className="text-sm font-medium text-emerald-950">
          Todos os critérios foram analisados.
        </p>
        <p className="mt-1 text-sm text-emerald-800">
          Revise o resumo e conclua a validação no final da página.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-700">
        Nenhum critério corresponde aos filtros selecionados.
      </p>
      <button
        type="button"
        onClick={onClearFilters}
        className={`${formSurface.secondaryButtonSm} mt-4`}
      >
        Limpar filtros
      </button>
    </div>
  );
}

function CriterionStatusBanner({
  criterion,
}: {
  criterion: UnifiedFormCriterion;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
      <span className="text-xs font-semibold tabular-nums text-slate-500">
        Critério {criterion.orderIndex + 1}
      </span>
      <span
        className={`${formSurface.badge.base} ${
          criterion.awaitsAdminAction
            ? formSurface.badge.warning
            : criterion.visualStatus === "positive_evidence_approved"
              ? formSurface.badge.success
              : formSurface.badge.neutral
        }`}
      >
        {criterion.visualStatusLabel}
      </span>
    </div>
  );
}
