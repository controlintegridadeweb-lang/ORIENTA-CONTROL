"use client";

import { evidenceLabels } from "@/shared/labels/official-labels";
import type { RespondentStatsResult } from "@/features/evidences/respondent-service";
import type { ValidationStatus } from "@/features/evidences/respondent-evidence-helpers";
import { MetricCard, MetricCardSkeleton, type MetricCardVariant } from "@/shared/ui/components/metric-card";

type CardKey = "aprovadas" | "aguardando" | "reprovadas" | "complementacao";

type SummaryFilter = {
  status?: ValidationStatus;
  pendingOnly?: boolean;
} | null;

type Props = {
  stats: RespondentStatsResult | null;
  loading?: boolean;
  /** Indica qual atalho esta ativo (highlight). */
  activeKey?: CardKey | null;
  onSelect: (key: CardKey, filter: SummaryFilter) => void;
};

type CardDef = {
  key: CardKey;
  label: string;
  hint: string;
  variant: MetricCardVariant;
  value: (s: RespondentStatsResult) => number;
  filter: SummaryFilter;
};

const DEFS: CardDef[] = [
  {
    key: "aprovadas",
    label: "Aprovadas",
    hint: "Validadas pela equipe.",
    variant: "success",
    value: (s) => s.aprovadas,
    filter: { status: "approved" },
  },
  {
    key: "aguardando",
    label: "Aguardando validação",
    hint: "Inclui ajustadas e reenviadas.",
    variant: "warning",
    value: (s) => s.aguardando,
    filter: { status: "submitted" },
  },
  {
    key: "reprovadas",
    label: "Não aprovadas",
    hint: "Consulte a justificativa da validação.",
    variant: "danger",
    value: (s) => s.reprovadas,
    filter: { status: "invalidated" },
  },
  {
    key: "complementacao",
    label: evidenceLabels.respondentAdjustmentStatus,
    hint: "Você precisa responder.",
    variant: "warning",
    value: (s) => s.complementacao,
    filter: { status: "adjustment_requested" },
  },
];

export function RespondentEvidenceSummaryCards({
  stats,
  loading,
  activeKey,
  onSelect,
}: Props) {
  if (loading && !stats) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {DEFS.map((d) => (
          <MetricCardSkeleton key={d.key} showIcon={false} />
        ))}
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {DEFS.map((d) => {
        const isActive = activeKey === d.key;
        const v = d.value(stats);
        return (
          <MetricCard
            key={d.key}
            variant={d.variant}
            label={d.label}
            value={v}
            htmlTitle={d.hint}
            density="compact"
            onClick={() => onSelect(d.key, d.filter)}
            aria-pressed={isActive}
            selected={isActive}
          />
        );
      })}
    </div>
  );
}
