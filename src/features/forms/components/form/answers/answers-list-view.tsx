"use client";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { ChevronRight, Eye, Inbox } from "lucide-react";
import type { RespondentRow } from "@/features/forms/answers-types";
import { formSurface } from "@/shared/layout/form-surface";
import { LoadingButton } from "@/shared/ui/components/loading";
import { AnswersStatusBadge } from "./answers-status-badge";

function formatDate(iso: string): string {
  return formatPlatformDateTime(iso, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }, iso || "—");
}

type Props = {
  rows: RespondentRow[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (cycleId: string) => void;
};

export function AnswersListView({
  rows,
  hasMore,
  loadingMore,
  onLoadMore,
  onSelect,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className={formSurface.empty.container}>
        <span className={formSurface.empty.iconWrap}>
          <Inbox className="h-5 w-5" aria-hidden />
        </span>
        <p className={formSurface.empty.title}>Nenhum respondente encontrado</p>
        <p className={formSurface.empty.description}>
          Ajuste os filtros ou aguarde novas respostas para visualizar a lista.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className={formSurface.table.wrapper}>
        <table className={formSurface.table.table}>
          <caption className="sr-only">
            Lista de organizações que responderam ao formulário.
          </caption>
          <thead className={formSurface.table.head}>
            <tr>
              <th scope="col" className={formSurface.table.headCell}>
                Organização
              </th>
              <th scope="col" className={formSurface.table.headCell}>
                Período
              </th>
              <th scope="col" className={formSurface.table.headCell}>
                Situação
              </th>
              <th scope="col" className={formSurface.table.headCell}>
                Progresso
              </th>
              <th scope="col" className={formSurface.table.headCell}>
                Contribuintes
              </th>
              <th scope="col" className={formSurface.table.headCell}>
                Ultima atualizacao
              </th>
              <th scope="col" className={`${formSurface.table.headCell} text-right`}>
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className={formSurface.table.body}>
            {rows.map((row) => {
              const pct =
                row.totalQuestions > 0
                  ? Math.round((row.answeredQuestions / row.totalQuestions) * 100)
                  : 0;
              return (
                <tr key={row.cycleId} className={formSurface.table.row}>
                  <td className={`${formSurface.table.cell} font-medium text-slate-900`}>
                    {row.organizationName || "—"}
                  </td>
                  <td className={formSurface.table.cellMuted}>
                    {row.periodLabel || "—"}
                  </td>
                  <td className={formSurface.table.cell}>
                    <AnswersStatusBadge status={row.status} />
                  </td>
                  <td className={formSurface.table.cell}>
                    <div className="flex w-40 flex-col gap-1">
                      <span className="text-xs tabular-nums text-slate-600">
                        {row.answeredQuestions}/{row.totalQuestions} ({pct}%)
                      </span>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-brand"
                          style={{ width: `${pct}%` }}
                          aria-hidden
                        />
                      </div>
                    </div>
                  </td>
                  <td className={`${formSurface.table.cellMuted} tabular-nums`}>
                    {row.contributorCount}
                  </td>
                  <td className={formSurface.table.cellMuted}>
                    {formatDate(row.lastUpdatedAt)}
                  </td>
                  <td className={`${formSurface.table.cell} text-right`}>
                    <button
                      type="button"
                      onClick={() => onSelect(row.cycleId)}
                      className={`${formSurface.ghostButton} text-brand-700`}
                      aria-label={`Visualizar respostas de ${row.organizationName} no período ${row.periodLabel}`}
                    >
                      <Eye className="h-4 w-4" aria-hidden />
                      Visualizar
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {hasMore ? (
        <div className="flex justify-center">
          <LoadingButton
            pending={loadingMore}
            pendingLabel="Carregando..."
            className={formSurface.secondaryButtonSm}
            onClick={onLoadMore}
          >
            Carregar mais
          </LoadingButton>
        </div>
      ) : null}
    </div>
  );
}
