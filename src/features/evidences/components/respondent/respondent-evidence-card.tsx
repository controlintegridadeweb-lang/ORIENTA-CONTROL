"use client";

import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import Link from "next/link";
import { ArrowRight, ExternalLink, FileText, Pencil } from "lucide-react";
import { evidenceLabels } from "@/shared/labels/official-labels";
import type { RespondentEvidenceItem } from "@/features/evidences/respondent-service";
import {
  respondentEvidenceDetailLabel,
  respondentEvidenceNavigation,
  respondentStatusNeedsAction,
} from "@/features/evidences/respondent-evidence-helpers";
import { formSurface } from "@/shared/layout/form-surface";
import { EVIDENCE_VALIDATION_REGISTRY } from "@/shared/ui/status-registry";
import { respondentCycleQuestionPath } from "@/shared/navigation/respondent-navigation-context";
import { evidenceFileUrl } from "@/features/evidences/file-links";
import type { ValidationStatus } from "@/features/evidences/schemas";

type Props = {
  item: RespondentEvidenceItem;
  onOpenDetail: (item: RespondentEvidenceItem) => void;
  returnPath: string;
};

/** Navegação contextual: nunca oferece edição quando o diagnóstico está bloqueado. */
function actionsFor(status: RespondentEvidenceItem["respondentStatus"]) {
  switch (respondentEvidenceNavigation(status)) {
    case "correct":
      return { primaryLabel: evidenceLabels.respondCta, primaryIcon: ArrowRight };
    case "follow_up":
      return { primaryLabel: "Acompanhar diagnóstico", primaryIcon: ArrowRight };
    case "edit":
      return { primaryLabel: "Editar diagnóstico", primaryIcon: Pencil };
    case null:
      return { primaryLabel: null, primaryIcon: null };
  }
}

function formatSubmittedDate(iso: string): string {
  return formatPlatformDate(iso, { day: "2-digit", month: "short", year: "numeric" });
}

/** Tipo de comprovação a partir do `kind` de domínio — sem título legado. */
function evidenceKindLabel(evidenceType: string): string {
  switch (evidenceType) {
    case "text":
      return "Textual";
    case "link":
      return "Link";
    case "file":
      return "Anexada";
    case "proof_request":
      return "Solicitada";
    default:
      return "Comprovação";
  }
}

/** Texto de situação — cor semântica, sem badge flutuante. */
function situationTextClass(status: ValidationStatus): string {
  switch (status) {
    case "approved":
      return "font-medium text-brand-700";
    case "invalidated":
      return "font-medium text-rose-700";
    case "adjustment_requested":
      return "font-medium text-amber-800";
    case "submitted":
      return "font-medium text-sky-800";
    case "pending":
      return "font-medium text-amber-800";
    case "not_required":
      return "font-medium text-slate-600";
  }
}

export function RespondentEvidenceCard({ item, onOpenDetail, returnPath }: Props) {
  const needsAction = respondentStatusNeedsAction(item.respondentStatus);
  const actions = actionsFor(item.respondentStatus);
  const detailLabel = respondentEvidenceDetailLabel(item.respondentStatus);
  const formHref = respondentCycleQuestionPath(item.cycleId, item.questionId, returnPath);
  const validationNoteLabel =
    item.respondentStatus === "invalidated"
      ? "Justificativa da não aprovação"
      : "Observação da validação";
  const diagnosisTitle = `${item.formName} v${item.formVersion}`;
  const situationLabel = EVIDENCE_VALIDATION_REGISTRY[item.respondentStatus].label;
  const hasAttachment = Boolean(item.externalLink || item.storagePath);
  const axisSectionLabel = [item.axisName.trim(), item.sectionName.trim()]
    .filter(Boolean)
    .join(" - ");

  return (
    <article
      className={`group ${formSurface.entityListCard} p-4 sm:p-5 ${
        needsAction ? "border-l-3 border-l-amber-300" : ""
      }`}
    >
      <div className="flex min-w-0 flex-col gap-4">
        <header className="min-w-0 space-y-1">
          <h4 className="text-base font-semibold leading-snug text-slate-900">
            {diagnosisTitle}
          </h4>
          {axisSectionLabel ? (
            <p className="text-sm font-semibold leading-snug text-slate-900">
              {axisSectionLabel}
            </p>
          ) : null}
          <p className="text-sm italic leading-snug text-slate-800">
            {evidenceKindLabel(item.evidenceType)}
          </p>
        </header>

        <div className="min-w-0 space-y-1.5">
          <p className="text-sm font-semibold text-slate-900">Critério de origem</p>
          <p className="rounded-lg bg-brand px-3.5 py-2.5 text-sm font-normal leading-relaxed text-white">
            {item.questionPrompt}
          </p>
        </div>

        {hasAttachment ? (
          <div className="min-w-0">
            {item.externalLink ? (
              <a
                href={item.externalLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Link enviado
              </a>
            ) : item.storagePath ? (
              <a
                href={evidenceFileUrl(item.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-sky-700 hover:underline"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Visualizar arquivo
              </a>
            ) : null}
          </div>
        ) : null}

        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
          <div className="min-w-0 space-y-0.5">
            <dt className="text-sm font-semibold text-slate-900">Enviada</dt>
            <dd className="text-sm tabular-nums text-slate-800">
              {formatSubmittedDate(item.submittedAt)}
            </dd>
          </div>
          <div className="min-w-0 space-y-0.5">
            <dt className="text-sm font-semibold text-slate-900">Situação</dt>
            <dd className={`text-sm ${situationTextClass(item.respondentStatus)}`}>
              {situationLabel}
            </dd>
          </div>
          {item.lastValidatedAt ? (
            <div className="min-w-0 space-y-0.5">
              <dt className="text-sm font-semibold text-slate-900">Última atualização</dt>
              <dd className="text-sm tabular-nums text-slate-800">
                {formatSubmittedDate(item.lastValidatedAt)}
              </dd>
            </div>
          ) : null}
        </dl>

        {item.lastJustification ? (
          <div
            className={`rounded-lg border px-3 py-2.5 ${
              item.respondentStatus === "adjustment_requested"
                ? "border-amber-200/80 bg-amber-50/60"
                : item.respondentStatus === "invalidated"
                  ? "border-rose-200 bg-rose-50/60"
                  : "border-slate-200 bg-slate-50/90"
            }`}
          >
            <p className="text-micro font-semibold uppercase tracking-wider text-slate-600">
              {validationNoteLabel}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-800">{item.lastJustification}</p>
          </div>
        ) : null}

        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <button
            type="button"
            onClick={() => onOpenDetail(item)}
            className={`${formSurface.secondaryButtonSm} w-full sm:w-auto`}
          >
            {detailLabel}
          </button>
          {actions.primaryLabel ? (
            <Link
              href={formHref}
              className={`${formSurface.primaryButtonSm} w-full sm:w-auto`}
            >
              {actions.primaryIcon ? (
                <actions.primaryIcon className="h-3.5 w-3.5" aria-hidden />
              ) : null}
              {actions.primaryLabel}
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}
