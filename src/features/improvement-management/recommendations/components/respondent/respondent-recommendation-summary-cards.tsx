"use client";

import { MetricCard, MetricCardSkeleton, type MetricCardVariant } from "@/shared/ui/components/metric-card";
import type { RespondentRecommendationSummary } from "@/features/improvement-management/recommendations/respondent-presentation";

export type SummaryCardKey =
  | "total"
  | "in_progress"
  | "resolved"
  | "awaiting_action";

type CardDef = {
  key: SummaryCardKey;
  label: string;
  hint: string;
  variant: MetricCardVariant;
  value: (s: RespondentRecommendationSummary) => number;
};

const DEFS: CardDef[] = [
  {
    key: "total",
    label: "Total",
    hint: "Recomendações da sua organização.",
    variant: "neutral",
    value: (s) => s.total,
  },
  {
    key: "in_progress",
    label: "Em plano de ação",
    hint: "Já têm plano de ação ativo.",
    variant: "info",
    value: (s) => s.inProgress,
  },
  {
    key: "resolved",
    label: "Aprovadas",
    hint: "Execução aceita pela administração.",
    variant: "success",
    value: (s) => s.resolved,
  },
  {
    key: "awaiting_action",
    label: "Pendentes de ação",
    hint: "Geradas e sem plano cadastrado.",
    variant: "warning",
    value: (s) => s.awaitingAction,
  },
];

type Props = {
  summary: RespondentRecommendationSummary | null;
  loading?: boolean;
  activeKey?: SummaryCardKey | null;
  onSelect: (key: SummaryCardKey) => void;
};

export function RespondentRecommendationSummaryCards({
  summary,
  loading,
  activeKey,
  onSelect,
}: Props) {
  if (loading && !summary) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DEFS.map((d) => (
          <MetricCardSkeleton key={d.key} showIcon={false} />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {DEFS.map((d) => {
        const isActive = activeKey === d.key;
        const v = summary ? d.value(summary) : 0;
        return (
          <MetricCard
            key={d.key}
            variant={d.variant}
            label={d.label}
            value={v}
            htmlTitle={d.hint}
            density="compact"
            onClick={() => onSelect(d.key)}
            aria-pressed={isActive}
            selected={isActive}
          />
        );
      })}
    </div>
  );
}
