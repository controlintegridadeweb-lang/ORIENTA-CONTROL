import type { ReactNode } from "react";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { PLAN_STATUS_LABELS } from "@/features/improvement-management/action-plans/components/shared/plan-status-badge";

const ORGANOGRAM_CONNECTOR = "#94a3b8";
const ACTION_BORDER = "#334155";

export type OrganogramNodeKind = "eixo" | "secao" | "pergunta" | "recomendacao";

export function OrganogramStem() {
  return (
    <div
      className="h-8 w-px shrink-0"
      style={{ backgroundColor: ORGANOGRAM_CONNECTOR }}
      aria-hidden
    />
  );
}

export function OrganogramChartNode({
  node,
  label,
  title,
  shape,
  backgroundColor,
  inverse,
}: {
  node: OrganogramNodeKind;
  label: string;
  title: string;
  shape: "capsule" | "rounded";
  backgroundColor: string;
  inverse: boolean;
}) {
  return (
    <article
      data-node={node}
      title={title}
      className={`px-6 py-3 text-center ${
        shape === "capsule"
          ? "w-fit min-w-[11rem] max-w-xs rounded-full"
          : "w-80 rounded-xl sm:w-96"
      } ${inverse ? "text-white" : "text-slate-800"}`}
      style={{ backgroundColor }}
    >
      <p className={`text-xs font-medium leading-snug ${inverse ? "text-white" : "text-slate-500"}`}>
        {label}
      </p>
      <p className="mt-0.5 truncate text-base font-semibold leading-snug">{title}</p>
    </article>
  );
}

export function OrganogramBranchItem({
  index,
  total,
  children,
}: {
  index: number;
  total: number;
  children: ReactNode;
}) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  const isOnly = total === 1;

  return (
    <li className="relative flex shrink-0 flex-col px-3 pt-8">
      <span
        className="absolute left-1/2 top-0 h-8 w-px -translate-x-1/2"
        style={{ backgroundColor: ORGANOGRAM_CONNECTOR }}
        aria-hidden
      />
      {isOnly ? null : (
        <span
          className="absolute top-0 h-px"
          style={{
            backgroundColor: ORGANOGRAM_CONNECTOR,
            left: isFirst ? "50%" : 0,
            right: isLast ? "50%" : 0,
          }}
          aria-hidden
        />
      )}
      {children}
    </li>
  );
}

export function OrganogramActionNode({
  plan,
  selected,
  accentColor,
  onSelect,
}: {
  plan: ActionPlanAction;
  selected: boolean;
  accentColor: string;
  onSelect?: (planId: string) => void;
}) {
  const overdue = plan.slaLabel === "overdue" && plan.status !== "cancelled";
  const dueSoon = plan.slaLabel === "due_soon" && plan.status !== "cancelled";
  const sla = overdue ? "Atrasada." : dueSoon ? "Próxima do vencimento." : "";
  const body = (
    <>
      <span className="block text-xs font-medium leading-snug text-slate-500">Ação</span>
      <span className="mt-1.5 line-clamp-2 min-h-10 text-sm font-semibold leading-5 text-slate-800">
        {plan.actionText}
      </span>
      <span className="mt-auto block pt-2.5 text-xs font-medium tabular-nums text-slate-600">
        {plan.progressPercentage}% · {PLAN_STATUS_LABELS[plan.status]}
      </span>
      {sla ? (
        <span className={`mt-1 block min-h-4 text-xs ${overdue ? "font-medium text-rose-700" : "text-amber-700"}`}>
          {sla}
        </span>
      ) : (
        <span className="mt-1 block min-h-4 text-xs text-slate-400">Prazo regular</span>
      )}
    </>
  );

  const className =
    "flex h-full w-44 flex-col rounded-xl border bg-white p-3.5 text-left";
  const style = { borderColor: selected ? accentColor : ACTION_BORDER };

  if (!onSelect) {
    return (
      <article data-node="acao" title={plan.actionText} className={className} style={style}>
        {body}
      </article>
    );
  }

  return (
    <button
      type="button"
      data-node="acao"
      aria-pressed={selected}
      onClick={() => onSelect(plan.id)}
      title={plan.actionText}
      className={`${className} transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand`}
      style={style}
    >
      {body}
    </button>
  );
}

export function OrganogramActionBranch({
  plans,
  selectedPlanId,
  accentColor,
  onSelectAction,
}: {
  plans: ActionPlanAction[];
  selectedPlanId: string | null;
  accentColor: string;
  onSelectAction?: (planId: string) => void;
}) {
  return (
    <ul className="flex items-stretch justify-center" role="list">
      {plans.map((plan, index) => (
        <OrganogramBranchItem key={plan.id} index={index} total={plans.length}>
          <OrganogramActionNode
            plan={plan}
            selected={plan.id === selectedPlanId}
            accentColor={accentColor}
            onSelect={onSelectAction}
          />
        </OrganogramBranchItem>
      ))}
    </ul>
  );
}
