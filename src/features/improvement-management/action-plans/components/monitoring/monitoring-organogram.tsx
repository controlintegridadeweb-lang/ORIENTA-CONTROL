"use client";

import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { PLAN_STATUS_LABELS } from "@/features/improvement-management/action-plans/components/shared/plan-status-badge";
import { getAxisTheme } from "@/shared/theme/axis-theme";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { typography } from "@/shared/layout/design-system";

function Connector() {
  return (
    <div className="flex h-7 justify-center" aria-hidden>
      <span className="w-px bg-slate-300" />
    </div>
  );
}

function HierarchyNode({
  label,
  title,
  accentColor,
  backgroundColor = "#ffffff",
  borderColor = "#e2e8f0",
}: {
  label: string;
  title: string;
  accentColor: string;
  backgroundColor?: string;
  borderColor?: string;
}) {
  return (
    <article
      className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl border px-5 py-4 text-left sm:px-6"
      style={{ backgroundColor, borderColor }}
    >
      <span
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: accentColor }}
        aria-hidden
      />
      <p className={typography.contextLabel}>{label}</p>
      <p className={`mt-1 ${typography.cardTitle}`} title={title}>
        {title}
      </p>
    </article>
  );
}

function ActionNode({
  plan,
  selected,
  onSelect,
}: {
  plan: ActionPlanAction;
  selected: boolean;
  onSelect: (planId: string) => void;
}) {
  const overdue = plan.slaLabel === "overdue" && plan.status !== "cancelled";
  const dueSoon = plan.slaLabel === "due_soon" && plan.status !== "cancelled";
  const sla = overdue ? "Atrasada." : dueSoon ? "Próxima do vencimento." : "";

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onSelect(plan.id)}
      title={plan.actionText}
      className={`w-full rounded-xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        selected
          ? "border-brand-300 bg-brand-50/70 ring-2 ring-brand/15"
          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
      }`}
    >
      <span className={typography.contextLabel}>Ação</span>
      <span className={`mt-1.5 block line-clamp-3 ${typography.cardTitle}`}>
        {plan.actionText}
      </span>
      <span className="mt-3 block text-xs font-medium tabular-nums text-slate-600">
        {plan.progressPercentage}% · {PLAN_STATUS_LABELS[plan.status]}
      </span>
      {sla ? (
        <span className={`mt-1 block text-xs ${overdue ? "font-medium text-rose-700" : "text-amber-700"}`}>
          {sla}
        </span>
      ) : (
        <span className="mt-1 block text-xs text-slate-400">Prazo regular</span>
      )}
    </button>
  );
}

type Props = {
  axisName: string;
  sectionName: string;
  recommendationText: string;
  plans: ActionPlanAction[];
  selectedPlanId: string | null;
  onSelectAction: (planId: string) => void;
};

export function MonitoringOrganogram({
  axisName,
  sectionName,
  recommendationText,
  plans,
  selectedPlanId,
  onSelectAction,
}: Props) {
  const theme = getAxisTheme(axisName);
  const axis = axisName.trim();
  const section = sectionName.trim();
  const recommendation = recommendationText.trim() || "Recomendação";

  return (
    <PanelSection
      title="Árvore de problemas e soluções"
      size="compact"
      description="Eixo, seção, recomendação de origem e ações vinculadas."
    >
      <figure
        aria-label={`Árvore de problemas e soluções: ${[axis, section, recommendation].filter(Boolean).join(" → ")} → ${plans.length} ação(ões)`}
        className="rounded-xl bg-slate-50/50 px-3 py-5 sm:px-5 sm:py-6"
      >
        <div className="mx-auto max-w-5xl">
          {axis ? (
            <>
              <HierarchyNode
                label="Eixo"
                title={axis}
                accentColor={theme.primary}
                backgroundColor={theme.softBackground}
                borderColor={theme.border}
              />
              <Connector />
            </>
          ) : null}

          {section ? (
            <>
              <HierarchyNode
                label="Seção"
                title={section}
                accentColor={theme.primary}
                backgroundColor="#ffffff"
              />
              <Connector />
            </>
          ) : null}

          <HierarchyNode
            label="Recomendação"
            title={recommendation}
            accentColor={theme.primary}
            backgroundColor="#ffffff"
          />

          {plans.length > 0 ? (
            <>
              <Connector />
              <div data-layout={plans.length > 2 ? "wrapped-actions" : "actions"}>
                {plans.length > 2 ? (
                  <p className="mb-3 text-center text-xs font-medium text-slate-500">
                    {plans.length} ações vinculadas
                  </p>
                ) : null}
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {plans.map((plan) => (
                    <ActionNode
                      key={plan.id}
                      plan={plan}
                      selected={plan.id === selectedPlanId}
                      onSelect={onSelectAction}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="mt-5 text-center text-sm text-slate-500">Nenhuma ação vinculada.</p>
          )}
        </div>
      </figure>
    </PanelSection>
  );
}
