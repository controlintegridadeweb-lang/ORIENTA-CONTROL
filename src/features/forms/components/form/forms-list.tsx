"use client";

import { formatPlatformDate } from "@/shared/datetime/platform-date-time";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronDown, Inbox, Link2, Pencil, Trash2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Spinner } from "@/shared/ui/components/loading";
import { useConfirm } from "@/shared/ui/components/confirm-dialog";
import { ServerPagination } from "@/shared/ui/components/server-pagination";
import { formSurface } from "@/shared/layout/form-surface";
import type { FormSummary } from "@/features/forms/admin-service";
import { listForms, deleteForm, type FormsPageResult } from "@/features/forms/client";
import { FormPublicationStateBadge } from "@/features/forms/components/form/form-publication-state-badge";
import type { FormPublicationState } from "@/features/forms/form-publication-state";
import {
  currentAdminListPath,
  withAdminReturnPath,
} from "@/shared/navigation/admin-navigation-context";

type FormsListProps = {
  /** Base para links de configuração do formulário (ex. /admin/formularios). */
  formBasePath?: string;
  /** Exclusao definitiva: apenas admin na API. */
  showDelete?: boolean;
};

type RowActionsProps = {
  form: FormSummary;
  formBasePath: string;
  showDelete: boolean;
  busy: boolean;
  returnTo: string;
  onDelete: (form: FormSummary) => void;
};

function FormRowActions({
  form,
  formBasePath,
  showDelete,
  busy,
  returnTo,
  onDelete,
}: RowActionsProps) {
  const isDraft = form.state === "draft";
  const canDelete = isDraft && showDelete;
  const primaryHref = withAdminReturnPath(
    `${formBasePath}/${form.id}/configuracao`,
    returnTo,
  );
  const primaryLabel = isDraft ? "Continuar assistente de publicação" : "Abrir configuração";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <Link href={primaryHref} className={formSurface.primaryButtonSm}>
        {primaryLabel}
      </Link>

      <details className="relative">
        <summary
          className={`${formSurface.secondaryButtonSm} cursor-pointer list-none [&::-webkit-details-marker]:hidden`}
        >
          Mais
          <ChevronDown className="h-3.5 w-3.5 opacity-70" aria-hidden />
        </summary>
        <div
          className="absolute right-0 z-20 mt-1.5 min-w-50 rounded-lg border border-slate-200 bg-white py-1 text-left text-sm shadow-lg"
          role="menu"
        >
          {!isDraft ? (
            <Link
              href={withAdminReturnPath(`${formBasePath}/${form.id}/respostas`, returnTo)}
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-slate-700 transition hover:bg-slate-50"
            >
              <Link2 className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              Respostas
            </Link>
          ) : null}
          <Link
            href={primaryHref}
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-slate-700 transition hover:bg-slate-50"
          >
            <Pencil className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            {isDraft ? "Continuar assistente" : "Abrir configuração"}
          </Link>
          {canDelete ? (
            <button
              type="button"
              role="menuitem"
              disabled={busy}
              onClick={() => onDelete(form)}
              className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
            >
              <Trash2 className="h-4 w-4 shrink-0" aria-hidden />
              Excluir
            </button>
          ) : null}
        </div>
      </details>
    </div>
  );
}

export function FormsList({
  formBasePath = "/admin/formularios",
  showDelete = true,
}: FormsListProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [forms, setForms] = useState<FormsPageResult | null>(null);
  const rawPage = Number(searchParams.get("page"));
  const [page, setPage] = useState(() =>
    Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
  );
  const rawStateFilter = searchParams.get("state");
  const stateFilter: "" | FormPublicationState =
    rawStateFilter && ["draft", "published", "superseded", "archived"].includes(rawStateFilter)
      ? (rawStateFilter as FormPublicationState)
      : "";
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const confirm = useConfirm();
  const returnTo = currentAdminListPath(pathname, searchParams.toString());


  function handleStateFilter(next: "" | FormPublicationState) {
    setPage(1);
    const params = new URLSearchParams();
    if (next) params.set("state", next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function handlePageChange(next: number) {
    const normalized = Math.max(1, Math.trunc(next));
    setPage(normalized);
    const params = new URLSearchParams();
    if (stateFilter) params.set("state", stateFilter);
    if (normalized > 1) params.set("page", String(normalized));
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Invalida o resultado assíncrono anterior quando a fonte de dados muda.
    setForms(null);
    listForms({ state: stateFilter || undefined, page, limit: 25 })
      .then((data) => {
        if (!cancelled) setForms(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Falha ao carregar.");
      });
    return () => {
      cancelled = true;
    };
  }, [page, stateFilter]);

  async function handleDelete(form: FormSummary) {
    if (
      !(await confirm({
        title: "Excluir formulário?",
        description: `"${form.name}" será removido definitivamente, junto com todas as perguntas exclusivas dele.`,
        confirmLabel: "Excluir",
        tone: "danger",
      }))
    )
      return;
    setBusyId(form.id);
    setError(null);
    try {
      await deleteForm(form.id);
      setForms((prev) => prev ? {
        ...prev,
        items: prev.items.filter((item) => item.id !== form.id),
        total: Math.max(0, prev.total - 1),
      } : prev);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Falha ao excluir.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
        <p className="min-w-0 text-sm text-slate-600">
          {forms === null
            ? "Carregando modelos…"
            : forms.total === 0
              ? "Nenhum modelo neste filtro"
              : `${forms.total} modelo${forms.total === 1 ? "" : "s"} no escopo`}
        </p>
        <label className="w-full min-w-0 space-y-1 sm:max-w-56">
          <span className={formSurface.label}>Situação</span>
          <select
            value={stateFilter}
            onChange={(event) => handleStateFilter(event.target.value as "" | FormPublicationState)}
            className={formSurface.inputSelect}
          >
            <option value="">Todos</option>
            <option value="draft">Rascunho</option>
            <option value="published">Publicado</option>
            <option value="superseded">Substituído</option>
            <option value="archived">Arquivado</option>
          </select>
        </label>
      </div>

      {error ? <div role="alert" aria-live="assertive" className={formSurface.messageError}>{error}</div> : null}

      {forms === null ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/90 bg-slate-50/40 px-6 py-10 text-center">
          <Spinner size="xl" className="text-brand" />
          <p className="text-sm font-medium text-slate-700">Carregando formulários…</p>
        </div>
      ) : forms.total === 0 && !stateFilter ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200/90 bg-slate-50/40 px-6 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-slate-100">
            <Inbox className="h-5 w-5 text-slate-400" aria-hidden />
          </span>
          <p className="text-sm font-medium text-slate-900">Nenhum formulário cadastrado</p>
          <p className="max-w-sm text-sm leading-relaxed text-slate-600">
            Crie um novo formulário pelo botão no topo da página.
          </p>
        </div>
      ) : forms.items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-10 text-center">
          <Inbox className="h-5 w-5 text-slate-400" aria-hidden />
          <p className="text-sm font-medium text-slate-900">Nenhum formulário coincide com o estado selecionado</p>
          <button type="button" onClick={() => handleStateFilter("")} className={formSurface.secondaryButtonSm}>
            Mostrar todos
          </button>
        </div>
      ) : (
        <>
          <div className={formSurface.brandTable.wrapper}>
            <table className={`${formSurface.brandTable.table} min-w-190`}>
              <thead className={formSurface.brandTable.head}>
                <tr>
                  <th className={formSurface.brandTable.headCell}>Nome</th>
                  <th className={formSurface.brandTable.headCell}>Versão</th>
                  <th className={formSurface.brandTable.headCell}>Situação</th>
                  <th className={`${formSurface.brandTable.headCell} tabular-nums`}>Perguntas</th>
                  <th className={formSurface.brandTable.headCell}>Criado em</th>
                  <th className={`${formSurface.brandTable.headCell} text-right`}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {forms.items.map((form, index) => {
                  const busy = busyId === form.id;

                  return (
                    <tr
                      key={form.id}
                      className={index % 2 === 0 ? formSurface.brandTable.rowEven : formSurface.brandTable.rowOdd}
                    >
                      <td className={`${formSurface.brandTable.cell} align-middle`}>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">{form.name}</span>
                        </div>
                      </td>
                      <td className={`${formSurface.brandTable.cellMuted} align-middle tabular-nums`}>
                        {form.version != null ? `v${form.version}` : "—"}
                      </td>
                      <td className={`${formSurface.brandTable.cell} align-middle`}>
                        <FormPublicationStateBadge state={form.state} size="sm" />
                      </td>
                      <td className={`${formSurface.brandTable.cellMuted} align-middle tabular-nums`}>
                        {form.questionCount}
                      </td>
                      <td className={`${formSurface.brandTable.cellMuted} align-middle whitespace-nowrap`}>
                        {formatPlatformDate(form.createdAt, { dateStyle: "short" })}
                      </td>
                      <td className={`${formSurface.brandTable.cell} align-middle text-right`}>
                        <FormRowActions
                          form={form}
                          formBasePath={formBasePath}
                          showDelete={showDelete}
                          busy={busy}
                          returnTo={returnTo}
                          onDelete={handleDelete}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ServerPagination
            page={forms.page}
            pageSize={forms.limit}
            totalItems={forms.total}
            totalPages={forms.totalPages}
            pageItemCount={forms.items.length}
            onPageChange={handlePageChange}
            resultLabel={{ singular: "modelo", plural: "modelos" }}
          />
        </>
      )}
    </div>
  );
}
