"use client";

import { useEffect, useState } from "react";
import type { EvidenceStatsResult } from "@/features/evidences/types";
import { getEvidenceStats, type EvidenceStatsFilters } from "@/features/evidences/client";
import type { ValidationStatus } from "@/features/evidences/schemas";
import { describeError } from "@/infrastructure/notifications/notify";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { MetricCard, MetricCardSkeleton, type MetricCardVariant } from "@/shared/ui/components/metric-card";

type Props = {
  filters: EvidenceStatsFilters;
  /** Incrementado para forçar novo fetch (botão Atualizar). */
  refreshSignal?: number;
  /** Status atualmente filtrado, para destacar o card correspondente. */
  activeStatus?: "" | ValidationStatus;
  /** Alterna o filtro de status ao clicar num card ("" limpa o filtro). */
  onSelectStatus?: (status: "" | ValidationStatus) => void;
};

export function EvidencesKpiCards({
  filters,
  refreshSignal = 0,
  activeStatus = "",
  onSelectStatus,
}: Props) {
  const [stats, setStats] = useState<EvidenceStatsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retrySignal, setRetrySignal] = useState(0);
  const { formId, organizationId, search, from, to } = filters;

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Reflete o início de uma leitura remota quando o escopo da tela muda.
    setLoading(true);
    setError(null);
    getEvidenceStats({ formId, organizationId, search, from, to })
      .then((result) => {
        if (!cancelled) setStats(result);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(describeError(caught, "Falha ao carregar os indicadores de evidências."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formId, organizationId, search, from, to, refreshSignal, retrySignal]);

  if (loading && !stats) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <MetricCardSkeleton key={index} showIcon={false} />
        ))}
      </div>
    );
  }

  if (error && !stats) {
    return (
      <AsyncErrorState
        message={error}
        onRetry={() => setRetrySignal((current) => current + 1)}
        retrying={loading}
      />
    );
  }

  if (!stats) return null;

  /** Fila administrativa: só estados após o envio para validação. */
  const cards: {
    key: string;
    label: string;
    value: number;
    variant: MetricCardVariant;
    status: ValidationStatus;
  }[] = [
    { key: "waiting", label: "Aguardando validação", value: stats.aguardando_validacao, variant: "warning", status: "submitted" },
    { key: "adjustment", label: "Ajuste solicitado", value: stats.ajuste_solicitado, variant: "warning", status: "adjustment_requested" },
    { key: "approved", label: "Aprovadas", value: stats.aprovadas, variant: "success", status: "approved" },
    { key: "rejected", label: "Não aprovadas", value: stats.nao_aprovadas, variant: "danger", status: "invalidated" },
  ];

  const interactive = Boolean(onSelectStatus);

  return (
    <div className="space-y-3">
      {error ? (
        <AsyncErrorState
          compact
          title="Os indicadores podem estar desatualizados"
          message={error}
          onRetry={() => setRetrySignal((current) => current + 1)}
          retrying={loading}
        />
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const active = activeStatus === card.status;
          return (
            <MetricCard
              key={card.key}
              variant={card.variant}
              label={card.label}
              value={card.value}
              density="compact"
              onClick={interactive ? () => onSelectStatus?.(active ? "" : card.status) : undefined}
              aria-pressed={interactive ? active : undefined}
              selected={interactive ? active : false}
              htmlTitle={
                interactive
                  ? active
                    ? "Remover filtro deste status"
                    : `Filtrar por "${card.label}"`
                  : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}
