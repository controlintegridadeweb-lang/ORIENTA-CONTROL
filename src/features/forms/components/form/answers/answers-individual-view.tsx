"use client";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import {
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileCheck2,
  Inbox,
  Users,
} from "lucide-react";
import type {
  AnswerValue,
  RespondentAnswerCell,
  RespondentDetail,
} from "@/features/forms/answers-types";
import { evidenceLabels, perguntaLabels } from "@/shared/labels/official-labels";
import { evidenceFileUrl } from "@/features/evidences";
import { formSurface } from "@/shared/layout/form-surface";
import { CriterionScore } from "@/features/forms/components/criterion-score";
import type { CriterionEvidenceStatus } from "@/features/forms/components/criterion-score";
import { AnswersStatusBadge } from "./answers-status-badge";

const ANSWER_LABEL: Record<AnswerValue, string> = {
  yes: "Sim",
  no: "Não",
  not_applicable: perguntaLabels.notApplicableInDiagnosis,
};

const ANSWER_BADGE: Record<AnswerValue, string> = {
  yes: `${formSurface.badge.base} ${formSurface.badge.success}`,
  no: `${formSurface.badge.base} ${formSurface.badge.danger}`,
  not_applicable: `${formSurface.badge.base} ${formSurface.badge.warning}`,
};

const VALIDATION_LABEL: Record<string, string> = {
  approved: "Aprovada",
  invalidated: "Não aprovada",
  pending: "Pendente",
  adjustment_requested: evidenceLabels.adjustmentRequested,
};

function formatDate(iso: string | null): string {
  return formatPlatformDateTime(iso, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }, iso || "—");
}

function resolveCellEvidenceStatus(
  cell: RespondentAnswerCell,
): CriterionEvidenceStatus {
  const statuses = cell.evidences
    .map((item) => item.validationStatus)
    .filter((status): status is string => Boolean(status));

  if (statuses.some((status) => status === "approved")) return "approved";
  if (
    statuses.some(
      (status) => status === "invalidated" || status === "insufficient_evidence",
    )
  ) {
    return "insufficient";
  }
  if (statuses.some((status) => status === "adjustment_requested")) {
    return "rejected";
  }
  if (cell.evidences.length > 0) return "pending";
  return "not_submitted";
}

function AnswerBadge({ value }: { value: AnswerValue | null }) {
  if (!value) {
    return (
      <span className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}>
        Sem resposta
      </span>
    );
  }
  return <span className={ANSWER_BADGE[value]}>{ANSWER_LABEL[value]}</span>;
}

function WaiverBadge({ cell }: { cell: RespondentAnswerCell }) {
  if (cell.isWaived) {
    return (
      <span
        className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}
        title={cell.waiverReason ?? perguntaLabels.notApplicableForOrganization}
      >
        {perguntaLabels.notApplicableForOrganization}
      </span>
    );
  }
  if (cell.isNotApplicable) {
    return (
      <span className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}>
        {perguntaLabels.notApplicableInDiagnosis}
      </span>
    );
  }
  return null;
}

function AnswerCellView({
  cell,
  cycleState,
}: {
  cell: RespondentAnswerCell;
  cycleState: string;
}) {
  const effectiveAnswer =
    cell.isWaived || cell.isNotApplicable
      ? "not_applicable"
      : cell.answer;

  return (
    <article className={`${formSurface.nestedCardWithHeader}`}>
      <header className={`${formSurface.cardHeader} space-y-1`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-brand-100 px-1.5 text-xs font-semibold text-brand-800">
            {cell.orderIndex + 1}
          </span>
          <AnswerBadge value={cell.answer} />
          <WaiverBadge cell={cell} />
          {cell.updatedAt ? (
            <span className="ml-auto text-xs text-slate-500">
              {formatDate(cell.updatedAt)}
            </span>
          ) : null}
        </div>
        <h3 className={`${formSurface.cardTitle} leading-snug`}>{cell.prompt}</h3>
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {cell.requiresEvidence ? (
            <span className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}>
              Exige evidência
            </span>
          ) : null}
          <CriterionScore
            answer={effectiveAnswer}
            requiresEvidence={cell.requiresEvidence}
            evidenceStatus={resolveCellEvidenceStatus(cell)}
            famiEnabled={cell.famiEnabled}
            includedInCalculation={!cell.isWaived}
            diagnosisStatus={cycleState}
          />
          {!cell.famiEnabled ? (
            <span className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}>
              Não compõe o FAMI
            </span>
          ) : null}
        </div>
      </header>
      <div className="space-y-3 px-5 py-4 sm:px-6">
        {cell.notes && cell.notes.trim().length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Observacoes
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800">
              {cell.notes}
            </p>
          </div>
        ) : null}

        {cell.evidences.length > 0 ? (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Evidências ({cell.evidences.length})
            </p>
            {cell.evidences.map((evidence) => (
              <div
                key={evidence.id}
                className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
              >
                <div className="flex items-start gap-2">
                  <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-700" aria-hidden />
                  <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-slate-900">
                      {evidence.title}
                </p>
                    {evidence.description ? (
                  <p className="mt-0.5 text-xs text-slate-600">
                        {evidence.description}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      {evidence.validationStatus ? (
                    <span
                      className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}
                    >
                          {VALIDATION_LABEL[evidence.validationStatus] ??
                            evidence.validationStatus}
                    </span>
                  ) : null}
                      {evidence.externalLink ? (
                    <a
                          href={evidence.externalLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
                    >
                      Abrir link
                      <ExternalLink className="h-3 w-3" aria-hidden />
                    </a>
                  ) : null}
                      {evidence.storagePath ? (
                        <a
                          href={evidenceFileUrl(evidence.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline"
                        >
                          Abrir arquivo
                          <ExternalLink className="h-3 w-3" aria-hidden />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {cell.createdByName ? (
          <p className="text-xs text-slate-500">
            Preenchido por <span className="font-medium">{cell.createdByName}</span>
          </p>
        ) : null}
      </div>
    </article>
  );
}

type Props = {
  detail: RespondentDetail;
  position: { current: number; total: number };
  onBack: () => void;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
};

export function AnswersIndividualView({
  detail,
  position,
  onBack,
  onPrev,
  onNext,
}: Props) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className={`${formSurface.ghostButton} text-brand-700`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar para a lista
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 tabular-nums">
            {position.current} / {position.total}
          </span>
          <button
            type="button"
            onClick={onPrev ?? undefined}
            disabled={!onPrev}
            aria-label="Resposta anterior"
            className={`${formSurface.secondaryButtonSm} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            Anterior
          </button>
          <button
            type="button"
            onClick={onNext ?? undefined}
            disabled={!onNext}
            aria-label="Próxima resposta"
            className={`${formSurface.secondaryButtonSm} disabled:cursor-not-allowed disabled:opacity-50`}
          >
            Próxima
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      <article className={formSurface.nestedCardWithHeader}>
        <header className={`${formSurface.cardHeader} space-y-2`}>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={formSurface.cardTitle}>
              {detail.organizationName || "Organização sem nome"}
            </h2>
            <AnswersStatusBadge status={detail.status} />
            <span className={`${formSurface.badge.base} ${formSurface.badge.neutral}`}>
              Período {detail.periodLabel}
            </span>
          </div>
          <p className={formSurface.cardDescription}>
            {detail.answeredQuestions} de {detail.applicableQuestions} perguntas
            aplicáveis respondidas
            {detail.waivedQuestions > 0
              ? ` (${detail.waivedQuestions} pergunta${detail.waivedQuestions === 1 ? "" : "s"} não aplicável${detail.waivedQuestions === 1 ? "" : "is"} a esta organização)`
              : ""}
            .
          </p>
        </header>
        <dl className="grid grid-cols-1 gap-3 px-5 py-4 sm:grid-cols-3 sm:px-6">
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              Última atualização
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {formatDate(detail.lastUpdatedAt)}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              Primeira resposta
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {formatDate(detail.firstAnsweredAt)}
            </dd>
          </div>
          <div>
            <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <Users className="h-3.5 w-3.5" aria-hidden />
              Contribuintes
            </dt>
            <dd className="mt-1 text-sm text-slate-800">
              {detail.contributors.length === 0
                ? "—"
                : detail.contributors
                    .map((c) => c.fullName ?? "Usuário sem nome")
                    .join(", ")}
            </dd>
          </div>
        </dl>
      </article>

      {detail.answers.length === 0 ? (
        <div className={formSurface.empty.container}>
          <span className={formSurface.empty.iconWrap}>
            <Inbox className="h-5 w-5" aria-hidden />
          </span>
          <p className={formSurface.empty.title}>Sem perguntas configuradas</p>
          <p className={formSurface.empty.description}>
            Este formulário não possui perguntas para exibir.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {detail.answers.map((cell) => (
            <AnswerCellView
              key={cell.questionId}
              cell={cell}
              cycleState={detail.cycleState}
            />
          ))}
        </div>
      )}
    </div>
  );
}
