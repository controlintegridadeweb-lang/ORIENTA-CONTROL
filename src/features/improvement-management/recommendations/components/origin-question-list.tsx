import {
  RecommendationCardText,
} from "@/features/improvement-management/recommendations/components/recommendation-card-field";
import { OverviewSoftPanel } from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";
import type { SectionOriginQuestion } from "@/features/improvement-management/action-plans/section-action-plan-model";

type Props = {
  questions: readonly SectionOriginQuestion[];
  accent: string;
  soft: string;
};

export function OriginQuestionList({ questions, accent, soft }: Props) {
  if (questions.length === 0) {
    return <RecommendationCardText>—</RecommendationCardText>;
  }

  return (
    <OverviewSoftPanel padded={false} className="overflow-hidden">
      <ol className="divide-y divide-slate-200/70" role="list">
        {questions.map((question, index) => (
          <li
            key={question.id}
            className="flex gap-3 px-4 py-3.5 sm:gap-3.5 sm:px-5 sm:py-4"
            role="listitem"
          >
            <span
              aria-hidden
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums"
              style={{ backgroundColor: soft, color: accent }}
            >
              {index + 1}
            </span>
            <RecommendationCardText preWrap className="min-w-0 flex-1">
              {question.prompt || "—"}
            </RecommendationCardText>
          </li>
        ))}
      </ol>
    </OverviewSoftPanel>
  );
}
