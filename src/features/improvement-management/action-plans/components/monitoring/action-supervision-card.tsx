import Link from "next/link";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { AdminActionPlanProgress } from "@/features/improvement-management/action-plans/components/admin/admin-action-plan-progress";
import { PlanStatusBadge } from "@/features/improvement-management/action-plans/components/shared/plan-status-badge";
import { summarizeActionDocuments } from "@/features/improvement-management/action-plans/monitoring/summarize-action-documents";
import {
  OverviewCardShell,
  RecommendationCardField,
  RecommendationCardText,
} from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";
import { formSurface } from "@/shared/layout/form-surface";
import { formatLocalDate } from "@/shared/datetime/business-date";

type Props = {
  action: ActionPlanAction;
  actionLabel: string;
  originText: string;
  accentColor: string;
  href?: string;
  hrefLabel?: string;
  selected?: boolean;
  onSelect?: () => void;
};

export function ActionSupervisionCard({
  action,
  actionLabel,
  originText,
  accentColor,
  href,
  hrefLabel = "Abrir monitoramento",
  selected = false,
  onSelect,
}: Props) {
  const documents = summarizeActionDocuments(action.documents);

  return (
    <OverviewCardShell
      accentColor={accentColor}
      className={selected ? "ring-2 ring-brand-200" : undefined}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <RecommendationCardField label={actionLabel}>
            <RecommendationCardText variant="highlight">{action.actionText}</RecommendationCardText>
          </RecommendationCardField>
          <RecommendationCardText variant="metaSecondary" className="mt-2">
            Origem: {originText}
          </RecommendationCardText>
        </div>
        <PlanStatusBadge status={action.status} />
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <RecommendationCardField label="Responsável">
          <RecommendationCardText>{action.responsibleName || "Não informado"}</RecommendationCardText>
        </RecommendationCardField>
        <RecommendationCardField label="Prazo">
          <RecommendationCardText>{formatLocalDate(action.dueDate)}</RecommendationCardText>
        </RecommendationCardField>
        <RecommendationCardField label="Comprovações">
          <RecommendationCardText>{documents.line ?? "Nenhuma comprovação"}</RecommendationCardText>
        </RecommendationCardField>
      </dl>
      <div className="mt-5 grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <AdminActionPlanProgress
          value={action.progressPercentage}
          overdue={action.slaLabel === "overdue"}
        />
        {href ? (
          <Link className={`${formSurface.secondaryButtonSm} shrink-0`} href={href}>
            {hrefLabel}
          </Link>
        ) : null}
        {onSelect ? (
          <button
            type="button"
            className={`${formSurface.secondaryButtonSm} shrink-0`}
            aria-pressed={selected}
            onClick={onSelect}
          >
            {selected ? "Monitorando" : "Monitorar ação"}
          </button>
        ) : null}
      </div>
    </OverviewCardShell>
  );
}
