import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { computeActionSla } from "@/features/improvement-management/action-plans/domain-model";
import { calculatePlanProgress } from "./plan-progress";

export type ActionPlanMetrics = {
  /** Total cadastrado, incluindo canceladas. */
  total: number;
  /** Ações não canceladas. */
  active: number;
  /** Progresso 0%, não canceladas e não concluídas. */
  notStarted: number;
  /** Progresso entre 1% e 99%, não canceladas. */
  inProgress: number;
  /** Progresso 100%, não canceladas. */
  completed: number;
  /** Canceladas. */
  cancelled: number;
  /** Prazo vencido, progresso < 100%, não canceladas. */
  overdue: number;
  noResp: number;
  /** Média dos percentuais das ações ativas. */
  progress: number;
};

/** Contagens e progresso consolidado das ações de um plano. */
export function computeActionPlanMetrics(plans: ActionPlanAction[]): ActionPlanMetrics {
  let active = 0;
  let notStarted = 0;
  let inProgress = 0;
  let completed = 0;
  let cancelled = 0;
  let overdue = 0;
  let noResp = 0;

  for (const plan of plans) {
    if (!plan.responsibleName?.trim()) noResp += 1;
    if (plan.status === "cancelled") {
      cancelled += 1;
      continue;
    }

    active += 1;
    if (plan.progressPercentage === 100 || plan.status === "completed") {
      completed += 1;
    } else if (plan.progressPercentage >= 1 && plan.progressPercentage <= 99) {
      inProgress += 1;
    } else {
      notStarted += 1;
    }

    if (
      plan.progressPercentage < 100 &&
      computeActionSla({ dueDate: plan.dueDate, status: plan.status }) === "overdue"
    ) {
      overdue += 1;
    }
  }

  return {
    total: plans.length,
    active,
    notStarted,
    inProgress,
    completed,
    cancelled,
    overdue,
    noResp,
    progress: calculatePlanProgress(plans),
  };
}
