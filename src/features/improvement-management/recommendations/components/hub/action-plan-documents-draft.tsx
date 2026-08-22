"use client";

import { useId, useState } from "react";
import { FileText, Link2, Plus, Trash2 } from "lucide-react";
import { describeAllowedEvidenceFile } from "@/features/evidences";
import { formSurface } from "@/shared/layout/form-surface";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";

export type ActionPlanDraftDocument =
  | { id: string; kind: "file"; title: string; file: File }
  | { id: string; kind: "link"; title: string; externalLink: string };

type Props = {
  items: ActionPlanDraftDocument[];
  onChange: (items: ActionPlanDraftDocument[]) => void;
};

type ComposerMode = "idle" | "adding";
type AttachmentKind = "file" | "link";

type ComposerDraft = {
  kind: AttachmentKind;
  title: string;
  externalLink: string;
  file: File | null;
  fileInputKey: number;
  error: string | null;
};

const INITIAL_DRAFT: ComposerDraft = {
  kind: "file",
  title: "",
  externalLink: "",
  file: null,
  fileInputKey: 0,
  error: null,
};

function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `draft-${globalThis.crypto.randomUUID()}`;
  }
  return `draft-${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatFileSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1) {
    return `${megabytes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
  }
  const kilobytes = bytes / 1024;
  if (kilobytes >= 1) {
    return `${kilobytes.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KB`;
  }
  return `${bytes} B`;
}

function itemMeta(item: ActionPlanDraftDocument): string {
  if (item.kind === "file") {
    return `Arquivo · ${formatFileSize(item.file.size)}`;
  }
  try {
    return `Link HTTPS · ${new URL(item.externalLink).hostname}`;
  } catch {
    return "Link HTTPS";
  }
}

function itemPrimaryLabel(item: ActionPlanDraftDocument): string {
  if (item.kind === "file") {
    return item.file.name.trim() || item.title;
  }
  return item.title;
}

/** Seleção local de anexos no cadastro (enviados após a ação ser salva). */
export function ActionPlanDocumentsDraft({ items, onChange }: Props) {
  const confirm = useConfirm();
  const sectionId = useId();
  const titleFieldId = useId();
  const fileFieldId = useId();
  const linkFieldId = useId();
  const errorId = useId();

  const [mode, setMode] = useState<ComposerMode>("idle");
  const [draft, setDraft] = useState<ComposerDraft>(INITIAL_DRAFT);

  function openComposer() {
    setDraft((current) => ({
      ...INITIAL_DRAFT,
      fileInputKey: current.fileInputKey + 1,
    }));
    setMode("adding");
  }

  function cancelComposer() {
    setDraft((current) => ({
      ...INITIAL_DRAFT,
      fileInputKey: current.fileInputKey + 1,
    }));
    setMode("idle");
  }

  function confirmComposer() {
    const trimmedTitle = draft.title.trim();
    if (trimmedTitle.length < 3 || trimmedTitle.length > 200) {
      setDraft((current) => ({
        ...current,
        error: "Informe um título entre 3 e 200 caracteres.",
      }));
      return;
    }

    if (draft.kind === "file") {
      if (!draft.file || draft.file.size === 0) {
        setDraft((current) => ({
          ...current,
          error: "Selecione um arquivo de comprovação.",
        }));
        return;
      }
      try {
        describeAllowedEvidenceFile({
          filename: draft.file.name,
          mimeType: draft.file.type || null,
          sizeBytes: draft.file.size,
        });
      } catch (cause) {
        setDraft((current) => ({
          ...current,
          error: cause instanceof Error ? cause.message : "Arquivo inválido.",
        }));
        return;
      }
      onChange([
        ...items,
        { id: newId(), kind: "file", title: trimmedTitle, file: draft.file },
      ]);
    } else {
      const rawLink = draft.externalLink.trim();
      let url: URL;
      try {
        url = new URL(rawLink);
      } catch {
        setDraft((current) => ({
          ...current,
          error: "Informe um endereço HTTPS válido.",
        }));
        return;
      }
      if (url.protocol !== "https:") {
        setDraft((current) => ({
          ...current,
          error: "A comprovação externa deve usar HTTPS.",
        }));
        return;
      }
      onChange([
        ...items,
        {
          id: newId(),
          kind: "link",
          title: trimmedTitle,
          externalLink: url.toString(),
        },
      ]);
    }

    setDraft((current) => ({
      ...INITIAL_DRAFT,
      fileInputKey: current.fileInputKey + 1,
    }));
    setMode("idle");
  }

  async function removeItem(item: ActionPlanDraftDocument) {
    const confirmed = await confirm({
      title: "Remover este comprovante?",
      description: `“${itemPrimaryLabel(item)}” será retirado da lista. Você poderá adicioná-lo novamente se precisar.`,
      confirmLabel: "Remover",
      cancelLabel: "Manter",
      tone: "danger",
    });
    if (!confirmed) return;
    onChange(items.filter((entry) => entry.id !== item.id));
  }

  const addLabel =
    items.length === 0 ? "Adicionar comprovante" : "Adicionar outro comprovante";

  return (
    <section className={formSurface.fieldGroup} aria-labelledby={sectionId}>
      <div>
        <h4 id={sectionId} className={formSurface.label}>
          Documentos e comprovantes
        </h4>
        {items.length === 0 && mode === "idle" ? (
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
            Opcional. Você pode adicionar arquivos ou links como comprovação da ação.
          </p>
        ) : null}
      </div>

      <div className={`${formSurface.subtlePanel} space-y-3`}>
      {items.length > 0 ? (
        <ul className="space-y-2">
          {items.map((item) => {
            const KindIcon = item.kind === "file" ? FileText : Link2;
            return (
              <li
                key={item.id}
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
                    {itemPrimaryLabel(item)}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">{itemMeta(item)}</p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-rose-700 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
                  aria-label={`Remover comprovante ${item.title}`}
                  onClick={() => void removeItem(item)}
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Remover
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {mode === "idle" ? (
        <button
          type="button"
          className={formSurface.secondaryButtonSm}
          aria-expanded={false}
          onClick={openComposer}
        >
          <Plus className="h-4 w-4" aria-hidden />
          {addLabel}
        </button>
      ) : (
        <div className="space-y-3 rounded-lg border border-dashed border-slate-300 bg-white p-3">
          {draft.error ? (
            <p id={errorId} role="alert" className={formSurface.messageError}>
              {draft.error}
            </p>
          ) : null}

          <div>
            <p className={formSurface.label} id={`${sectionId}-kind`}>
              Tipo de comprovante
            </p>
            <div
              className="mt-1.5 flex flex-wrap items-center gap-3"
              role="group"
              aria-labelledby={`${sectionId}-kind`}
            >
              <button
                type="button"
                className={
                  draft.kind === "file"
                    ? formSurface.primaryButtonSm
                    : formSurface.secondaryButtonSm
                }
                aria-pressed={draft.kind === "file"}
                onClick={() =>
                  setDraft((current) => ({ ...current, kind: "file", error: null }))
                }
              >
                Arquivo
              </button>
              <button
                type="button"
                className={
                  draft.kind === "link"
                    ? formSurface.primaryButtonSm
                    : formSurface.secondaryButtonSm
                }
                aria-pressed={draft.kind === "link"}
                onClick={() =>
                  setDraft((current) => ({ ...current, kind: "link", error: null }))
                }
              >
                Link HTTPS
              </button>
            </div>
          </div>

          <label className={formSurface.fieldGroup} htmlFor={titleFieldId}>
            <span className={formSurface.label}>Título da comprovação</span>
            <input
              id={titleFieldId}
              value={draft.title}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  title: event.target.value,
                  error: null,
                }))
              }
              className={formSurface.input}
              maxLength={200}
              placeholder="Ex.: Relatório de implantação"
              aria-invalid={Boolean(draft.error)}
              aria-describedby={draft.error ? errorId : undefined}
            />
          </label>

          {draft.kind === "file" ? (
            <label className={formSurface.fieldGroup} htmlFor={fileFieldId}>
              <span className={formSurface.label}>Arquivo</span>
              <input
                key={draft.fileInputKey}
                id={fileFieldId}
                type="file"
                className={formSurface.input}
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    file: event.target.files?.[0] ?? null,
                    error: null,
                  }))
                }
                aria-invalid={Boolean(draft.error)}
                aria-describedby={`${fileFieldId}-hint${draft.error ? ` ${errorId}` : ""}`}
              />
              <span id={`${fileFieldId}-hint`} className="text-xs text-slate-500">
                PDF, PNG, JPEG e WebP - até 20 MB
              </span>
            </label>
          ) : (
            <label className={formSurface.fieldGroup} htmlFor={linkFieldId}>
              <span className={formSurface.label}>URL</span>
              <input
                id={linkFieldId}
                type="url"
                value={draft.externalLink}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    externalLink: event.target.value,
                    error: null,
                  }))
                }
                className={formSurface.input}
                placeholder="https://…"
                inputMode="url"
                autoComplete="url"
                aria-invalid={Boolean(draft.error)}
                aria-describedby={draft.error ? errorId : undefined}
              />
            </label>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={formSurface.ghostButton}
              onClick={cancelComposer}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={formSurface.primaryButtonSm}
              onClick={confirmComposer}
            >
              Adicionar comprovante
            </button>
          </div>
        </div>
      )}
      </div>
    </section>
  );
}
