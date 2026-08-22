"use client";

import Link from "next/link";
import { ArrowRight, FileText, Link2 } from "lucide-react";
import type { ActionPlanAction, ActionPlanDocument } from "@/features/improvement-management/action-plans/domain-model";
import {
  ACTION_DOCUMENT_STATUS_LABEL,
  summarizeActionDocuments,
} from "@/features/improvement-management/action-plans/monitoring/summarize-action-documents";
import { formatLocalDate } from "@/shared/datetime/business-date";
import { PanelSection } from "@/shared/ui/components/panel-section";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { statusPillBase } from "@/shared/ui/components/status-pill";

type Props = {
  plan: ActionPlanAction;
  consultHref: string | null;
};

function statusBadgeClass(
  status: ActionPlanDocument["fileValidationStatus"],
): string {
  if (status === "valid") return formSurface.badge.success;
  if (status === "rejected") return formSurface.badge.danger;
  if (status === "removed") return formSurface.badge.muted;
  return formSurface.badge.info;
}

function documentTitle(document: ActionPlanDocument): string {
  return document.title.trim() || document.originalFilename || "Comprovação";
}

function documentMeta(document: ActionPlanDocument): string {
  const date = formatLocalDate(document.createdAt);
  if (document.kind === "link" && document.externalLink) {
    try {
      return `${date} · ${new URL(document.externalLink).hostname}`;
    } catch {
      return date;
    }
  }
  if (document.kind === "file" && document.originalFilename) {
    return `${date} · ${document.originalFilename}`;
  }
  return date;
}

export function ExecutionProofsSection({ plan, consultHref }: Props) {
  const summary = summarizeActionDocuments(plan.documents);
  const consultLink = consultHref ? (
    <Link href={consultHref} className={formSurface.secondaryButtonSm}>
      Consultar comprovações
      <ArrowRight className="h-3.5 w-3.5" aria-hidden />
    </Link>
  ) : null;

  return (
    <PanelSection title="Comprovações da execução" size="compact">
      {summary.current.length === 0 ? (
        <p className={typography.auxiliary}>Nenhuma comprovação nesta revisão da ação.</p>
      ) : (
        <div className="space-y-3">
          {summary.line ? <p className={typography.meta}>{summary.line}</p> : null}
          <ul className="space-y-2">
            {summary.recent.map((document) => {
              const KindIcon = document.kind === "file" ? FileText : Link2;
              return (
                <li
                  key={document.id}
                  className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3"
                >
                  <span
                    className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-800"
                    aria-hidden
                  >
                    <KindIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {documentTitle(document)}
                    </p>
                    <p className={`mt-0.5 truncate ${typography.meta}`}>
                      {documentMeta(document)}
                    </p>
                  </div>
                  <span
                    className={`${statusPillBase} ${statusBadgeClass(document.fileValidationStatus)} shrink-0`}
                  >
                    {ACTION_DOCUMENT_STATUS_LABEL[document.fileValidationStatus]}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {consultLink ? <div className="mt-3">{consultLink}</div> : null}
    </PanelSection>
  );
}
