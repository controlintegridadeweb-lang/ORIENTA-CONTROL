"use client";

import { typography } from "@/shared/layout/design-system";

import { useEffect, useState, type ReactNode } from "react";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { computeActionSla } from "@/features/improvement-management/action-plans/domain-model";
import { PLAN_STATUS_LABELS } from "@/features/improvement-management/action-plans/components/shared/plan-status-badge";
import {
  listActionPlanProgressUpdates,
  listRespondentActionPlanProgressUpdates,
} from "@/features/improvement-management/action-plans/client";
import type { ActionPlanProgressUpdate } from "@/features/improvement-management/action-plans/types";
import { progressUpdateHistoryText } from "@/features/improvement-management/action-plans/progress-update-presentation";
import { formSurface } from "@/shared/layout/form-surface";
import { formatLocalDate } from "@/shared/datetime/business-date";
import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import { describeError } from "@/infrastructure/notifications/notify";
import { AsyncErrorState } from "@/shared/ui/components/async-error-state";
import { InlineLoader } from "@/shared/ui/components/loading";
import { overviewNestedTable } from "@/features/improvement-management/recommendations/components/hub/overview-section-primitives";

type Props = {
  plan: ActionPlanAction;
  role: "respondent" | "admin";
  onClose: () => void;
};

const CIVIL_DATE_FORMAT = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
} as const;

const leftCellClass = `${overviewNestedTable.bodyCell} text-left`;

function responsibleLabel(plan: ActionPlanAction): string {
  const name = plan.responsibleName.trim();
  if (name) return name;
  const sector = plan.responsibleSector.trim();
  return sector || "—";
}

function lastUpdateLabel(updatedAt: string): string | null {
  const trimmed = updatedAt.trim();
  if (!trimmed) return null;
  const formatted = formatPlatformDate(trimmed, CIVIL_DATE_FORMAT);
  if (!formatted || formatted === "—") return null;
  return formatted;
}

export function evidenceCountLabel(plan: ActionPlanAction): string {
  const count = plan.documents.filter((document) => document.isCurrentRevision).length;
  if (count === 0) return "Nenhuma comprovação da execução na revisão atual.";
  if (count === 1) return "1 comprovação da execução na revisão atual.";
  return `${count} comprovações da execução na revisão atual.`;
}

function InstitutionalTable({
  columns,
  children,
}: {
  columns: readonly string[];
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className={overviewNestedTable.table}>
        <thead>
          <tr className={overviewNestedTable.headRow}>
            {columns.map((column) => (
              <th key={column} scope="col" className={overviewNestedTable.headCell}>
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <h4 className="text-sm font-semibold text-slate-900">{children}</h4>;
}

export function ActionPlanProgressUpdatesList({
  items,
}: {
  items: ActionPlanProgressUpdate[];
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-slate-700">
        Nenhuma movimentação registrada.
      </p>
    );
  }

  return (
    <InstitutionalTable columns={["Data", "Situação", "Atualização"]}>
      {items.map((item) => (
        <tr key={item.id} className={overviewNestedTable.bodyRow}>
          <td className={overviewNestedTable.bodyCell}>
            <time className="tabular-nums" dateTime={item.createdAt}>
              {formatPlatformDate(item.createdAt, CIVIL_DATE_FORMAT)}
            </time>
          </td>
          <td className={overviewNestedTable.bodyCell}>
            {PLAN_STATUS_LABELS[item.newStatus]}
          </td>
          <td className={leftCellClass}>
            <p className="whitespace-pre-wrap leading-relaxed">
              {progressUpdateHistoryText(item)}
            </p>
            {item.createdByName.trim() ? (
              <p className="mt-1 text-xs text-slate-500">{item.createdByName}</p>
            ) : null}
          </td>
        </tr>
      ))}
    </InstitutionalTable>
  );
}

function ActionPlanProgressUpdatesSection({
  planId,
  role,
}: {
  planId: string;
  role: "respondent" | "admin";
}) {
  const [items, setItems] = useState<ActionPlanProgressUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const requestKey = `${planId}:${role}:${retry}`;
  const [seenRequestKey, setSeenRequestKey] = useState(requestKey);

  if (seenRequestKey !== requestKey) {
    setSeenRequestKey(requestKey);
    setLoading(true);
    setError(null);
  }

  useEffect(() => {
    let cancelled = false;
    const load =
      role === "admin"
        ? listActionPlanProgressUpdates
        : listRespondentActionPlanProgressUpdates;
    void load(planId)
      .then((next) => {
        if (!cancelled) setItems(next);
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(describeError(caught, "Falha ao carregar as atualizações da ação."));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [planId, role, retry]);

  return (
    <div className="space-y-2">
      <SectionTitle>Histórico da ação</SectionTitle>
      {loading ? <InlineLoader label="Carregando atualizações…" /> : null}
      {!loading && error ? (
        <AsyncErrorState
          compact
          message={error}
          onRetry={() => setRetry((current) => current + 1)}
        />
      ) : null}
      {!loading && !error ? <ActionPlanProgressUpdatesList items={items} /> : null}
    </div>
  );
}

function ActionSummaryTable({ plan }: { plan: ActionPlanAction }) {
  const sla = computeActionSla({ dueDate: plan.dueDate, status: plan.status });
  const isCancelled = plan.status === "cancelled";
  const isOverdue = sla === "overdue" && !isCancelled;
  const isDueSoon = sla === "due_soon" && !isCancelled;

  return (
    <InstitutionalTable
      columns={["Ação", "Responsável", "Início", "Final", "Situação", "Progresso"]}
    >
      <tr className={overviewNestedTable.bodyRow}>
        <td className={leftCellClass}>
          <p className="whitespace-pre-wrap font-medium leading-relaxed text-slate-900">
            {plan.actionText}
          </p>
        </td>
        <td className={overviewNestedTable.bodyCell}>{responsibleLabel(plan)}</td>
        <td className={overviewNestedTable.bodyCell}>{formatLocalDate(plan.startDate)}</td>
        <td className={overviewNestedTable.bodyCell}>
          <p className={isOverdue ? "font-medium text-rose-700" : undefined}>
            {formatLocalDate(plan.dueDate)}
          </p>
          {isOverdue ? (
            <p className="mt-0.5 text-xs font-medium text-rose-700">Atrasada</p>
          ) : null}
          {isDueSoon ? (
            <p className="mt-0.5 text-xs font-medium text-amber-700">
              Próxima do vencimento
            </p>
          ) : null}
        </td>
        <td className={overviewNestedTable.bodyCell}>{PLAN_STATUS_LABELS[plan.status]}</td>
        <td className={overviewNestedTable.bodyCell}>{`${plan.progressPercentage}%`}</td>
      </tr>
    </InstitutionalTable>
  );
}

/** Leitura completa da ação — tabela institucional, sem formulário de edição. */
export function ViewActionDetailsPanel({ plan, role, onClose }: Props) {
  const observations = plan.observations?.trim();
  const lastUpdate = lastUpdateLabel(plan.updatedAt);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className={typography.subsectionTitle}>Visualizar ação</h3>
        <button type="button" className={formSurface.ghostButton} onClick={onClose}>
          fechar
        </button>
      </div>

      <div className="space-y-5 rounded-xl bg-white p-4 shadow-sm sm:p-5">
        <ActionSummaryTable plan={plan} />

        {lastUpdate ? (
          <p className="text-sm leading-relaxed text-slate-700">
            Última atualização:{" "}
            <time dateTime={plan.updatedAt} className="tabular-nums">
              {lastUpdate}
            </time>
          </p>
        ) : null}

        {observations ? (
          <div className="space-y-1.5">
            <SectionTitle>Observações</SectionTitle>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {observations}
            </p>
          </div>
        ) : null}

        <ActionPlanProgressUpdatesSection planId={plan.id} role={role} />

        <div className="space-y-1.5">
          <SectionTitle>Comprovação da execução</SectionTitle>
          <p className="text-sm leading-relaxed text-slate-700">{evidenceCountLabel(plan)}</p>
        </div>
      </div>
    </div>
  );
}
