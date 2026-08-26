"use client";

import { RespondentFamiLevelBadge } from "@/features/fami/components/respondent/respondent-fami-level-badge";
import { AXIS_COLORS, type AxisColorKey } from "@/features/fami/fami-axis-display";
import type { FamiSectionSnapshot } from "@/features/fami/read-types";
import {
  buildSectionDetailRows,
  groupSectionDetailRowsByAxis,
  type SectionDetailRow,
} from "@/features/fami/section-detail-view-model";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  sections: readonly FamiSectionSnapshot[];
  emptyLabel?: string;
};

const FALLBACK_AXIS_COLORS = {
  text: "#64748b",
  badge: "#115E59",
  accent: "#64748b",
  row: "rgba(100, 116, 139, 0.04)",
} as const;

function colorsForKey(key: AxisColorKey | "unknown") {
  return key === "unknown" ? FALLBACK_AXIS_COLORS : AXIS_COLORS[key];
}

function SectionRow({ row }: { row: SectionDetailRow }) {
  const colors = colorsForKey(row.axisColorKey);
  const isNotApplicable = row.maturityLevel == null;
  const pct = Math.min(100, Math.max(0, row.percentage));

  return (
    <tr className={formSurface.table.row} style={{ backgroundColor: colors.row }}>
      <td className={`${formSurface.table.cell} hidden tabular-nums sm:table-cell sm:px-6`}>
        <span className="font-semibold" style={{ color: colors.text }}>
          {row.formOrder}
        </span>
      </td>
      <td className={`${formSurface.table.cell} font-medium text-slate-900 sm:px-6`}>
        <span className="sm:hidden">
          <span className="font-semibold" style={{ color: colors.text }}>
            {row.formOrder}.{" "}
          </span>
        </span>
        {row.sectionLabel}
      </td>
      <td className={`${formSurface.table.cell} sm:px-6`}>
        <div className="min-w-28 space-y-1.5">
          <p
            className="text-sm font-semibold tabular-nums"
            style={{ color: isNotApplicable ? "#64748b" : colors.text }}
          >
            {isNotApplicable ? "N/A" : `${row.percentage.toFixed(1)}%`}
          </p>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${isNotApplicable ? 0 : pct}%`,
                backgroundColor: isNotApplicable ? "#cbd5e1" : colors.accent,
              }}
            />
          </div>
        </div>
      </td>
      <td className={`${formSurface.table.cell} sm:px-6`}>
        <RespondentFamiLevelBadge level={row.maturityLevel} size="sm" />
      </td>
      <td className={`${formSurface.table.cellMuted} tabular-nums sm:px-6`}>
        <span className="font-medium text-slate-800">{row.pointsEarned.toFixed(2)}</span>
        <span className="text-slate-400"> / </span>
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
      <table className={formSurface.table.table}>
        <thead className={formSurface.table.head}>
          <tr>
            <th className={`${formSurface.table.headCell} hidden w-16 sm:table-cell sm:px-6`}>
              Ordem
            </th>
            <th className={`${formSurface.table.headCell} sm:px-6`}>Seção</th>
            <th className={`${formSurface.table.headCell} sm:px-6`}>%</th>
            <th className={`${formSurface.table.headCell} sm:px-6`}>Nível</th>
            <th className={`${formSurface.table.headCell} sm:px-6`}>Pontos</th>
          </tr>
        </thead>
        <tbody className={formSurface.table.body}>
          {groups.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-5 py-12 text-center text-slate-500 sm:px-6">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            groups.flatMap((group) => {
              const colors = colorsForKey(group.axisColorKey);
              return [
                <tr key={`axis-header-${group.axisId}`}>
                  <th
                    colSpan={5}
                    scope="colgroup"
                    className="border-y border-slate-200/80 px-5 py-3 text-left sm:px-6"
                    style={{ backgroundColor: colors.badge }}
                  >
                    <span className="text-sm font-semibold text-white">
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
