"use client";

import { Download, ExternalLink, Eye, FileText, Link2, Type } from "lucide-react";
import type { QueueEvidence } from "../queue-model";
import { DOCUMENT_STATUS_LABEL } from "../queue-model";
import {
  EVIDENCE_STATUS_BADGE,
  formatValidationDateTime,
  friendlyEvidenceLinkLabel,
} from "./evidence-card-config";
import { criterionSection } from "./criterion-card-sections";
import { evidenceFileUrl } from "@/features/evidences";
import { formSurface } from "@/shared/layout/form-surface";

function documentStatusLabel(status: QueueEvidence["status"]): string {
  if (
    status === "pending" ||
    status === "approved" ||
    status === "invalidated" ||
    status === "adjustment_requested"
  ) {
    return DOCUMENT_STATUS_LABEL[status];
  }
  return status;
}

export function EvidenceDocumentSummary({ document }: { document: QueueEvidence }) {
  const submittedLabel = formatValidationDateTime(document.submittedAt);
  const linkLabel = friendlyEvidenceLinkLabel(document.externalLink);
  const observation =
    document.kind === "link" &&
    document.linkReason &&
    document.linkReason.trim() !== document.respondentNote?.trim()
      ? document.linkReason
      : null;
  const textTitle = document.title?.trim() || document.fileName?.trim() || "Texto";
  const kindLabel =
    document.kind === "file"
      ? "Arquivo"
      : document.kind === "text"
        ? "Texto"
        : "Link externo";
  const kindIcon =
    document.kind === "file" ? (
      <FileText className="h-4 w-4" />
    ) : document.kind === "text" ? (
      <Type className="h-4 w-4" />
    ) : (
      <Link2 className="h-4 w-4" />
    );

  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex min-w-0 items-start gap-3">
          <span className={`mt-0.5 ${criterionSection.iconWell}`} aria-hidden>
            {kindIcon}
          </span>
          <div className="min-w-0 space-y-1">
            {document.kind === "file" ? (
              <p className="truncate text-sm font-semibold text-slate-900">
                {document.fileName ?? "Arquivo"}
              </p>
            ) : document.kind === "text" ? (
              <p className="truncate text-sm font-semibold text-slate-900">{textTitle}</p>
            ) : (
              <p
                className="truncate text-sm font-semibold text-slate-900"
                title={document.externalLink ?? undefined}
              >
                {linkLabel}
              </p>
            )}
            <p className="text-xs text-slate-500">
              {kindLabel}
              {submittedLabel ? ` · Enviado em ${submittedLabel}` : null}
            </p>
          </div>
        </div>

        {document.kind === "text" && document.textBody?.trim() ? (
          <p className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
            {document.textBody}
          </p>
        ) : null}

        {observation ? (
          <p className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap text-slate-600">
            <span className="font-medium text-slate-700">Observação: </span>
            {observation}
          </p>
        ) : null}

        {document.kind === "file" || document.kind === "link" ? (
          <div className="flex flex-wrap gap-2">
            {document.kind === "file" ? (
              <>
                <a
                  href={evidenceFileUrl(document.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={criterionSection.openAction}
                >
                  <Eye className="h-4 w-4" aria-hidden /> Abrir evidência
                </a>
                <a
                  href={evidenceFileUrl(document.id, { download: true })}
                  className={criterionSection.openAction}
                >
                  <Download className="h-4 w-4" aria-hidden /> Baixar
                </a>
              </>
            ) : (
              <a
                href={document.externalLink ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                title={document.externalLink ?? undefined}
                className={criterionSection.openAction}
              >
                <ExternalLink className="h-4 w-4" aria-hidden /> Abrir evidência
              </a>
            )}
          </div>
        ) : null}
      </div>
      <span
        className={`${formSurface.badge.base} ${EVIDENCE_STATUS_BADGE[document.status]} shrink-0`}
      >
        {documentStatusLabel(document.status)}
      </span>
    </div>
  );
}
