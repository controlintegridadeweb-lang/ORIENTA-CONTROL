"use client";

import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { famiPreliminaryLabels } from "@/shared/labels/official-labels";
import { criterionEvolutionLabel } from "@/features/fami/preliminary/evolution";
import { formatPreliminaryPercentage } from "@/features/fami/preliminary/panel-presentation";
import type { EvolutionView } from "./use-fami-preliminary";
import type { Quadrimester } from "@/features/fami/preliminary/domain";

type Props = {
  quadrimester: Quadrimester;
  percentage: number | null;
  deltaPercentagePoints: number | null;
  methodologyVersion: string | null;
  evolution: EvolutionView | null;
};

export function QuadrimesterEvolutionBlock({
  quadrimester,
  percentage,
  deltaPercentagePoints,
  methodologyVersion,
  evolution,
}: Props) {
  return (
    <div className={`mt-3 space-y-2 ${typography.meta}`}>
      <p className="font-medium text-slate-800">
        {quadrimester}º quadrimestre · {famiPreliminaryLabels.panoramaLabel}:{" "}
        {formatPreliminaryPercentage(percentage)}
        {deltaPercentagePoints != null
          ? ` · ${deltaPercentagePoints >= 0 ? "+" : ""}${formatPreliminaryPercentage(deltaPercentagePoints)}`
          : ""}
      </p>
      {methodologyVersion ? <p>Metodologia {methodologyVersion}</p> : null}
      {evolution ? (
        <dl className="grid gap-1 sm:grid-cols-2">
          <div>
            {famiPreliminaryLabels.officialFami}:{" "}
            {formatPreliminaryPercentage(evolution.officialPercentage)}
          </div>
          <div>
            {famiPreliminaryLabels.previousPreliminary}:{" "}
            {formatPreliminaryPercentage(evolution.previousPreliminaryPercentage)}
          </div>
          <div>
            {famiPreliminaryLabels.currentPreliminary}:{" "}
            {formatPreliminaryPercentage(evolution.currentPreliminaryPercentage)}
          </div>
          <div>
            {famiPreliminaryLabels.recoveredPoints}: {evolution.recoveredPoints}
          </div>
          <div className="sm:col-span-2">
            {famiPreliminaryLabels.criteriaNowScoring}: {evolution.criteriaNowScoring}
          </div>
        </dl>
      ) : null}
      {evolution && evolution.rows.length > 0 ? (
        <table className="w-full text-left">
          <thead>
            <tr>
              <th className="py-1 pr-2 font-medium">Critério</th>
              <th className="py-1 pr-2 font-medium">Antes</th>
              <th className="py-1 pr-2 font-medium">Agora</th>
              <th className="py-1 font-medium">Pontos</th>
            </tr>
          </thead>
          <tbody>
            {evolution.rows.map((row) => (
              <tr key={row.questionVersionId}>
                <td className={`${formSurface.brandTable.cell} pl-0`}>{row.questionPrompt}</td>
                <td className={formSurface.brandTable.cell}>
                  {criterionEvolutionLabel(row.previousStatus)}
                </td>
                <td className={formSurface.brandTable.cell}>
                  {criterionEvolutionLabel(row.currentStatus)}
                </td>
                <td className={formSurface.brandTable.cell}>{row.recoveredPoints}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
