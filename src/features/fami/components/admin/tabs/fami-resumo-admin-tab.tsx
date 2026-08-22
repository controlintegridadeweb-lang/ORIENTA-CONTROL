"use client";

import { useMemo } from "react";
import type { FamiSnapshotResponse } from "@/features/fami/client";
import {
  interpretSnapshot,
  TREND_META,
  type EvolutionDelta,
} from "@/features/fami/respondent-presentation";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { MetricCard } from "@/shared/ui/components/metric-card";
import { adminQueueSegmentHref } from "@/features/admin";
import { RespondentFamiScopeBanner } from "@/features/fami/components/respondent/respondent-fami-scope-banner";
import { RespondentFamiInsights } from "@/features/fami/components/respondent/respondent-fami-insights";
import {
  FAMI_SECTION_STACK,
  type FamiSnapshotNonNull,
} from "../fami-maturity-helpers";

type QueueScope = { globalView: boolean; organizationId: string };

type Props = {
  snapshot: FamiSnapshotNonNull;
  data: FamiSnapshotResponse | null;
  delta: EvolutionDelta;
  organizationId: string;
  effectiveFormId: string;
  cycleId: string;
  queueScope: QueueScope;
};

export function FamiResumoAdminTab({
  snapshot,
  data,
  delta,
  organizationId,
  effectiveFormId,
  cycleId,
  queueScope,
}: Props) {
  const insights = useMemo(() => interpretSnapshot(snapshot), [snapshot]);
  const lastProcessedAt =
    data?.latestVersionMeta?.createdAt ?? snapshot.global?.createdAt ?? null;
  const priorityAxis = insights.bottomAxis;
  const priorityHref =
    priorityAxis && organizationId && effectiveFormId && priorityAxis.axisId
      ? adminQueueSegmentHref("recomendacoes", queueScope, {
          formId: effectiveFormId,
          cycleId,
          axisId: priorityAxis.axisId,
        })
      : null;
  const priorityCta =
    priorityAxis && priorityAxis !== insights.topAxis && priorityHref
      ? {
          href: priorityHref,
          label: `Tratar recomendações · ${priorityAxis.axisName}`,
        }
      : null;

  return (
    <div className={FAMI_SECTION_STACK}>
      <RespondentFamiScopeBanner
        percentage={snapshot.global?.percentage ?? null}
        level={snapshot.global?.maturityLevel ?? null}
        lastProcessedAt={lastProcessedAt}
      />

      <RespondentFamiInsights
        summary={insights.summary}
        cards={insights.cards}
        priorityCta={priorityCta}
      />

      {delta.delta != null ? (
        <PanelSection
          title="Comparativo"
          description="Variação em pontos percentuais em relação ao diagnóstico anterior."
          variant="plain"
        >
          <div className="max-w-sm">
            <MetricCard
              density="compact"
              variant={
                delta.trend === "up"
                  ? "success"
                  : delta.trend === "down"
                    ? "danger"
                    : "neutral"
              }
              label="Vs. diagnóstico anterior"
              value={`${delta.delta > 0 ? "+" : ""}${delta.delta.toFixed(1)} p.p.`}
              secondary={TREND_META[delta.trend].label}
              htmlTitle="Variação em pontos percentuais em relação ao diagnóstico anterior."
            />
          </div>
        </PanelSection>
      ) : null}
    </div>
  );
}
