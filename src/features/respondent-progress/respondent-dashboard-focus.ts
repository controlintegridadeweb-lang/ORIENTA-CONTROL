import type { RespondentProgress } from "./contracts";

const STATE_PRIORITY: Record<string, number> = {
  awaiting_adjustment: 0,
  in_response: 1,
  submitted: 2,
  in_validation: 3,
  validated: 4,
};

type IndexedForm = { form: RespondentProgress; index: number };

function isDashboardCandidate(state: string): boolean {
  return state !== "completed";
}

/** Entre ciclos do mesmo formulário, prioriza o que já tem respostas. */
function pickPreferredCycle(candidates: IndexedForm[]): IndexedForm {
  return candidates.reduce((best, current) => {
    const answerDifference =
      current.form.answeredQuestions - best.form.answeredQuestions;
    if (answerDifference !== 0) {
      return answerDifference > 0 ? current : best;
    }

    const priorityDifference =
      (STATE_PRIORITY[current.form.state] ?? 99) - (STATE_PRIORITY[best.form.state] ?? 99);
    if (priorityDifference !== 0) {
      return priorityDifference < 0 ? current : best;
    }

    return current.index < best.index ? current : best;
  });
}

/**
 * Um ciclo por formulário: preferindo o que tem respostas.
 * Omite apenas ciclos encerrados (`completed`).
 */
export function preferRespondentFormsByAnswers(
  forms: readonly RespondentProgress[],
): RespondentProgress[] {
  const indexed = forms
    .map((form, index) => ({ form, index }))
    .filter(({ form }) => isDashboardCandidate(form.state));

  const byFormId = new Map<string, IndexedForm[]>();
  for (const item of indexed) {
    const group = byFormId.get(item.form.formId) ?? [];
    group.push(item);
    byFormId.set(item.form.formId, group);
  }

  return [...byFormId.values()]
    .map(pickPreferredCycle)
    .sort((left, right) => left.index - right.index)
    .map(({ form }) => form);
}

/**
 * Mantém o dashboard sem cards redundantes do mesmo formulário:
 * escolhe o ciclo com respostas (ou a próxima ação) e omite o histórico encerrado.
 */
export function selectDashboardForms(
  forms: readonly RespondentProgress[],
  limit = 5,
): RespondentProgress[] {
  if (limit <= 0) return [];

  return preferRespondentFormsByAnswers(forms)
    .map((form, index) => ({ form, index }))
    .sort((left, right) => {
      const priorityDifference =
        (STATE_PRIORITY[left.form.state] ?? 99) - (STATE_PRIORITY[right.form.state] ?? 99);
      if (priorityDifference !== 0) return priorityDifference;

      const answerDifference = right.form.answeredQuestions - left.form.answeredQuestions;
      return answerDifference || left.index - right.index;
    })
    .slice(0, limit)
    .map(({ form }) => form);
}
