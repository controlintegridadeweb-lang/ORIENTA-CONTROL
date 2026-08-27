"use client";

import { kpiGridForCount } from "@/shared/layout/design-system";
import { MetricCard, type MetricCardVariant } from "@/shared/ui/components/metric-card";

type AdminMonitoringCardDefinition<TFilter> = {
  id: TFilter;
  label: string;
  value: number;
  hint: string;
  variant: MetricCardVariant;
};

type Props<TFilter> = {
  cards: Array<AdminMonitoringCardDefinition<TFilter>>;
  activeFilter: TFilter;
  onSelect: (filter: TFilter) => void;
  ariaLabel: string;
  /** Sobrescreve a grade padrão (derivada da quantidade de cards). */
  gridClassName?: string;
  clearFilter: TFilter;
};

export function AdminMonitoringSummaryCards<TFilter>({
  cards,
  activeFilter,
  onSelect,
  ariaLabel,
  gridClassName,
  clearFilter,
}: Props<TFilter>) {
  return (
    <section aria-label={ariaLabel}>
      <div className={gridClassName ?? kpiGridForCount(cards.length)}>
        {cards.map((card, index) => {
          // O card de total (clearFilter) é atalho para limpar, não um filtro ativo.
          const isClearCard = Object.is(card.id, clearFilter);
          const active = !isClearCard && Object.is(activeFilter, card.id);
          return (
            <div key={`${String(card.id)}-${index}`} className="min-w-0">
              <MetricCard
                density="compact"
                variant={card.variant}
                label={card.label}
                value={card.value}
                htmlTitle={card.hint}
                onClick={() => onSelect(active || isClearCard ? clearFilter : card.id)}
                aria-pressed={active}
                selected={active}
                className="h-full"
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
