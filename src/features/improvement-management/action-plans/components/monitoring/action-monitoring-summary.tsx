"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { PLAN_STATUS_LABELS } from "@/features/improvement-management/action-plans/components/shared/plan-status-badge";
import { formatLocalDate } from "@/shared/datetime/business-date";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { OverviewSoftPanel } from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";

function responsibleLabel(plan: ActionPlanAction): string {
  const name = plan.responsibleName.trim();
  if (name) return name;
  const sector = plan.responsibleSector.trim();
  return sector || "—";
}

function optionLabel(plan: ActionPlanAction): string {
  const text = plan.actionText.trim();
  return text.length > 95 ? `${text.slice(0, 95)}…` : text;
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm font-semibold text-slate-900">{label}</dt>
      <dd className="mt-1.5 text-sm leading-relaxed text-slate-800">{value}</dd>
    </div>
  );
}

type Props = {
  plans: ActionPlanAction[];
  selectedPlan: ActionPlanAction | null;
  onSelectAction: (planId: string) => void;
  detailsHref: string | null;
};

export function ActionMonitoringSummary({
  plans,
  selectedPlan,
  onSelectAction,
  detailsHref,
}: Props) {
  return (
    <PanelSection title="Ação monitorada" size="compact">
      {plans.length === 0 ? (
        <p className={typography.auxiliary}>Nenhuma ação cadastrada nesta recomendação.</p>
      ) : (
        <div className="flex flex-col gap-5">
          <label className={formSurface.fieldGroup} htmlFor="monitored-action">
            <span className="sr-only">Ação monitorada</span>
            <select
              id="monitored-action"
              value={selectedPlan?.id ?? ""}
              onChange={(event) => onSelectAction(event.target.value)}
              className={formSurface.inputSelect}
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {optionLabel(plan)}
                </option>
              ))}
            </select>
          </label>

          {selectedPlan ? (
            <>
              <OverviewSoftPanel padded={false} className="px-5 py-5 sm:px-6 sm:py-6">
                <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Responsável" value={responsibleLabel(selectedPlan)} />
                  <Field label="Situação" value={PLAN_STATUS_LABELS[selectedPlan.status]} />
                  <Field label="Progresso" value={`${selectedPlan.progressPercentage}%`} />
                  <Field label="Início" value={formatLocalDate(selectedPlan.startDate)} />
                  <Field label="Prazo final" value={formatLocalDate(selectedPlan.dueDate)} />
                  <Field
                    label="Última atualização"
                    value={formatLocalDate(selectedPlan.updatedAt)}
                  />
                </dl>
              </OverviewSoftPanel>
              {detailsHref ? (
                <p className="text-right">
                  <Link
                    href={detailsHref}
                    className="text-sm font-medium text-brand-800 hover:underline"
                  >
                    Ver detalhes da ação
                  </Link>
                </p>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </PanelSection>
  );
}
