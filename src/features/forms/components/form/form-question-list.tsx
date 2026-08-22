import { ListChecks } from "lucide-react";
import { Spinner } from "@/shared/ui/components/loading";
import { Pagination } from "@/shared/ui/components/pagination";
import type { usePagination } from "@/shared/hooks/use-pagination";
import type { QuestionRow } from "@/features/forms/admin-service";
import { formSurface } from "@/shared/layout/form-surface";
import { FormQuestionCard } from "./form-question-card";
import type { FormQuestionsData } from "./use-form-questions-data";
import type { useFormQuestionConfigurations } from "./use-form-question-configurations";
import type { useFormQuestionMutations } from "./use-form-question-mutations";
import type { useQuestionWaiverEditor } from "./use-question-waiver-editor";

type PaginationController = ReturnType<typeof usePagination>;
type ConfigurationController = ReturnType<
  typeof useFormQuestionConfigurations
>;
type MutationController = ReturnType<typeof useFormQuestionMutations>;
type WaiverController = ReturnType<typeof useQuestionWaiverEditor>;

export function FormQuestionList({
  data,
  pagination,
  configurations,
  mutations,
  waiverEditor,
}: {
  data: FormQuestionsData;
  pagination: PaginationController;
  configurations: ConfigurationController;
  mutations: MutationController;
  waiverEditor: WaiverController;
}) {
  const { questions } = data;

  if (questions === null) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
        <Spinner size="xl" className="text-brand" />
        <p className="text-sm font-medium text-slate-700">
          Carregando perguntas…
        </p>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className={formSurface.empty.container}>
        <span className={formSurface.empty.iconWrap}>
          <ListChecks className="h-5 w-5" aria-hidden />
        </span>
        <p className={formSurface.empty.title}>Nenhuma pergunta ainda</p>
        <p className={formSurface.empty.description}>
          Use o campo acima para adicionar o primeiro enunciado.
        </p>
      </div>
    );
  }

  return (
    <>
      <ol className="space-y-3" aria-label="Lista de perguntas">
        {pagination.pageItems(questions).map((question, localIndex) => (
          <QuestionListItem
            key={question.id}
            question={question}
            index={pagination.startIndex + localIndex}
            total={questions.length}
            data={data}
            configurations={configurations}
            mutations={mutations}
            waiverEditor={waiverEditor}
          />
        ))}
      </ol>
      <Pagination
        pagination={pagination}
        resultLabel={{ singular: "pergunta", plural: "perguntas" }}
        variant="bare"
        className="pt-2"
      />
    </>
  );
}

function QuestionListItem({
  question,
  index,
  total,
  data,
  configurations,
  mutations,
  waiverEditor,
}: {
  question: QuestionRow;
  index: number;
  total: number;
  data: FormQuestionsData;
  configurations: ConfigurationController;
  mutations: MutationController;
  waiverEditor: WaiverController;
}) {
  const configuration = configurations.configByQuestion[question.id];

  return (
    <FormQuestionCard
      question={question}
      index={index}
      total={total}
      isOpen={data.expandedId === question.id}
      isBusy={mutations.busyId === question.id}
      editing={mutations.editingId === question.id}
      draft={mutations.draft}
      configuration={configuration}
      isLoaded={configurations.loadedConfigIds.has(question.id)}
      isLoading={configurations.loadingConfigId === question.id}
      hasLoadError={configurations.failedConfigIds.has(question.id)}
      savingConfig={configurations.savingConfigId === question.id}
      catalog={data.catalog}
      organizations={data.organizations}
      waiversByQuestion={data.waiversByQuestion}
      orgsLoading={data.orgsLoading}
      onToggleOpen={() =>
        data.setExpandedId(
          data.expandedId === question.id ? null : question.id,
        )
      }
      onMoveUp={() => void mutations.handleMove(question, "up")}
      onMoveDown={() => void mutations.handleMove(question, "down")}
      onDraftChange={mutations.setDraft}
      onCancelEdit={mutations.cancelEditing}
      onSavePrompt={() => void mutations.handleSavePrompt(question)}
      onStartEdit={() => mutations.startEditing(question)}
      onRemove={() => void mutations.handleRemove(question)}
      onToggleEvidence={(checked) =>
        void mutations.handleToggleEvidence(question, checked)
      }
      onToggleAllowsNotApplicable={(checked) =>
        void mutations.handleToggleAllowsNotApplicable(question, checked)
      }
      onSectionChange={(sectionId) => {
        if (!configuration) return;
        configurations.changeSection(question.id, sectionId, configuration);
      }}
      onRecommendationChange={(textoBaseFixo) => {
        if (!configuration) return;
        configurations.changeRecommendation(
          question.id,
          question.prompt,
          configuration,
          textoBaseFixo,
        );
      }}
      onRetryConfiguration={() =>
        void configurations.retryConfiguration(question)
      }
      onSaveConfiguration={() =>
        void configurations.saveConfiguration(question.id)
      }
      onOpenWaiverEditor={() => waiverEditor.open(question)}
    />
  );
}
