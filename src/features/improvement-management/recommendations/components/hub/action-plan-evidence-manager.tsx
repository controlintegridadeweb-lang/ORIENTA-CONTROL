"use client";

import { ExternalLink, FileText, Link2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import type { ActionPlanAction, ActionPlanDocument } from "@/features/improvement-management/action-plans/domain-model";
import {
  addActionPlanDocumentFile,
  addActionPlanDocumentLink,
  removeActionPlanDocument,
} from "@/features/improvement-management/action-plans/client";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { formSurface } from "@/shared/layout/form-surface";
import { LoadingButton } from "@/shared/ui/components/loading";

const VALIDATION_LABEL: Record<ActionPlanDocument["fileValidationStatus"], string> = {
  not_applicable: "Link disponível",
  valid: "Formato validado",
  rejected: "Formato rejeitado",
  removed: "Removido",
};

export function ActionPlanEvidenceManager({
  plan,
  onChanged,
  embedded = false,
}: {
  plan: ActionPlanAction;
  onChanged: () => Promise<void>;
  /** Quando true, remove o separador superior (uso dentro do card do formulário). */
  embedded?: boolean;
}) {
  const [kind, setKind] = useState<"file" | "link">("file");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<ActionPlanDocument | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [composerOpen, setComposerOpen] = useState(!embedded);
  const currentDocuments = useMemo(
    () => plan.documents.filter((document) => document.isCurrentRevision),
    [plan.documents],
  );
  const archivedCount = plan.documents.length - currentDocuments.length;
  const addLabel =
    currentDocuments.length === 0 ? "Adicionar comprovante" : "Adicionar outro comprovante";

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      const title = String(form.get("title") ?? "");
      if (kind === "file") {
        const file = form.get("file");
        if (!(file instanceof File) || file.size === 0) {
          throw new Error("Selecione um arquivo de comprovação.");
        }
        await addActionPlanDocumentFile({
          planId: plan.id,
          expectedRevision: plan.revision,
          title,
          file,
        });
      } else {
        await addActionPlanDocumentLink({
          planId: plan.id,
          expectedRevision: plan.revision,
          title,
          externalLink: String(form.get("externalLink") ?? ""),
        });
      }
      event.currentTarget.reset();
      if (embedded) setComposerOpen(false);
      notify.success("Comprovação adicionada à ação.");
      await onChanged();
    } catch (cause) {
      setError(describeError(cause, "Falha ao adicionar a comprovação."));
    } finally {
      setPending(false);
    }
  }

  async function confirmRemoval() {
    if (!removing) return;
    if (removalReason.trim().length < 5) {
      setError("Informe o motivo da remoção com pelo menos 5 caracteres.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await removeActionPlanDocument({
        planId: plan.id,
        documentId: removing.id,
        expectedRevision: plan.revision,
        reason: removalReason,
      });
      setRemoving(null);
      setRemovalReason("");
      notify.success("Comprovação removida.");
      await onChanged();
    } catch (cause) {
      setError(describeError(cause, "Falha ao remover a comprovação."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section
      className={embedded ? "space-y-3" : "mt-4 space-y-3 border-t border-slate-200 pt-4"}
      aria-label="Documentos e comprovantes"
    >
      <div>
        <h4 className={embedded ? formSurface.label : "text-sm font-semibold text-slate-900"}>
          Documentos e comprovantes
        </h4>
        {!embedded ? (
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            Anexe arquivos (PDF, PNG, JPEG, WebP) ou links HTTPS. O aceite administrativo exige ao
            menos uma comprovação válida na revisão atual da ação.
          </p>
        ) : null}
      </div>

      {error ? <p role="alert" className={formSurface.messageError}>{error}</p> : null}

      {currentDocuments.length > 0 ? (
        <ul className="space-y-2">
          {currentDocuments.map((document) => {
            const isOpenable = document.kind === "link" || document.fileValidationStatus === "valid";
            const href = document.kind === "link"
              ? document.externalLink ?? "#"
              : `/api/action-plan-documents/${encodeURIComponent(document.id)}/file?download=1`;
            return (
              <li
                key={document.id}
                className={
                  embedded
                    ? "flex items-start justify-between gap-3 border-b border-slate-100 pb-2 last:border-b-0 last:pb-0"
                    : "flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:flex-row sm:items-center sm:justify-between"
                }
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    {document.kind === "file" ? <FileText className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
                    <span className="truncate">{document.title}</span>
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {document.originalFilename ?? VALIDATION_LABEL[document.fileValidationStatus]} · {VALIDATION_LABEL[document.fileValidationStatus]}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isOpenable ? (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className={formSurface.secondaryButtonSm}
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      Abrir
                    </a>
                  ) : null}
                  <button
                    type="button"
                    className={
                      embedded
                        ? "shrink-0 text-sm font-medium text-rose-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
                        : formSurface.dangerButton
                    }
                    onClick={() => {
                      setRemoving(document);
                      setRemovalReason("");
                    }}
                    disabled={pending}
                  >
                    {embedded ? null : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
                    Remover
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : !embedded ? (
        <p className={formSurface.messageWarning}>Nenhuma comprovação vinculada à revisão atual.</p>
      ) : null}

      {archivedCount > 0 ? (
        <p className="text-xs text-slate-500">
          {archivedCount} comprovação(ões) pertencem a revisões anteriores e permanecem apenas no histórico.
        </p>
      ) : null}

      {removing ? (
        <div className={formSurface.messageWarning}>
          <p className="font-semibold">Remover “{removing.title}”?</p>
          <label className={`${formSurface.fieldGroup} mt-2`}>
            <span className={formSurface.label}>Motivo da remoção</span>
            <textarea
              value={removalReason}
              onChange={(event) => setRemovalReason(event.target.value)}
              className={formSurface.inputTextarea}
              rows={2}
              maxLength={1000}
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            <LoadingButton
              type="button"
              pending={pending}
              pendingLabel="Removendo…"
              onClick={() => void confirmRemoval()}
              className={formSurface.dangerButton}
            >
              Confirmar remoção
            </LoadingButton>
            <button
              type="button"
              className={formSurface.secondaryButtonSm}
              disabled={pending}
              onClick={() => setRemoving(null)}
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {embedded && !composerOpen ? (
        <button
          type="button"
          className={formSurface.secondaryButtonSm}
          aria-expanded={false}
          onClick={() => {
            setError(null);
            setComposerOpen(true);
          }}
        >
          + {addLabel}
        </button>
      ) : (
        <form
          onSubmit={submit}
          className={
            embedded
              ? "space-y-3"
              : "space-y-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3"
          }
        >
          <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Tipo da comprovação">
            <button
              type="button"
              className={kind === "file" ? formSurface.primaryButtonSm : formSurface.secondaryButtonSm}
              onClick={() => setKind("file")}
            >
              Arquivo
            </button>
            <button
              type="button"
              className={kind === "link" ? formSurface.primaryButtonSm : formSurface.secondaryButtonSm}
              onClick={() => setKind("link")}
            >
              Link HTTPS
            </button>
          </div>
          <label className={formSurface.fieldGroup}>
            <span className={formSurface.label}>Título da comprovação</span>
            <input name="title" className={formSurface.input} minLength={3} maxLength={200} required placeholder="Ex.: Relatório de implantação" />
          </label>
          {kind === "file" ? (
            <label className={formSurface.fieldGroup}>
              <span className={formSurface.label}>Arquivo</span>
              <input
                name="file"
                type="file"
                className={formSurface.input}
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                required
              />
              <span className="text-xs text-slate-500">
                PDF, PNG, JPEG e WebP — até 20 MB
              </span>
            </label>
          ) : (
            <label className={formSurface.fieldGroup}>
              <span className={formSurface.label}>Endereço HTTPS</span>
              <input name="externalLink" type="url" pattern="https://.*" className={formSurface.input} required placeholder="https://…" />
            </label>
          )}
          <div className="flex flex-wrap gap-2">
            <LoadingButton type="submit" pending={pending} pendingLabel="Adicionando…" className={formSurface.secondaryButtonSm}>
              {embedded ? "Adicionar comprovante" : "Adicionar comprovação"}
            </LoadingButton>
            {embedded ? (
              <button
                type="button"
                className={formSurface.ghostButton}
                disabled={pending}
                onClick={() => {
                  setError(null);
                  setComposerOpen(false);
                }}
              >
                Cancelar
              </button>
            ) : null}
          </div>
        </form>
      )}
    </section>
  );
}
