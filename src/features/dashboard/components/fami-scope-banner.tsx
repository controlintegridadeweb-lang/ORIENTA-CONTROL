"use client";

import type { ReactNode } from "react";
import { Fragment } from "react";
import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { CalendarClock, Info, Lock, LockOpen } from "lucide-react";
import { isOfficialFamiEligible } from "@/shared/domain/workflow";
import { cycleStateLabel } from "@/shared/domain/cycle-labels";

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

function MetaRow({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${muted ? "opacity-90" : ""}`}
    >
      {children}
    </div>
  );
}

function MetaDivider() {
  return (
    <span
      className="hidden h-3 w-px shrink-0 self-center bg-current opacity-25 sm:block"
      aria-hidden
    />
  );
}

function joinMeta(items: Array<{ key: string; node: ReactNode }>) {
  return items.map((item, index) => (
    <Fragment key={item.key}>
      {index > 0 ? <MetaDivider /> : null}
      {item.node}
    </Fragment>
  ));
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
  const Icon = isOfficialScore ? (isReopened ? LockOpen : Lock) : Info;
  const tone = isOfficialScore
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-slate-200 bg-slate-50 text-slate-700";

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

  const primary: Array<{ key: string; node: ReactNode }> = [
    {
      key: "label",
      node: (
        <span className="inline-flex items-center gap-1.5 font-semibold">
          <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {label}
        </span>
      ),
    },
  ];
  if (formName) {
    primary.push({
      key: "form",
      node: <span className="font-medium">{formName}</span>,
    });
  }
  if (visibleState) {
    primary.push({
      key: "state",
      node: (
        <span>
          <span className="font-medium">situação:</span> {visibleState}
        </span>
      ),
    });
  }

  const secondary: Array<{ key: string; node: ReactNode }> = [];
  if (isOfficialScore) {
    secondary.push({
      key: "questions",
      node: (
        <span>
          {applicableQuestions} perguntas aplicáveis
          {applicabilityDetail ? (
            <span className="opacity-80"> ({applicabilityDetail})</span>
          ) : null}
        </span>
      ),
    });
    if (snapshotYearApplied != null) {
      secondary.push({
        key: "year",
        node: <span>processamento {snapshotYearApplied}</span>,
      });
    }
    if (calculated) {
      secondary.push({
        key: "calc",
        node: (
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="h-3 w-3 shrink-0" aria-hidden />
            calculado em {calculated}
          </span>
        ),
      });
    }
  }

  return (
    <div className={`space-y-1.5 rounded-md border px-3 py-2.5 text-xs ${tone}`}>
      <MetaRow>{joinMeta(primary)}</MetaRow>
      {secondary.length > 0 ? <MetaRow muted>{joinMeta(secondary)}</MetaRow> : null}
    </div>
  );
}
