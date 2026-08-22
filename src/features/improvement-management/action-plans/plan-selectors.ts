import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";

/**
 * Retorna o plano "em destaque" para exibição: primeiro não finalizado,
 * ou o primeiro da lista se todos finalizados.
 */
export function pickDisplayPlan(
  row: Pick<{ plans: ActionPlanAction[] }, "plans">,
): ActionPlanAction | null {
  const open = row.plans.find(
    (p) => !["completed", "cancelled"].includes(p.status),
  );
  return open ?? row.plans[0] ?? null;
}
