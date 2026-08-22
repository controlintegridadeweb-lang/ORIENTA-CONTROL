import type { AnswersSummaryQuestion } from "@/features/forms/answers-types";
import { formManagementUi } from "@/features/forms/components/form/form-management-ui";
import {
  AnswerDistributionChart,
  sumAnswerDistribution,
} from "./charts/answer-distribution-chart";

export function AnswersSummaryQuestionCard({ question }: { question: AnswersSummaryQuestion }) {
  const chartTotal = sumAnswerDistribution(question.distribution);
  const responseCount = chartTotal > 0 ? chartTotal : question.totalResponses;
  const noun = responseCount === 1 ? "resposta" : "respostas";

  return (
    <article className={formManagementUi.surface}>
      <header className="space-y-2 border-b border-slate-100 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-100 px-1.5 text-xs font-semibold text-slate-700">
            {question.orderIndex + 1}
          </span>
          <span className={formManagementUi.muted}>Sim / Não / Não se aplica</span>
          <span className={`ml-auto tabular-nums ${formManagementUi.muted}`}>
            {responseCount} {noun}
          </span>
        </div>
        <h4 className={`${formManagementUi.subsectionTitle} leading-snug`}>{question.prompt}</h4>
      </header>
      <div className="px-4 py-5 sm:px-5">
        <AnswerDistributionChart distribution={question.distribution} />
      </div>
    </article>
  );
}
