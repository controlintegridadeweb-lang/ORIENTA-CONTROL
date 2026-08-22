"use client";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import Link from "next/link";
import { evidenceNextStep } from "@/features/evidences/next-step";
import type { EvidenceListItem } from "@/features/evidences/types";
import { perguntaLabels } from "@/shared/labels/official-labels";
import { normalizeWorkbenchText } from "@/features/evidences/normalize-workbench-text";
import { formSurface } from "@/shared/layout/form-surface";
import { Drawer } from "@/shared/ui/components/drawer";
import { EvidenceHistory } from "./evidence-history";
import { StatusBadge } from "./status-badge";
import { withAdminReturnPath } from "@/shared/navigation/admin-navigation-context";
import { EvidenceFileActions } from "./evidence-file-actions";

type Props = {
  item: EvidenceListItem | null;
  open: boolean;
  onClose: () => void;
  returnPath: string;
};

const SECTION =
  "overflow-hidden rounded-xl border border-slate-200/80 border-l-[3px] border-l-brand-400 bg-white p-4 shadow-card sm:p-5";

/**
 * Consulta transversal de evidências. Esta tela não decide validações: toda
 * mutação ocorre somente na fila do diagnóstico, que preserva a sequência e o
 * estado do ciclo durante a análise.
 */
export function EvidenceDetailDrawer({ item, open, onClose, returnPath }: Props) {
  if (!item) return null;

  const cycleLink = withAdminReturnPath(`/admin/ciclos/${item.cycleId}`, returnPath);
  const validationQueueLink = withAdminReturnPath(
    `/admin/ciclos/${item.cycleId}/validacao?evidenceId=${encodeURIComponent(item.id)}`,
    returnPath,
  );
  const nextStep = evidenceNextStep(item.cycleState, item.currentStatus);
  const nextLink = nextStep.opensValidationQueue ? validationQueueLink : cycleLink;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={normalizeWorkbenchText(item.title)}
      description={`${item.organizationName} · ${item.formName}`}
    >
      <div className="space-y-4 sm:space-y-5">
        <section className={`${SECTION} space-y-4`}>
          <header className="space-y-3">
            <p className="text-sm font-semibold tracking-tight text-slate-800">Contexto</p>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={item.currentStatus} />
              {item.requiresEvidence ? (
                <span className={`${formSurface.badge.base} ${formSurface.badge.info}`}>
                  Exige evidência
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
          {item.lastJustification ? (
            <div className="rounded-lg border border-amber-100 bg-amber-50/60 px-3.5 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-800/80">
                Última justificativa
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-amber-950/80">
                {item.lastJustification}
              </p>
            </div>
          ) : null}
        </section>

        <section className={`${SECTION} space-y-4`}>
          <p className="text-sm font-semibold tracking-tight text-slate-800">Conteúdo</p>
          <dl className="space-y-3.5 text-sm">
            {item.evidenceType === "text" && item.textBody ? (
              <div className="rounded-lg border border-slate-100 bg-white/80 px-3.5 py-3">
                <dt className={formSurface.label}>Comprovação textual</dt>
                <dd className="mt-1.5 whitespace-pre-wrap text-slate-700">
                  {normalizeWorkbenchText(item.textBody)}
                </dd>
              </div>
            ) : null}
            <div className="rounded-lg border border-slate-100 bg-white/80 px-3.5 py-3">
              <dt className={formSurface.label}>Texto ou descrição</dt>
              <dd className="mt-1.5 text-slate-700">
                {item.description ? (
                  normalizeWorkbenchText(item.description)
                ) : (
                  <span className="text-slate-500">Sem descrição adicional.</span>
                )}
              </dd>
            </div>
            {item.externalLink ? (
              <div className="rounded-lg border border-sky-100 bg-sky-50/50 px-3.5 py-3">
                <dt className={formSurface.label}>Link externo</dt>
                <dd className="mt-2">
                  <a
                    href={item.externalLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200/80 bg-white px-3 py-2 text-sm font-medium text-sky-800 shadow-sm transition hover:border-sky-300 hover:bg-sky-50"
                  >
                    Abrir link externo
                  </a>
                </dd>
              </div>
            ) : null}
            {item.storagePath ? (
              <div className="rounded-lg border border-brand-100 bg-brand-50/40 px-3.5 py-3">
                <dt className={formSurface.label}>Arquivo enviado</dt>
                <dd className="mt-2">
                  <EvidenceFileActions evidenceId={item.id} />
                </dd>
              </div>
            ) : null}
            {item.exceptionReason ? (
              <div className="rounded-lg border border-slate-100 bg-white/80 px-3.5 py-3">
                <dt className={formSurface.label}>Motivo da exceção</dt>
                <dd className="mt-1.5 text-slate-700">
                  {normalizeWorkbenchText(item.exceptionReason)}
                </dd>
              </div>
            ) : null}
            <div className="rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-3">
              <dt className={formSurface.label}>Envio</dt>
              <dd className="mt-1.5 text-xs leading-relaxed text-slate-600">
                Enviada em{" "}
                <time dateTime={item.submittedAt} className="font-medium text-slate-700">
                  {formatPlatformDateTime(item.submittedAt, { dateStyle: "short", timeStyle: "short" })}
                </time>
                <span className="text-slate-400"> · </span>
                por <span className="font-mono text-2xs text-slate-500">{item.submittedBy}</span>
              </dd>
            </div>
          </dl>
        </section>

        <section className="space-y-3 overflow-hidden rounded-xl border border-brand-200/70 bg-brand-50 p-4 shadow-card sm:p-5">
          <p className="text-sm font-semibold tracking-tight text-slate-800">Próximo passo</p>
          <p className="text-sm leading-relaxed text-slate-600">{nextStep.description}</p>
          <div className="flex flex-wrap gap-2.5">
            <Link href={nextLink} className={formSurface.primaryButtonSm}>
              {nextStep.label}
            </Link>
            {nextStep.opensValidationQueue ? (
              <Link href={cycleLink} className={formSurface.secondaryButtonSm}>
                Ver diagnóstico de origem
              </Link>
            ) : null}
          </div>
        </section>

        <section className={`${SECTION} space-y-3`}>
          <p className="text-sm font-semibold tracking-tight text-slate-800">Histórico</p>
          <EvidenceHistory history={item.history} />
        </section>
      </div>
    </Drawer>
  );
}
