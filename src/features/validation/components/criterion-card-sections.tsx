"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { FileX2 } from "lucide-react";
import type { EvidenceVerdict, QueueEvidenceGroup } from "../queue-model";
import { answerLabel, VERDICT_LABEL } from "../queue-model";
import {
  absentDecisionMeta,
  EVIDENCE_STATUS_BADGE,
  formatValidationDateTime,
} from "./evidence-card-config";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";

type SectionAccent = "brand" | "warning" | "success" | "danger" | "info" | "neutral";

const SECTION_ACCENT: Record<SectionAccent, string> = {
  brand: "bg-brand-400",
  warning: "bg-amber-400",
  success: "bg-emerald-500",
  danger: "bg-rose-400",
  info: "bg-sky-400",
  neutral: "bg-slate-300",
};

/** Tokens visuais compartilhados pelas seções do card de critério. */
export const criterionSection = {
  stack: "flex flex-col",
  block: "space-y-3",
  blockDivided: "space-y-3",
  /** Separador pontilhado entre containers do card — sempre o mesmo. */
  divider: "my-4 border-t border-dashed border-slate-300 sm:my-5",
  title: "text-sm font-semibold tracking-tight text-slate-900",
  description: "mt-1 text-xs leading-relaxed text-slate-500",
  panel:
    "space-y-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:p-4",
  innerCard:
    "rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:p-4",
  iconWell:
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700",
  openAction:
    "inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-sm font-medium text-brand-800 transition hover:border-brand-300 hover:bg-brand-100",
} as const;

/** Linha pontilhada entre seções do EvidenceCard. */
export function CriterionSectionDivider() {
  return (
    <div
      role="separator"
      aria-hidden
      className={criterionSection.divider}
      data-testid="criterion-section-divider"
    />
  );
}

/** Painel de seção com faixa lateral — mesma linguagem em todo o card. */
export function CriterionSectionPanel({
  children,
  accent = "brand",
  className,
  ...rest
}: {
  children: ReactNode;
  accent?: SectionAccent;
  className?: string;
} & HTMLAttributes<HTMLElement>) {
  return (
    <section
      className={`flex overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm ${className ?? ""}`}
      {...rest}
    >
      <span
        className={`w-1 shrink-0 ${SECTION_ACCENT[accent]}`}
        aria-hidden
      />
      <div className="min-w-0 flex-1 space-y-3 p-3.5 sm:p-4">{children}</div>
    </section>
  );
}

export function CriterionSectionHeading({
  id,
  title,
  description,
}: {
  id?: string;
  title: ReactNode;
  description?: ReactNode;
}) {
  return (
    <div>
      <h4 id={id} className={criterionSection.title}>
        {title}
      </h4>
      {description ? (
        <p className={criterionSection.description}>{description}</p>
      ) : null}
    </div>
  );
}

type AnalysisTone = "warning" | "success" | "danger" | "info" | "neutral";

export type CriterionAnalysisStateModel = {
  tone: AnalysisTone;
  title: string;
  description: string;
  meta: string | null;
  observation: string | null;
};

const ANALYSIS_TONE_CLASS: Record<AnalysisTone, string> = {
  warning: "bg-amber-50 text-amber-950",
  success: "bg-emerald-50 text-emerald-950",
  danger: "bg-rose-50 text-rose-950",
  info: "bg-sky-50 text-sky-950",
  neutral: "bg-slate-50 text-slate-800",
};

const ANALYSIS_ACCENT: Record<AnalysisTone, SectionAccent> = {
  warning: "warning",
  success: "success",
  danger: "danger",
  info: "info",
  neutral: "neutral",
};

export function resolveCriterionAnalysisState(
  group: QueueEvidenceGroup,
): CriterionAnalysisStateModel {
  const hasDocuments = group.documents.length > 0;
  const meta = absentDecisionMeta(group);
  const observation = group.adminProofObservation?.trim() || null;

  if (!hasDocuments) {
    return resolveAbsentProofAnalysisState(group.status, meta, observation);
  }

  return resolveDocumentAnalysisState(group.status, meta, observation);
}

function resolveAbsentProofAnalysisState(
  status: EvidenceVerdict,
  meta: string | null,
  observation: string | null,
): CriterionAnalysisStateModel {
  switch (status) {
    case "validated_without_proof":
      return {
        tone: "success",
        title: "Resposta validada sem comprovação",
        description:
          "A resposta positiva permanece com 1,0 ponto; os 0,5 adicionais não foram concedidos. Isto não se confunde com “Não se aplica”.",
        meta,
        observation,
      };
    case "considered_insufficient":
      return {
        tone: "danger",
        title: "Critério insuficiente",
        description:
          "A resposta original e o histórico foram preservados. O critério recebe 0 ponto e gera recomendação — distinto de “Não se aplica”.",
        meta,
        observation,
      };
    case "proof_requested":
      return {
        tone: "info",
        title: "Comprovação solicitada",
        description:
          "O respondente precisa apresentar comprovação para este critério.",
        meta,
        observation,
      };
    default:
      return {
        tone: "warning",
        title: "Resposta positiva sem comprovação",
        description:
          "A resposta foi registrada, mas não houve comprovação apresentada. O critério aguarda decisão administrativa.",
        meta: null,
        observation: null,
      };
  }
}

function resolveDocumentAnalysisState(
  status: EvidenceVerdict,
  meta: string | null,
  observation: string | null,
): CriterionAnalysisStateModel {
  switch (status) {
    case "approved":
      return {
        tone: "success",
        title: "Evidência aprovada",
        description:
          "A comprovação foi aceita para este critério.",
        meta,
        observation,
      };
    case "invalidated":
    case "considered_insufficient":
      return {
        tone: "danger",
        title: "Evidência insuficiente",
        description:
          "A comprovação apresentada não foi aceita. A resposta original permanece no histórico.",
        meta,
        observation,
      };
    case "adjustment_requested":
      return {
        tone: "info",
        title: "Ajuste solicitado",
        description:
          "Foi solicitado ajuste da comprovação. O respondente precisa complementar ou corrigir o envio.",
        meta,
        observation,
      };
    case "proof_requested":
      return {
        tone: "info",
        title: "Comprovação solicitada",
        description:
          "O critério aguarda nova comprovação do respondente.",
        meta,
        observation,
      };
    case "validated_without_proof":
      return {
        tone: "success",
        title: "Resposta validada sem comprovação",
        description:
          "A resposta positiva foi mantida sem os pontos adicionais de evidência.",
        meta,
        observation,
      };
    case "not_presented":
      return {
        tone: "warning",
        title: "Resposta positiva sem comprovação",
        description:
          "A resposta foi registrada, mas não houve comprovação apresentada. O critério aguarda decisão administrativa.",
        meta: null,
        observation: null,
      };
    default:
      return {
        tone: "warning",
        title: "Aguardando validação da evidência",
        description:
          "Analise a comprovação apresentada e registre o resultado da validação.",
        meta: null,
        observation: null,
      };
  }
}

export function CriterionHeader({
  group,
  showSectionContext = true,
}: {
  group: QueueEvidenceGroup;
  showSectionContext?: boolean;
}) {
  const hasOrder =
    Number.isFinite(group.orderIndex) &&
    group.orderIndex < Number.MAX_SAFE_INTEGER;
  const answeredAt = formatValidationDateTime(group.answeredAt);

  return (
    <header className="space-y-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm sm:p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {hasOrder ? (
            <span
              className={
                "inline-flex h-7 min-w-7 items-center justify-center rounded-lg " +
                "bg-brand-50 px-1.5 text-xs font-semibold tabular-nums text-brand-800"
              }
            >
              {group.orderIndex + 1}
            </span>
          ) : null}
          {showSectionContext ? (
            <p className={`${typography.meta} text-slate-600`}>
              {group.axisName} · {group.sectionName}
            </p>
          ) : null}
        </div>
        <span
          className={`${formSurface.badge.base} ${EVIDENCE_STATUS_BADGE[group.status]} shrink-0 self-start`}
        >
          {VERDICT_LABEL[group.status]}
        </span>
      </div>

      <h3 className={typography.subsectionTitle}>
        {group.questionPrompt}
      </h3>

      {group.answeredByName || answeredAt ? (
        <p className="text-xs text-slate-500">
          {group.answeredByName
            ? `Responsável: ${group.answeredByName}`
            : null}
          {group.answeredByName && answeredAt ? " · " : null}
          {answeredAt}
        </p>
      ) : null}
    </header>
  );
}

export function CriterionResponseSection({
  group,
}: {
  group: QueueEvidenceGroup;
}) {
  const answerTone =
    group.answer === "yes" ? formSurface.badge.success : formSurface.badge.neutral;

  return (
    <CriterionSectionPanel
      accent="brand"
      aria-labelledby={`answer-${group.responseId}`}
    >
      <CriterionSectionHeading
        id={`answer-${group.responseId}`}
        title="Resposta do órgão"
      />
      <dl className="grid gap-3 sm:grid-cols-2">
        <div className={formSurface.fieldGroup}>
          <dt className={formSurface.label}>Resposta registrada</dt>
          <dd>
            <span className={`${formSurface.badge.base} ${answerTone}`}>
              {answerLabel(group.answer)}
            </span>
          </dd>
        </div>
        {group.respondentNote ? (
          <div className={`${formSurface.fieldGroup} sm:col-span-2`}>
            <dt className={formSurface.label}>Informação complementar</dt>
            <dd className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
              {group.respondentNote}
            </dd>
          </div>
        ) : null}
      </dl>
    </CriterionSectionPanel>
  );
}

export function CriterionEvidenceSection({
  responseId,
  evidenceCount,
  children,
}: {
  responseId: string;
  evidenceCount: number;
  children: ReactNode;
}) {
  const titleId = `evidences-${responseId}`;
  const title =
    evidenceCount > 0
      ? `Comprovações apresentadas (${evidenceCount})`
      : "Comprovações apresentadas";

  return (
    <section className={criterionSection.block} aria-labelledby={titleId}>
      <CriterionSectionHeading id={titleId} title={title} />
      {children}
    </section>
  );
}

export function CriterionEvidenceEmptyState() {
  return (
    <div
      className="flex overflow-hidden rounded-xl border border-amber-200/80 bg-white shadow-sm"
      role="status"
      data-testid="criterion-evidence-empty"
    >
      <span className="w-1 shrink-0 bg-amber-400" aria-hidden />
      <div className="flex min-w-0 flex-1 gap-3 p-3.5 sm:p-4">
        <span
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"
          aria-hidden
        >
          <FileX2 className="h-4 w-4" />
        </span>
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-900">
              Nenhuma comprovação
            </p>
            <span
              className={`${formSurface.badge.base} ${formSurface.badge.warning} shrink-0`}
            >
              Não apresentada
            </span>
          </div>
          <p className="text-xs leading-relaxed text-slate-500">
            A resposta foi registrada, mas não houve envio de comprovação para
            este critério.
          </p>
        </div>
      </div>
    </div>
  );
}

export function CriterionAnalysisState({
  group,
}: {
  group: QueueEvidenceGroup;
}) {
  const state = resolveCriterionAnalysisState(group);
  const titleId = `analysis-state-${group.responseId}`;

  return (
    <section className={criterionSection.block} aria-labelledby={titleId}>
      <CriterionSectionHeading id={titleId} title="Estado da análise" />
      <div
        className={`flex overflow-hidden rounded-xl border border-slate-200/60 shadow-sm ${ANALYSIS_TONE_CLASS[state.tone]}`}
        role="status"
        data-testid="criterion-analysis-state"
      >
        <span
          className={`w-1 shrink-0 ${SECTION_ACCENT[ANALYSIS_ACCENT[state.tone]]}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1 px-3.5 py-3 sm:px-4">
          <p className="text-sm font-semibold">{state.title}</p>
          <p className="mt-1 text-sm leading-relaxed opacity-95">
            {state.description}
          </p>
          {state.observation ? (
            <p className="mt-2 text-xs leading-relaxed opacity-90">
              {group.status === "considered_insufficient" ||
              group.status === "invalidated"
                ? `Justificativa: ${state.observation}`
                : group.status === "proof_requested" ||
                    group.status === "adjustment_requested"
                  ? `Orientação: ${state.observation}`
                  : `Observação: ${state.observation}`}
            </p>
          ) : null}
          {state.meta ? (
            <p className="mt-1 text-xs opacity-90">{state.meta}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function CriterionAdministrativeDecisionSection({
  responseId,
  children,
  empty = false,
}: {
  responseId: string;
  children?: ReactNode;
  empty?: boolean;
}) {
  const titleId = `admin-decision-${responseId}`;

  return (
    <CriterionSectionPanel
      accent="brand"
      aria-labelledby={titleId}
      data-testid="criterion-admin-decision"
    >
      <CriterionSectionHeading
        id={titleId}
        title="Decisão administrativa do critério"
        description="Estas decisões alteram a classificação ou o tratamento administrativo do critério completo."
      />

      {empty ? (
        <p className="text-xs leading-relaxed text-slate-500">
          Nenhuma ação administrativa disponível neste momento. As decisões
          sobre comprovações ficam no card de cada evidência.
        </p>
      ) : (
        <div className="space-y-3">{children}</div>
      )}
    </CriterionSectionPanel>
  );
}
