"use client";

import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { PLAN_STATUS_LABELS } from "@/features/improvement-management/action-plans/components/shared/plan-status-badge";
import { getAxisTheme } from "@/shared/theme/axis-theme";
import { formatLocalDate } from "@/shared/datetime/business-date";
import { OverviewBlockTitle, overviewStack } from "./overview-section-primitives";

type Props = {
  plans: ActionPlanAction[];
  axisName: string;
};

function formatActionDate(value: string | null | undefined): string {
  return formatLocalDate(value, { day: "2-digit", month: "short", year: "numeric" });
}

/** Resumo tabular do plano na Visão geral — leitura, sem execução. */
export function ActionPlanOverviewSummary({ plans, axisName }: Props) {
  const theme = getAxisTheme(axisName);

  return (
    <section aria-labelledby="rec-plan-summary-heading" className={overviewStack}>
      <OverviewBlockTitle
        id="rec-plan-summary-heading"
        title="Plano de ação"
        description="Situação consolidada das ações cadastradas."
      />

      {plans.length === 0 ? (
        <div
          className="rounded-xl px-4 py-4 sm:px-5 sm:py-5"
          style={{ backgroundColor: theme.softBackground }}
        >
          <p className="text-sm text-slate-700">Nenhuma ação cadastrada neste plano.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl" style={{ backgroundColor: theme.softBackground }}>
          <table className="w-full table-fixed text-sm">
            <thead>
              <tr style={{ backgroundColor: theme.strong }}>
                <th className="px-4 py-3 text-left text-sm font-semibold text-white sm:px-5">
                  Ação cadastrada
                </th>
                <th className="px-3 py-3 text-center text-sm font-semibold text-white">
                  Situação
                </th>
                <th className="px-3 py-3 text-center text-sm font-semibold text-white">
                  Início
                </th>
                <th className="px-3 py-3 text-center text-sm font-semibold text-white">
                  Final
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-white sm:px-5">
                  Progresso
                </th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan, index) => (
                <tr
                  key={plan.id}
                  className={index > 0 ? "border-t border-slate-200" : undefined}
                >
                  <td className="px-4 py-3 text-slate-900 sm:px-5">
                    <p className="line-clamp-2 font-medium">{plan.actionText}</p>
                  </td>
                  <td className="px-3 py-3 text-center text-slate-800">
                    {PLAN_STATUS_LABELS[plan.status]}
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums text-slate-800">
                    {formatActionDate(plan.startDate)}
                  </td>
                  <td className="px-3 py-3 text-center tabular-nums text-slate-800">
                    {formatActionDate(plan.dueDate)}
                  </td>
                  <td className="px-4 py-3 text-center tabular-nums text-slate-900 sm:px-5">
                    {plan.progressPercentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
