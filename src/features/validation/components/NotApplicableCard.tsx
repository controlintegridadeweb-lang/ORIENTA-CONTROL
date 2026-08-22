"use client";

import type { QueueNotApplicable } from "@/features/validation/queue-model";
import { NA_VERDICT_LABEL } from "@/features/validation/queue-model";
import { formSurface } from "@/shared/layout/form-surface";
import { typography } from "@/shared/layout/design-system";
import { NotApplicableDecisionPanel } from "./not-applicable-decision-panel";
import {
  useNotApplicableCardController,
  type NotApplicableAction,
} from "./use-not-applicable-card-controller";

const STATUS_BADGE: Record<QueueNotApplicable["status"], string> = {
  pending: formSurface.badge.warning,
  approved: formSurface.badge.success,
  rejected: formSurface.badge.danger,
};

function originalAnswerLabel(answer: QueueNotApplicable["originalAnswer"]) {
  if (answer === "yes") return "Sim";
  if (answer === "no") return "Não";
  return "Não se aplica";
}

function decisionMetadata(item: QueueNotApplicable) {
  const decisionDate = item.validatedAt
    ? new Date(item.validatedAt).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : null;
  return [
    item.validatedByName ? `Responsável: ${item.validatedByName}` : null,
    decisionDate,
  ]
    .filter(Boolean)
    .join(" · ");
}

function DecisionExplanation({ item }: { item: QueueNotApplicable }) {
  if (item.source === "admin") {
    return (
      <p className="text-sm leading-relaxed text-slate-600">
        Classificação administrativa. A resposta original do respondente foi
        preservada.
      </p>
    );
  }
  if (item.status === "approved") {
    return (
      <p className="text-sm leading-relaxed text-slate-600">
        A administração aceitou que o critério não se aplica a esta organização
        neste diagnóstico.
      </p>
    );
  }
  if (item.status === "rejected") {
    return (
      <p className="text-sm leading-relaxed text-slate-600">
        “Não se aplica” rejeitado
        {item.rejectionReason
          ? ` — motivo: ${item.rejectionReason}`
          : ". A resposta passou a ser “Não”."}
      </p>
    );
  }
  return null;
}

function OriginalDocuments({ item }: { item: QueueNotApplicable }) {
  if (item.source !== "admin" || (item.documents?.length ?? 0) === 0) {
    return null;
  }
  return (
    <section className="space-y-2 border-t border-slate-100 pt-4">
      <h4 className="text-sm font-semibold text-slate-800">
        Documentos originalmente apresentados ({item.documents?.length})
      </h4>
      <ul className="space-y-2 text-sm text-slate-700">
        {item.documents?.map((document) => (
          <li key={document.id} className="break-all">
            {document.kind === "link"
              ? document.externalLink
              : (document.fileName ?? "Arquivo")}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Cartão para revisão administrativa da resposta “Não se aplica”. */
export function NotApplicableCard({
  item,
  onVerdict,
  onRevertAdminNotApplicable,
  disabled = false,
  showSectionContext = true,
}: {
  item: QueueNotApplicable;
  onVerdict: (
    responseId: string,
    action: NotApplicableAction,
    rejectionReason: string,
  ) => Promise<void>;
  onRevertAdminNotApplicable?: (
    responseId: string,
    justification: string,
  ) => Promise<void>;
  disabled?: boolean;
  showSectionContext?: boolean;
}) {
  const controller = useNotApplicableCardController({
    item,
    onVerdict,
    onRevertAdminNotApplicable,
    disabled,
  });
  const metadata = decisionMetadata(item);
  const hasOrder =
    Number.isFinite(item.orderIndex) &&
    item.orderIndex < Number.MAX_SAFE_INTEGER;

  return (
    <article className={`${formSurface.nestedCard} space-y-5`}>
      <header className="space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {hasOrder ? (
                <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md bg-slate-100 px-1.5 text-xs font-semibold tabular-nums text-slate-700">
                  {item.orderIndex + 1}
                </span>
              ) : null}
              {showSectionContext ? (
                <p className={typography.meta}>
                  {item.axisName} · {item.sectionName}
                </p>
              ) : null}
            </div>
            <h3
              className={`${showSectionContext || hasOrder ? "mt-1" : ""} ${formSurface.cardTitle}`}
            >
              {item.questionPrompt}
            </h3>
          </div>
          <span
            className={`${formSurface.badge.base} ${
              controller.isAdminDecision
                ? formSurface.badge.info
                : STATUS_BADGE[item.status]
            } shrink-0`}
          >
            {controller.isAdminDecision
              ? "Não se aplica"
              : NA_VERDICT_LABEL[item.status]}
          </span>
        </div>
        {controller.decided && metadata ? (
          <p className="text-xs text-slate-500">{metadata}</p>
        ) : null}
        <DecisionExplanation item={item} />
      </header>

      <dl className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
        <div className={formSurface.fieldGroup}>
          <dt className={formSurface.label}>Resposta original do respondente</dt>
          <dd className="text-sm text-slate-700">
            {originalAnswerLabel(item.originalAnswer)}
          </dd>
        </div>
        <div className={`${formSurface.fieldGroup} sm:col-span-2`}>
          <dt className={formSurface.label}>Justificativa</dt>
          <dd className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {item.justification || "—"}
          </dd>
        </div>
      </dl>

      <OriginalDocuments item={item} />

      <div className="border-t border-slate-100 pt-4">
        <NotApplicableDecisionPanel
          item={item}
          controller={controller}
          disabled={disabled}
          canRevertAdminDecision={Boolean(onRevertAdminNotApplicable)}
        />
      </div>
    </article>
  );
}
