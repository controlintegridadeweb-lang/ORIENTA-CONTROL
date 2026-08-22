import type { CycleState } from "@/shared/domain/types";

/**
 * Domínio de “Detalhes e gestão do formulário”.
 *
 * A aplicação administrativa é o conjunto de ciclos de um formulário × período.
 * O estado operacional agregado NÃO substitui `cycles.state` nem representa
 * exceções individuais de prazo.
 */

export type DeadlineScope =
  | "all"
  | "selected"
  | "overdue"
  | "single";

export type FormApplicationStatusKey =
  | "empty"
  | "draft"
  | "in_application"
  | "suspended"
  | "in_validation"
  | "validated"
  | "closed"
  | "mixed";

export type FormAdminActionKey =
  | "change_deadline"
  | "extend_deadline"
  | "reopen_responses"
  | "reopen_validation"
  | "early_close"
  | "suspend"
  | "resume"
  | "view_history";

export type FormAdminActionAvailability = {
  key: FormAdminActionKey;
  label: string;
  available: boolean;
  reason?: string;
};

export type FormManagementCycleInput = {
  id: string;
  organizationId: string;
  state: CycleState;
  responseDeadlineAt: string | null;
  originalResponseDeadlineAt: string | null;
  responseCollectionPausedAt: string | null;
  deadlineChangeCount: number;
  reopenCount: number;
  startsAt: string | null;
  closedAt: string | null;
};

export type FormApplicationCounts = {
  linked: number;
  filling: number;
  overdue: number;
  submitted: number;
  adjusting: number;
  validating: number;
  concluded: number;
};

export const FORM_ADMIN_ACTION_LABEL: Record<FormAdminActionKey, string> = {
  change_deadline: "Alterar prazo",
  extend_deadline: "Prorrogar prazo",
  reopen_responses: "Reabrir para respostas",
  reopen_validation: "Reabrir validação (nova rodada)",
  early_close: "Encerrar prazo antecipadamente",
  suspend: "Suspender formulário",
  resume: "Retomar formulário",
  view_history: "Visualizar histórico de alterações",
};

export const FORM_APPLICATION_STATUS_LABEL: Record<FormApplicationStatusKey, string> = {
  empty: "Sem organizações",
  draft: "Em preparação",
  in_application: "Em aplicação",
  suspended: "Suspenso",
  in_validation: "Em validação",
  validated: "Em acompanhamento",
  closed: "Encerrado",
  mixed: "Situações mistas",
};

export function isEditableResponseState(state: CycleState): boolean {
  return state === "in_response" || state === "awaiting_adjustment";
}

export function isResponseDeadlineOverdueAt(
  deadlineAt: string | null | undefined,
  state: CycleState,
  now: Date,
  pausedAt?: string | null,
): boolean {
  if (pausedAt) return false;
  if (!deadlineAt || !isEditableResponseState(state)) return false;
  const deadline = new Date(deadlineAt);
  if (Number.isNaN(deadline.getTime())) return false;
  return deadline.getTime() < now.getTime();
}

export function isExceptionalDeadline(cycle: FormManagementCycleInput): boolean {
  if (!cycle.responseDeadlineAt || !cycle.originalResponseDeadlineAt) return false;
  return cycle.responseDeadlineAt !== cycle.originalResponseDeadlineAt;
}

/** Prazo modal (mais frequente) entre os ciclos — referência do prazo global. */
export function resolveGlobalDeadline(
  cycles: FormManagementCycleInput[],
): string | null {
  const counts = new Map<string, number>();
  for (const cycle of cycles) {
    const value = cycle.originalResponseDeadlineAt ?? cycle.responseDeadlineAt;
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function hasIndividualDeadlineExceptions(
  cycles: FormManagementCycleInput[],
): boolean {
  return cycles.some((cycle) => isExceptionalDeadline(cycle));
}

function cycleApplicationStatus(
  state: CycleState,
): Exclude<FormApplicationStatusKey, "empty" | "suspended" | "mixed"> {
  if (state === "draft") return "draft";
  if (state === "in_response" || state === "awaiting_adjustment") {
    return "in_application";
  }
  if (state === "submitted" || state === "in_validation") {
    return "in_validation";
  }
  if (state === "validated") return "validated";
  return "closed";
}

export function deriveFormApplicationStatus(
  cycles: FormManagementCycleInput[],
): FormApplicationStatusKey {
  if (cycles.length === 0) return "empty";

  const pausedCount = cycles.filter((cycle) =>
    Boolean(cycle.responseCollectionPausedAt),
  ).length;
  if (pausedCount === cycles.length) return "suspended";
  if (pausedCount > 0) return "mixed";

  const statuses = new Set(
    cycles.map((cycle) => cycleApplicationStatus(cycle.state)),
  );
  return statuses.size === 1 ? [...statuses][0]! : "mixed";
}

export function countFormApplicationOrganizations(
  cycles: FormManagementCycleInput[],
  now: Date = new Date(),
): FormApplicationCounts {
  let filling = 0;
  let overdue = 0;
  let submitted = 0;
  let adjusting = 0;
  let validating = 0;
  let concluded = 0;

  for (const cycle of cycles) {
    if (cycle.state === "in_response") filling += 1;
    if (cycle.state === "awaiting_adjustment") adjusting += 1;
    if (cycle.state === "submitted") submitted += 1;
    if (cycle.state === "in_validation") validating += 1;
    if (cycle.state === "validated" || cycle.state === "completed") concluded += 1;
    if (
      isResponseDeadlineOverdueAt(
        cycle.responseDeadlineAt,
        cycle.state,
        now,
        cycle.responseCollectionPausedAt,
      )
    ) {
      overdue += 1;
    }
  }

  return {
    linked: cycles.length,
    filling,
    overdue,
    submitted,
    adjusting,
    validating,
    concluded,
  };
}

export function resolveDeadlineScopeCycleIds(input: {
  cycles: FormManagementCycleInput[];
  scope: DeadlineScope;
  organizationIds?: string[];
  now?: Date;
}): { cycleIds: string[]; error?: string } {
  const now = input.now ?? new Date();
  const { cycles, scope } = input;

  if (scope === "all") {
    const eligible = cycles.filter((cycle) => isEditableResponseState(cycle.state));
    if (eligible.length === 0) {
      return {
        cycleIds: [],
        error: "Não há organizações em preenchimento ou correção para alterar o prazo.",
      };
    }
    return { cycleIds: eligible.map((cycle) => cycle.id) };
  }

  if (scope === "overdue") {
    const eligible = cycles.filter((cycle) =>
      isResponseDeadlineOverdueAt(
        cycle.responseDeadlineAt,
        cycle.state,
        now,
        cycle.responseCollectionPausedAt,
      ),
    );
    if (eligible.length === 0) {
      return { cycleIds: [], error: "Não há organizações com prazo vencido." };
    }
    return { cycleIds: eligible.map((cycle) => cycle.id) };
  }

  const requested = new Set(input.organizationIds ?? []);
  if (requested.size === 0) {
    return {
      cycleIds: [],
      error:
        scope === "single"
          ? "Selecione a organização."
          : "Selecione ao menos uma organização.",
    };
  }

  if (scope === "single" && requested.size !== 1) {
    return { cycleIds: [], error: "Selecione exatamente uma organização." };
  }

  const matched = cycles.filter((cycle) => requested.has(cycle.organizationId));
  if (matched.length === 0) {
    return { cycleIds: [], error: "Nenhuma organização do escopo foi encontrada nesta aplicação." };
  }

  const ineligible = matched.filter((cycle) => !isEditableResponseState(cycle.state));
  if (ineligible.length > 0) {
    return {
      cycleIds: [],
      error:
        "Só é possível alterar prazo de organizações em preenchimento ou em correção. As demais exigem reabertura.",
    };
  }

  return { cycleIds: matched.map((cycle) => cycle.id) };
}

export function validateFutureDeadline(
  newDeadlineIso: string,
  now: Date = new Date(),
): string | null {
  const date = new Date(newDeadlineIso);
  if (Number.isNaN(date.getTime())) return "Informe uma data e horário válidos.";
  if (date.getTime() <= now.getTime()) {
    return "O novo prazo deve ser posterior ao momento atual.";
  }
  return null;
}

export function validateJustification(value: string, min = 10): string | null {
  const trimmed = value.trim();
  if (trimmed.length < min) {
    return `Informe uma justificativa com pelo menos ${min} caracteres.`;
  }
  if (trimmed.length > 2000) return "A justificativa deve ter no máximo 2000 caracteres.";
  return null;
}

export function buildDeadlineChangePreview(input: {
  previousDeadlines: Array<string | null>;
  newDeadlineAt: string;
  organizationCount: number;
}): string {
  const distinctPrevious = [
    ...new Set(input.previousDeadlines.filter((value): value is string => Boolean(value))),
  ];
  const fromLabel =
    distinctPrevious.length === 1
      ? distinctPrevious[0]!
      : distinctPrevious.length > 1
        ? "prazos distintos"
        : "sem prazo";
  const orgLabel =
    input.organizationCount === 1 ? "organização" : "organizações";
  return `O prazo será alterado de ${fromLabel} para ${input.newDeadlineAt} para ${input.organizationCount} ${orgLabel}.`;
}

export function resolveReopenEligibleCycles(
  cycles: FormManagementCycleInput[],
  organizationIds?: string[],
): { cycleIds: string[]; blocked: Array<{ cycleId: string; reason: string }> } {
  const filter = organizationIds?.length
    ? new Set(organizationIds)
    : null;
  const selected = filter
    ? cycles.filter((cycle) => filter.has(cycle.organizationId))
    : cycles;

  const cycleIds: string[] = [];
  const blocked: Array<{ cycleId: string; reason: string }> = [];

  for (const cycle of selected) {
    if (cycle.state === "completed") {
      cycleIds.push(cycle.id);
      continue;
    }
    if (cycle.state === "validated") {
      blocked.push({
        cycleId: cycle.id,
        reason:
          "Há Resultado FAMI concluído. Use “Reabrir validação (nova rodada)” primeiro. Depois, na fila de validação, solicite ajuste para complementação — ou encerre o acompanhamento e use “Reabrir para respostas”.",
      });
      continue;
    }
    if (isEditableResponseState(cycle.state)) {
      blocked.push({
        cycleId: cycle.id,
        reason:
          "A organização já pode responder. Use Alterar/Prorrogar prazo se precisar só estender o prazo.",
      });
      continue;
    }
    blocked.push({
      cycleId: cycle.id,
      reason: `Situação atual (${cycle.state}) não admite reabertura para respostas.`,
    });
  }

  return { cycleIds, blocked };
}

export function resolveValidationReopenEligibleCycles(
  cycles: FormManagementCycleInput[],
  organizationIds?: string[],
): { cycleIds: string[]; blocked: Array<{ cycleId: string; reason: string }> } {
  const filter = organizationIds?.length
    ? new Set(organizationIds)
    : null;
  const selected = filter
    ? cycles.filter((cycle) => filter.has(cycle.organizationId))
    : cycles;

  const cycleIds: string[] = [];
  const blocked: Array<{ cycleId: string; reason: string }> = [];

  for (const cycle of selected) {
    if (cycle.state === "validated") {
      cycleIds.push(cycle.id);
      continue;
    }
    if (cycle.state === "in_validation") {
      blocked.push({
        cycleId: cycle.id,
        reason: "A validação já está aberta neste órgão.",
      });
      continue;
    }
    if (cycle.state === "completed") {
      blocked.push({
        cycleId: cycle.id,
        reason:
          "O acompanhamento já foi encerrado. Use “Reabrir para respostas” (recoleta com nova rodada de processamento).",
      });
      continue;
    }
    blocked.push({
      cycleId: cycle.id,
      reason: "Só órgãos com validação/FAMI concluídos podem reabrir a validação.",
    });
  }

  return { cycleIds, blocked };
}

export function validatePartialReopenScope(input: {
  mode: "full" | "partial";
  questionVersionIds: string[];
}): string | null {
  if (input.mode === "full") return null;
  if (input.questionVersionIds.length === 0) {
    return "Selecione ao menos um critério para a reabertura parcial.";
  }
  return null;
}

export function listFormAdminActions(input: {
  status: FormApplicationStatusKey;
  counts: FormApplicationCounts;
  cycles: FormManagementCycleInput[];
  now?: Date;
}): FormAdminActionAvailability[] {
  const now = input.now ?? new Date();
  const hasEditable = input.cycles.some((cycle) => isEditableResponseState(cycle.state));
  const hasOverdue = input.counts.overdue > 0;
  const allPaused =
    input.cycles.length > 0 &&
    input.cycles.every((cycle) => Boolean(cycle.responseCollectionPausedAt));
  const anyPaused = input.cycles.some((cycle) => Boolean(cycle.responseCollectionPausedAt));
  const reopen = resolveReopenEligibleCycles(input.cycles);
  const validationReopen = resolveValidationReopenEligibleCycles(input.cycles);

  const actions: FormAdminActionAvailability[] = [
    {
      key: "change_deadline",
      label: FORM_ADMIN_ACTION_LABEL.change_deadline,
      available: hasEditable && !allPaused,
      reason: !hasEditable
        ? "Não há organizações em preenchimento ou correção."
        : allPaused
          ? "A coleta está suspensa. Retome o formulário antes de alterar o prazo."
          : undefined,
    },
    {
      key: "extend_deadline",
      label: FORM_ADMIN_ACTION_LABEL.extend_deadline,
      available: hasOverdue && !allPaused,
      reason: !hasOverdue
        ? "Não há organizações com prazo vencido para prorrogar."
        : allPaused
          ? "A coleta está suspensa. Retome o formulário antes de prorrogar."
          : undefined,
    },
    {
      key: "reopen_responses",
      label: FORM_ADMIN_ACTION_LABEL.reopen_responses,
      available: reopen.cycleIds.length > 0,
      reason:
        reopen.cycleIds.length > 0
          ? undefined
          : reopen.blocked[0]?.reason ??
            "Nenhuma organização encerrada elegível para reabertura.",
    },
    {
      key: "reopen_validation",
      label: FORM_ADMIN_ACTION_LABEL.reopen_validation,
      available: validationReopen.cycleIds.length > 0,
      reason:
        validationReopen.cycleIds.length > 0
          ? undefined
          : validationReopen.blocked[0]?.reason ??
            "Nenhum órgão com validação/FAMI concluído para reabrir.",
    },
    {
      key: "early_close",
      label: FORM_ADMIN_ACTION_LABEL.early_close,
      available: hasEditable && !allPaused,
      reason: !hasEditable
        ? "Não há coleta em andamento para encerrar o prazo."
        : allPaused
          ? "A coleta já está suspensa."
          : undefined,
    },
    {
      key: "suspend",
      label: FORM_ADMIN_ACTION_LABEL.suspend,
      available: hasEditable && !allPaused,
      reason: allPaused
        ? "O formulário já está suspenso para todas as organizações em coleta."
        : !hasEditable
          ? "Não há coleta em andamento para suspender."
          : undefined,
    },
    {
      key: "resume",
      label: FORM_ADMIN_ACTION_LABEL.resume,
      available: anyPaused,
      reason: anyPaused
        ? undefined
        : "Nenhuma organização está com a coleta suspensa.",
    },
    {
      key: "view_history",
      label: FORM_ADMIN_ACTION_LABEL.view_history,
      available: true,
    },
  ];

  void now;
  void input.status;
  return actions;
}
