"use client";

import { usePagination } from "@/shared/hooks/use-pagination";
import { formSurface } from "@/shared/layout/form-surface";
import { FormQuestionCreateForm } from "./form-question-create-form";
import { FormQuestionList } from "./form-question-list";
import { WaiverEditorModal } from "./waiver-editor-modal";
import { useFormQuestionConfigurations } from "./use-form-question-configurations";
import { useFormQuestionMutations } from "./use-form-question-mutations";
import { useFormQuestionsData } from "./use-form-questions-data";
import { useQuestionWaiverEditor } from "./use-question-waiver-editor";
import type { QuestionRow } from "@/features/forms/admin-service";

type Props = {
  formId: string;
  onQuestionsChange?: (questions: QuestionRow[]) => void;
};

/** Configura enunciado, evidência, recomendação e aplicabilidade das perguntas. */
export function FormQuestionsConfigurator({
  formId,
  onQuestionsChange,
}: Props) {
  const data = useFormQuestionsData({ formId, onQuestionsChange });
  const pagination = usePagination({
    totalItems: data.questions?.length ?? 0,
  });
  const configurations = useFormQuestionConfigurations({
    formId,
    questions: data.questions,
    expandedQuestionId: data.expandedId,
    setError: data.setError,
  });
  const mutations = useFormQuestionMutations({
    formId,
    questions: data.questions,
    setQuestions: data.setQuestions,
    setExpandedId: data.setExpandedId,
    setError: data.setError,
    setPage: pagination.setPage,
    totalPages: pagination.totalPages,
    forgetConfiguration: configurations.forgetConfiguration,
  });
  const waiverEditor = useQuestionWaiverEditor({
    organizations: data.organizations,
    waiversByQuestion: data.waiversByQuestion,
    reloadWaivers: data.reloadWaivers,
  });

  return (
    <div className="space-y-6">
      {data.error ? (
        <div
          role="alert"
          aria-live="assertive"
          className={formSurface.messageError}
        >
          {data.error}
        </div>
      ) : null}

      <FormQuestionCreateForm
        catalog={data.catalog}
        onCreate={mutations.handleCreate}
        onValidationError={data.setError}
      />

      <FormQuestionList
        data={data}
        pagination={pagination}
        configurations={configurations}
        mutations={mutations}
        waiverEditor={waiverEditor}
      />

      {waiverEditor.editor ? (
        <WaiverEditorModal
          open
          questionPrompt={waiverEditor.editor.prompt}
          organizations={data.organizations}
          selectedOrgIds={waiverEditor.editor.selectedOrgIds}
          reason={waiverEditor.editor.reason}
          hasMixedReasons={waiverEditor.editor.hasMixedReasons}
          reasonTouched={waiverEditor.editor.reasonTouched}
          orgFilter={waiverEditor.organizationFilter}
          saving={waiverEditor.saving}
          onOrgFilterChange={waiverEditor.setOrganizationFilter}
          onToggleOrg={waiverEditor.toggleOrganization}
          onSelectAll={waiverEditor.selectOrganizations}
          onClearAll={waiverEditor.clearOrganizations}
          onReasonChange={waiverEditor.changeReason}
          onClose={waiverEditor.close}
          onSave={() => void waiverEditor.save()}
        />
      ) : null}
    </div>
  );
}
