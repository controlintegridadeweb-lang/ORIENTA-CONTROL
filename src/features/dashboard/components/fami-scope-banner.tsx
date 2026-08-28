"use client";

import type { ReactNode } from "react";
import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { isOfficialFamiEligible } from "@/shared/domain/workflow";
import { cycleStateLabel } from "@/shared/domain/cycle-labels";
import { formSurface } from "@/shared/layout/form-surface";

export type FamiScopeBannerProps = {
  formName: string | null;
  cycleState: string | null;
  isOfficialScore: boolean;
  applicableQuestions: number;
  waivedQuestions: number;
  notApplicableResponses: number;
  snapshotYearApplied: number | null;
  calculatedAt: string | null;
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  const formatted = formatPlatformDateTime(
    iso,
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
    "",
  );
  return formatted || null;
}

function MetaChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-xs text-brand-800">
      {children}
    </span>
  );
}

/** Contexto de um Resultado FAMI associado a um diagnóstico específico. */
export function FamiScopeBanner({
  formName,
  cycleState,
  isOfficialScore,
  applicableQuestions,
  waivedQuestions,
  notApplicableResponses,
  snapshotYearApplied,
  calculatedAt,
}: FamiScopeBannerProps) {
  const calculated = formatDate(calculatedAt);
  const visibleState = cycleStateLabel(cycleState);
  const isReopened = isOfficialScore && !isOfficialFamiEligible(cycleState);
  const label = !isOfficialScore
    ? "FAMI pendente — calculado ao concluir a validação"
    : isReopened
      ? "FAMI oficial · diagnóstico reaberto"
      : "FAMI oficial";

  const applicabilityDetail = [
    waivedQuestions > 0
      ? `${waivedQuestions} pergunta${waivedQuestions === 1 ? "" : "s"} não aplicável${waivedQuestions === 1 ? "" : "is"} a esta organização`
      : null,
    notApplicableResponses > 0
      ? `${notApplicableResponses} resposta${notApplicableResponses === 1 ? "" : "s"} “Não se aplica neste diagnóstico”`
      : null,
  ]
    .filter(Boolean)
    .join("; ");

  const questionsLabel =
    applicableQuestions === 1
      ? "1 pergunta aplicável"
      : `${applicableQuestions} perguntas aplicáveis`;

  if (!isOfficialScore) {
    return (
      <div role="status" className={formSurface.messageNeutral}>
        <p className="text-sm font-semibold text-slate-800">{label}</p>
        {formName ? <p className="mt-0.5 truncate text-sm text-slate-600">{formName}</p> : null}
      </div>
    );
  }

  return (
    <div
      role="status"
      className="overflow-hidden rounded-xl border border-brand-200 bg-brand-50"
    >
      <div className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4 sm:px-5">
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold tracking-tight text-brand-950">{label}</p>
          {formName ? <p className="truncate text-sm text-brand-800">{formName}</p> : null}
        </div>

        {visibleState ? (
          <span className={`${formSurface.badge.base} ${formSurface.badge.brand} shrink-0 self-start`}>
            {visibleState}
          </span>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-brand-200 bg-white px-4 py-2.5 sm:px-5">
        <MetaChip>
          <span>
            {questionsLabel}
            {applicabilityDetail ? (
              <span className="text-brand-700"> ({applicabilityDetail})</span>
            ) : null}
          </span>
        </MetaChip>
        {snapshotYearApplied != null ? (
          <MetaChip>processamento {snapshotYearApplied}</MetaChip>
        ) : null}
        {calculated ? <MetaChip>calculado em {calculated}</MetaChip> : null}
      </div>
    </div>
  );
}
