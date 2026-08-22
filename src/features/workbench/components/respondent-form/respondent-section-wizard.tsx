"use client";

import {
  RespondentSectionQuestions,
  type RespondentSectionGroup,
  type RespondentQuestionInteractionProps,
} from "./respondent-question-panel";
type Props = RespondentQuestionInteractionProps & {
  groupedBySection: RespondentSectionGroup[];
  currentSectionIndex: number;
  stepDirection: "forward" | "back";
};
export function RespondentSectionWizard({
  groupedBySection,
  currentSectionIndex,
  stepDirection,
  evidenceDrafts,
  pendingYesQuestionIds,
  readOnly,
  ...questionProps
}: Props) {
  const sectionTotal = groupedBySection.length;
  const safeIndex = Math.min(Math.max(0, currentSectionIndex), Math.max(0, sectionTotal - 1));
  const section = groupedBySection[safeIndex];

  if (!section || sectionTotal === 0) return null;

  const stepLabel = `Seção ${safeIndex + 1} de ${sectionTotal}`;
  const stepAnim = stepDirection === "back" ? "form-step-enter-back" : "form-step-enter-forward";

  return (
    <div key={safeIndex} className={stepAnim}>
      <RespondentSectionQuestions
        section={section}
        sectionIndex={safeIndex}
        stepLabel={stepLabel}
        evidenceDrafts={evidenceDrafts}
        pendingYesQuestionIds={pendingYesQuestionIds}
        readOnly={readOnly}
        {...questionProps}
      />
    </div>
  );
}
