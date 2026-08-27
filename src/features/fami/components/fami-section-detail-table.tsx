"use client";

import { RespondentFamiLevelBadge } from "@/features/fami/components/respondent/respondent-fami-level-badge";
import type { AxisColorKey } from "@/features/fami/fami-axis-display";
import type { FamiSectionSnapshot } from "@/features/fami/read-types";
import {
  buildSectionDetailRows,
  groupSectionDetailRowsByAxis,
  type SectionDetailRow,
} from "@/features/fami/section-detail-view-model";
import { getAxisThemeByKey } from "@/shared/theme/axis-theme";

type Props = {
  sections: readonly FamiSectionSnapshot[];
  emptyLabel?: string;
};

const FALLBACK_THEME = {
  text: "#475569",
  primary: "#64748b",
  softBackground: "#f8fafc",
  border: "#e2e8f0",
} as const;

function themeForKey(key: AxisColorKey | "unknown") {
  if (key === "unknown") return FALLBACK_THEME;
  const theme = getAxisThemeByKey(key);
  return {
    text: theme.text,
    primary: theme.primary,
    softBackground: theme.softBackground,
    border: theme.border,
  };
}

function SectionRow({ row }: { row: SectionDetailRow }) {
  const theme = themeForKey(row.axisColorKey);
  const isNotApplicable = row.maturityLevel == null;
  const pct = Math.min(100, Math.max(0, row.percentage));

  return (
    <tr className="border-b border-slate-100/90 transition hover:bg-slate-50/80">
      <td className="hidden w-16 px-5 py-3.5 align-middle tabular-nums sm:table-cell sm:px-6">
        <span className="text-sm font-medium text-slate-400">{row.formOrder}</span>
      </td>
      <td className="px-5 py-3.5 align-middle text-sm font-medium text-slate-800 sm:px-6">
        <span className="sm:hidden">
          <span className="mr-1 font-medium text-slate-400">{row.formOrder}.</span>
        </span>
        {row.sectionLabel}
      </td>
      <td className="px-5 py-3.5 align-middle sm:px-6">
        <div className="min-w-28 space-y-1.5">
          <p
            className="text-sm font-semibold tabular-nums tracking-tight"
            style={{ color: isNotApplicable ? "#64748b" : theme.text }}
          >
            {isNotApplicable ? "N/A" : `${row.percentage.toFixed(1)}%`}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${isNotApplicable ? 0 : pct}%`,
                backgroundColor: isNotApplicable ? "#cbd5e1" : theme.primary,
              }}
            />
          </div>
        </div>
      </td>
      <td className="px-5 py-3.5 align-middle sm:px-6">
        <RespondentFamiLevelBadge level={row.maturityLevel} size="sm" />
      </td>
      <td className="px-5 py-3.5 align-middle text-sm tabular-nums text-slate-600 sm:px-6">
        <span className="font-medium text-slate-800">{row.pointsEarned.toFixed(2)}</span>
        <span className="text-slate-300"> / </span>
        <span>{row.pointsPossible.toFixed(2)}</span>
      </td>
    </tr>
  );
}

/** Tabela de seções agrupadas por eixo, na ordem oficial do formulário. */
export function FamiSectionDetailTable({
  sections,
  emptyLabel = "Sem dados por seção nesta versão.",
}: Props) {
  const groups = groupSectionDetailRowsByAxis(buildSectionDetailRows(sections));

  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/90 text-left">
            <th className="hidden w-16 px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 sm:table-cell sm:px-6">
              Ordem
            </th>
            <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 sm:px-6">
              Seção
            </th>
            <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 sm:px-6">
              %
            </th>
            <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 sm:px-6">
              Nível
            </th>
            <th className="px-5 py-3 text-xs font-medium uppercase tracking-wide text-slate-500 sm:px-6">
              Pontos
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-12 text-center text-slate-500 sm:px-6">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            groups.flatMap((group) => {
              const theme = themeForKey(group.axisColorKey);
              return [
                <tr key={`axis-header-${group.axisId}`}>
                  <th
                    colSpan={5}
                    scope="colgroup"
                    className="border-y border-slate-100 px-5 py-2.5 text-left sm:px-6"
                    style={{
                      backgroundColor: theme.softBackground,
                      boxShadow: `inset 4px 0 0 ${theme.primary}`,
                    }}
                  >
                    <span
                      className="text-sm font-semibold tracking-tight"
                      style={{ color: theme.text }}
                    >
                      {group.axisLabel}
                    </span>
                  </th>
                </tr>,
                ...group.sections.map((row) => (
                  <SectionRow key={row.sectionId} row={row} />
                )),
              ];
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
