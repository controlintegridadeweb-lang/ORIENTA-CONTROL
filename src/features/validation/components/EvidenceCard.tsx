"use client";

import { useState } from "react";
import type {
  AbsentProofDecisionAction,
  EvidenceDecisionAction,
} from "../contracts";
import type { QueueEvidenceGroup } from "../queue-model";
import { AbsentProofDecisionPanel } from "./AbsentProofDecisionPanel";
import { AdminNotApplicableDecision } from "./AdminNotApplicableDecision";
import {
  CriterionAdministrativeDecisionSection,
  CriterionAnalysisState,
  CriterionEvidenceEmptyState,
  CriterionEvidenceSection,
  CriterionHeader,
  CriterionResponseSection,
  CriterionSectionDivider,
  criterionSection,
} from "./criterion-card-sections";
import { EvidenceDocumentDecisionRow } from "./EvidenceDocumentDecisionRow";
import { formSurface } from "@/shared/layout/form-surface";

export function EvidenceCard({
  group,
  onVerdict,
  onMarkAdminNotApplicable,
  onAbsentProofDecision,
  canRequestProof = false,
  disabled = false,
  showSectionContext = true,
  highlightedEvidenceId = null,
}: {
  group: QueueEvidenceGroup;
  onVerdict: (
    evidenceId: string,
    action: EvidenceDecisionAction,
    justification: string,
  ) => Promise<void>;
  onMarkAdminNotApplicable?: (
    responseId: string,
    justification: string,
  ) => Promise<void>;
  onAbsentProofDecision?: (
    responseId: string,
    action: AbsentProofDecisionAction,
    observation: string,
  ) => Promise<void>;
  canRequestProof?: boolean;
  disabled?: boolean;
  showSectionContext?: boolean;
  highlightedEvidenceId?: string | null;
}) {
  const [changingAbsentDecision, setChangingAbsentDecision] = useState(false);
  const hasDocuments = group.documents.length > 0;
  const absentDecided =
    !hasDocuments &&
    (group.status === "validated_without_proof" ||
      group.status === "proof_requested" ||
      group.status === "considered_insufficient");

  const canShowAdminNotApplicable =
    Boolean(group.allowsNotApplicable) &&
    Boolean(onMarkAdminNotApplicable) &&
    !disabled;

  const canShowAbsentProofActions =
    !hasDocuments && Boolean(onAbsentProofDecision);

  const hasAdministrativeActions =
    canShowAdminNotApplicable || canShowAbsentProofActions;

  return (
    <article
      className={`overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/40 p-4 shadow-card sm:p-5 ${criterionSection.stack}`}
    >
      <CriterionHeader
        group={group}
        showSectionContext={showSectionContext}
      />

      <CriterionSectionDivider />

      <CriterionResponseSection group={group} />

      <CriterionSectionDivider />

      <CriterionEvidenceSection
        responseId={group.responseId}
        evidenceCount={group.documents.length}
      >
        {hasDocuments ? (
          <ul className="space-y-3">
            {group.documents.map((document) => (
              <li key={document.id}>
                <EvidenceDocumentDecisionRow
                  document={document}
                  onVerdict={onVerdict}
                  disabled={disabled}
                  highlighted={document.id === highlightedEvidenceId}
                />
              </li>
            ))}
          </ul>
        ) : (
          <CriterionEvidenceEmptyState />
        )}
      </CriterionEvidenceSection>

      <CriterionSectionDivider />

      <CriterionAnalysisState group={group} />

      <CriterionSectionDivider />

      <CriterionAdministrativeDecisionSection
        responseId={group.responseId}
        empty={!hasAdministrativeActions}
      >
        {canShowAbsentProofActions ? (
          <>
            {absentDecided &&
            !changingAbsentDecision &&
            onAbsentProofDecision &&
            !disabled ? (
              <button
                type="button"
                onClick={() => setChangingAbsentDecision(true)}
                className={formSurface.secondaryButtonSm}
              >
                Alterar decisão
              </button>
            ) : null}
            <AbsentProofDecisionPanel
              group={group}
              disabled={disabled}
              changingDecision={changingAbsentDecision}
              onChangingDecisionChange={setChangingAbsentDecision}
              onAbsentProofDecision={onAbsentProofDecision}
              canRequestProof={canRequestProof}
            />
          </>
        ) : null}

        {canShowAdminNotApplicable && onMarkAdminNotApplicable ? (
          <div className="space-y-2 border-t border-dashed border-slate-300 pt-3">
            <p className="text-xs leading-relaxed text-slate-500">
              A resposta original será preservada no histórico.
            </p>
            <AdminNotApplicableDecision
              context={{
                responseId: group.responseId,
                questionPrompt: group.questionPrompt,
                answer: group.answer,
                documents: group.documents,
              }}
              onSubmit={onMarkAdminNotApplicable}
              disabled={disabled}
            />
          </div>
        ) : null}
      </CriterionAdministrativeDecisionSection>
    </article>
  );
}
