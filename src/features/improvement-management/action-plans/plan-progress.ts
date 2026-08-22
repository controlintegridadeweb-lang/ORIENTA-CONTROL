import type { PlanStatus } from "./schemas";

/** Texto institucional que explica o cálculo consolidado do progresso. */
export const PLAN_PROGRESS_CALCULATION_HINT =
  "O progresso do plano corresponde à média dos percentuais informados nas ações ativas. A situação de cada ação é definida automaticamente: 0% não iniciada, de 1% a 99% em andamento e 100% concluída. O percentual de cada ação só avança. Ações canceladas não entram no cálculo.";

export const PROGRESS_PERCENTAGE_CANNOT_DECREASE = "progress_percentage_cannot_decrease";

type ProgressBearingAction = {
  progressPercentage: number;
  status: string;
};

/**
 * Deriva a situação de execução a partir do percentual informado.
 * Cancelamento é excepcional e não depende do percentual.
 */
export function deriveActionStatus(
  progressPercentage: number,
  isCancelled: boolean,
): PlanStatus {
  if (isCancelled) return "cancelled";
  if (!Number.isInteger(progressPercentage)) {
    throw new Error("progress_percentage_must_be_integer");
  }
  if (progressPercentage < 0 || progressPercentage > 100) {
    throw new Error("progress_percentage_out_of_range");
  }
  if (progressPercentage === 0) return "not_started";
  if (progressPercentage === 100) return "completed";
  return "in_progress";
}

export function assertProgressPercentage(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new Error("progress_percentage_must_be_integer");
  }
  if (value < 0 || value > 100) {
    throw new Error("progress_percentage_out_of_range");
  }
  return value;
}

/** Percentual já persistido é piso: o andamento da ação só avança. */
export function assertProgressDoesNotDecrease(
  currentPercentage: number,
  nextPercentage: number,
): number {
  const current = assertProgressPercentage(currentPercentage);
  const next = assertProgressPercentage(nextPercentage);
  if (next < current) {
    throw new Error(PROGRESS_PERCENTAGE_CANNOT_DECREASE);
  }
  return next;
}

export function progressCannotDecreaseMessage(currentPercentage: number): string {
  return `O progresso da ação não pode ser reduzido. O percentual atual é ${currentPercentage}%.`;
}

/**
 * Progresso consolidado do plano: média dos percentuais das ações ativas
 * (canceladas excluídas). Sem ações ativas → 0.
 */
export function calculatePlanProgress(actions: ProgressBearingAction[]): number {
  const active = actions.filter((action) => action.status !== "cancelled");
  if (active.length === 0) return 0;
  const sum = active.reduce((acc, action) => acc + action.progressPercentage, 0);
  return Math.round(sum / active.length);
}

/** Progresso de uma única ação (null → 0). */
export function progressFromPlan(
  plan: Pick<ProgressBearingAction, "progressPercentage"> | null,
): number {
  if (!plan) return 0;
  return plan.progressPercentage;
}

/** Alias semântico usado por indicadores, API e relatórios. */
export function progressFromPlans(plans: ProgressBearingAction[]): number {
  return calculatePlanProgress(plans);
}

/**
 * Status que encerram um plano de ação (sem mais ação pendente).
 * Substitui comparações inline com strings literais.
 */
export const PLAN_TERMINAL_STATUSES: ReadonlySet<PlanStatus> = new Set([
  "completed",
  "cancelled",
]);
