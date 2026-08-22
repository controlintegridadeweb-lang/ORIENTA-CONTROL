"use client";

import { useState } from "react";
import {
  ActionPlanAuditFeed,
  type AuditFeedItem,
} from "@/features/improvement-management/recommendations/components/hub/action-plan-audit-feed";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { InlineLoader } from "@/shared/ui/components/loading";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";

type Props = {
  items: AuditFeedItem[];
  loading: boolean;
  error: string | null;
  total: number;
  offset: number;
  pageSize: number;
  hasMore: boolean;
  onRetry: () => void;
  onPrevious: () => void;
  onNext: () => void;
};

export function AuditHistorySection({
  items,
  loading,
  error,
  total,
  offset,
  pageSize,
  hasMore,
  onRetry,
  onPrevious,
  onNext,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="pt-1">
      {!expanded ? (
        <button
          type="button"
          className={formSurface.ghostButton}
          onClick={() => setExpanded(true)}
        >
          Ver auditoria da ação
        </button>
      ) : (
        <div className="space-y-4">
          <button
            type="button"
            className={formSurface.ghostButton}
            onClick={() => setExpanded(false)}
          >
            Ocultar auditoria da ação
          </button>
          {error ? (
            <AsyncErrorState
              compact
              title={items.length > 0 ? "A auditoria pode estar incompleta" : undefined}
              message={error}
              onRetry={onRetry}
              retrying={loading}
            />
          ) : null}
          {loading && items.length === 0 ? (
            <InlineLoader label="Carregando registros de auditoria…" />
          ) : !error || items.length > 0 ? (
            <ActionPlanAuditFeed
              items={items}
              emptyMessage="Nenhuma alteração registrada nesta ação ainda."
            />
          ) : null}
          {total > pageSize ? (
            <nav
              className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"
              aria-label="Paginação da auditoria da ação"
            >
              <p className={typography.meta}>
                {Math.min(offset + 1, total)}–{Math.min(offset + pageSize, total)} de {total}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={formSurface.secondaryButtonSm}
                  disabled={loading || offset === 0}
                  onClick={onPrevious}
                >
                  Anterior
                </button>
                <button
                  type="button"
                  className={formSurface.secondaryButtonSm}
                  disabled={loading || !hasMore}
                  onClick={onNext}
                >
                  Próxima
                </button>
              </div>
            </nav>
          ) : null}
        </div>
      )}
    </div>
  );
}
