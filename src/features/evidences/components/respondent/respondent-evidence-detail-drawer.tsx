"use client";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import Link from "next/link";
import { ArrowRight, Pencil } from "lucide-react";
import { Drawer } from "@/shared/ui/components/drawer";
import { perguntaLabels, evidenceLabels } from "@/shared/labels/official-labels";
import type { RespondentEvidenceItem } from "@/features/evidences/respondent-service";
import {
  respondentEvidenceNavigation,
  respondentStatusNeedsAction,
} from "@/features/evidences/respondent-evidence-helpers";
import { normalizeWorkbenchText } from "@/features/evidences/normalize-workbench-text";
import { formSurface } from "@/shared/layout/form-surface";
import { RespondentStatusBadge } from "./respondent-evidence-status-badge";
import { RespondentEvidenceTimeline } from "./respondent-evidence-timeline";
import { respondentCycleQuestionPath } from "@/shared/navigation/respondent-navigation-context";
import { EvidenceFileActions } from "@/features/evidences/components/admin/evidence-file-actions";

type Props = {
  open: boolean;
  item: RespondentEvidenceItem | null;
  onClose: () => void;
  returnPath: string;
};

const SECTION =
  "overflow-hidden rounded-xl border border-slate-200/80 border-l-[3px] border-l-brand-400 bg-white p-4 shadow-card sm:p-5";

function actionFor(status: RespondentEvidenceItem["respondentStatus"]) {
  switch (respondentEvidenceNavigation(status)) {
    case "correct":
      return { label: evidenceLabels.respondCta, icon: ArrowRight };
    case "follow_up":
      return { label: "Acompanhar diagnóstico", icon: ArrowRight };
    case "edit":
      return { label: "Editar diagnóstico", icon: Pencil };
    case null:
      return null;
  }
}

export function RespondentEvidenceDetailDrawer({
  open,
  item,
  onClose,
  returnPath,
}: Props) {
  if (!item) return null;
  const action = actionFor(item.respondentStatus);
  const formHref = respondentCycleQuestionPath(item.cycleId, item.questionId, returnPath);
  const validationNoteLabel =
    item.respondentStatus === "invalidated"
      ? "Justificativa da não aprovação"
      : "Observação da validação";
  const drawerTitle = `${item.formName} v${item.formVersion}`;
  const drawerSubtitle = [item.axisName.trim(), item.sectionName.trim()]
    .filter(Boolean)
    .join(" · ");

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={drawerTitle}
      description={drawerSubtitle || undefined}
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <button type="button" onClick={onClose} className={formSurface.secondaryButtonSm}>
            Fechar
          </button>
          {action ? (
            <Link href={formHref} className={formSurface.primaryButtonSm}>
              <action.icon className="h-3.5 w-3.5" aria-hidden />
              {action.label}
            </Link>
          ) : null}
        </div>
      }
    >
      <div className="space-y-4 sm:space-y-5">
        <section className={`${SECTION} space-y-4`}>
          <header className="space-y-3">
            <p className="text-sm font-semibold tracking-tight text-slate-800">Contexto</p>
            <div className="flex flex-wrap items-center gap-2">
              <RespondentStatusBadge status={item.respondentStatus} />
              {respondentStatusNeedsAction(item.respondentStatus) ? (
                <span className={`${formSurface.badge.base} ${formSurface.badge.warning}`}>
                  Ação necessária
                </span>
              ) : null}
            </div>
          </header>
          <div className="rounded-lg border border-slate-100 bg-slate-50/70 px-3.5 py-3">
            <p className={formSurface.label}>{perguntaLabels.singular}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-800">
              {item.questionPrompt}
            </p>
          </div>
        </section>

        <section className={`${SECTION} space-y-4`}>
          <p className="text-sm font-semibold tracking-tight text-slate-800">Conteúdo</p>
          <dl className="space-y-3.5 text-sm">
            {item.description ? (
              <div className="rounded-lg border border-slate-100 bg-white/80 px-3.5 py-3">
                <dt className={formSurface.label}>Resposta enviada</dt>
                <dd className="mt-1.5 text-slate-700">
                  {normalizeWorkbenchText(item.description)}
                </dd>
              </div>
            ) : null}

            <div
              className={[
                "rounded-lg border px-3.5 py-3",
                item.externalLink
                  ? "border-sky-100 bg-sky-50/50"
                  : item.storagePath
                    ? "border-brand-100 bg-brand-50/40"
                    : "border-slate-100 bg-white/80",
              ].join(" ")}
            >
              <dt className={formSurface.label}>Evidência</dt>
              <dd className="mt-2">
                {item.evidenceType === "text" && item.textBody ? (
                  <p className="whitespace-pre-wrap text-slate-700">
                    {normalizeWorkbenchText(item.textBody)}
                  </p>
                ) : item.externalLink ? (
                  <a
                    href={item.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/80 bg-white px-3 py-2 text-sm font-medium text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
                  >
                    Abrir link enviado
                  </a>
                ) : item.storagePath ? (
                  <EvidenceFileActions evidenceId={item.id} />
                ) : (
                  <span className="text-slate-500">
                    {item.evidenceType === "proof_request"
                      ? "Nenhuma comprovação foi enviada ainda. Use Corrigir evidência para apresentar a comprovação."
                      : "Sem comprovação registrada."}
                  </span>
                )}
              </dd>
              <p className="mt-2.5 text-xs leading-relaxed text-slate-500">
                Tipo:{" "}
                {item.evidenceType === "proof_request"
                  ? "Comprovação solicitada"
                  : item.evidenceType === "text"
                    ? "Texto"
                    : item.evidenceType}
                <span className="text-slate-300"> · </span>
                {item.evidenceType === "proof_request" ? "Solicitada em" : "Enviada em"}{" "}
                <time dateTime={item.submittedAt} className="font-medium text-slate-600">
                  {formatPlatformDateTime(item.submittedAt, { dateStyle: "short", timeStyle: "short" })}
                </time>
              </p>
            </div>

            {item.lastJustification ? (
              <div
                className={[
                  "rounded-lg border px-3.5 py-3",
                  item.respondentStatus === "invalidated"
                    ? "border-rose-100 bg-rose-50/50"
                    : "border-amber-100 bg-amber-50/60",
                ].join(" ")}
              >
                <dt
                  className={[
                    "text-xs font-medium uppercase tracking-wide",
                    item.respondentStatus === "invalidated"
                      ? "text-rose-800/80"
                      : "text-amber-800/80",
                  ].join(" ")}
                >
                  {validationNoteLabel}
                </dt>
                <dd
                  className={[
                    "mt-1.5 text-sm leading-relaxed",
                    item.respondentStatus === "invalidated"
                      ? "text-rose-950/80"
                      : "text-amber-950/80",
                  ].join(" ")}
                >
                  {item.lastJustification}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <section className={`${SECTION} space-y-3`}>
          <p className="text-sm font-semibold tracking-tight text-slate-800">Histórico</p>
          <div className="rounded-lg border border-slate-100 bg-white/80 px-3 py-3">
            <RespondentEvidenceTimeline
              submittedAt={item.submittedAt}
              history={item.history}
            />
          </div>
        </section>
      </div>
    </Drawer>
  );
}
