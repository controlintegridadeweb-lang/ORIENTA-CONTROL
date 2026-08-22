import type { RespondentProgress } from "./contracts";
import { preferRespondentFormsByAnswers } from "./respondent-dashboard-focus";

export type RespondentDashboardSummary = {
  openForms: number;
  totalQuestions: number;
  totalAnswered: number;
  totalComplementation: number;
  progressPct: number;
};

export function computeRespondentDashboardSummary(
  forms: RespondentProgress[],
): RespondentDashboardSummary {
  const tracked = preferRespondentFormsByAnswers(forms);
  const openForms = tracked.filter(
    (form) => form.state === "in_response" || form.state === "awaiting_adjustment",
  ).length;
  const totalQuestions = tracked.reduce((acc, f) => acc + f.totalQuestions, 0);
  const totalAnswered = tracked.reduce((acc, f) => acc + f.answeredQuestions, 0);
  const totalComplementation = tracked.reduce(
    (acc, f) =>
      acc +
      Math.max(
        0,
        f.complementationRequests - f.resolvedComplementationRequests,
      ),
    0,
  );
  const progressPct =
    totalQuestions > 0 ? Math.round((totalAnswered / totalQuestions) * 100) : 0;

  return {
    openForms,
    totalQuestions,
    totalAnswered,
    totalComplementation,
    progressPct,
  };
}
