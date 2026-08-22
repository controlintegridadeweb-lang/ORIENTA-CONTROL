"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import {
  LIBRARY_CONFIG,
  LIBRARY_STATUS_LABEL,
} from "@/features/library/config";
import { LibraryFilters, type LibraryFiltersState } from "./library-filters";
import {
  createLibraryItem,
  deleteLibraryItem,
  transitionLibraryItem,
  updateLibraryItem,
  type LibraryTransition,
} from "@/features/library/client";
import type {
  LibraryAxis,
  LibraryCatalogEntity,
  LibraryCatalogItem,
  LibraryCatalogSnapshot,
  LibraryRecommendationBase,
  LibrarySection,
} from "@/features/library/types";
import { Pagination } from "@/shared/ui/components/pagination";
import { LoadingButton } from "@/shared/ui/components/loading";
import { SectionHeader } from "@/shared/ui/components/section-header";
import { usePagination } from "@/shared/hooks/use-pagination";
import { layout, typography } from "@/shared/layout/design-system";
import { ADMIN_PAGE_HERO_BLEED } from "@/shared/layout/admin-page-layout";
import { formSurface } from "@/shared/layout/form-surface";
import { describeError, notify } from "@/infrastructure/notifications/notify";
import { AdminBibliotecaHero } from "./admin-library-hero";
import { EntityTable } from "./entity-table";
import { EntityModal } from "./entity-modal";

/** Entidade exibida na Biblioteca Geral (somente seções). */
const LIBRARY_PAGE_ENTITY = "sections" as const satisfies LibraryCatalogEntity;

type DeleteTarget = { entity: LibraryCatalogEntity; item: LibraryCatalogItem } | null;

type Props = {
  initial: LibraryCatalogSnapshot;
  layout?: "default" | "admin";
  error?: string | null;
  initialView?: {
    search: string;
    status: LibraryFiltersState["status"];
    tag: string;
    page: number;
  };
};

function libraryAdminPath(filters: LibraryFiltersState, page: number): string {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set("q", filters.search.trim());
  if (filters.status !== "all") params.set("status", filters.status);
  if (filters.tag) params.set("tag", filters.tag);
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `/admin/biblioteca?${query}` : "/admin/biblioteca";
}

export function BibliotecaShell({ initial, layout: pageLayout = "default", error, initialView }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [snapshot, setSnapshot] = useState<LibraryCatalogSnapshot>(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<LibraryCatalogItem | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [filters, setFilters] = useState<LibraryFiltersState>({
    search: initialView?.search ?? "",
    status: initialView?.status ?? "all",
    tag: initialView?.tag ?? "",
  });
  const [isPending, startTransition] = useTransition();

  const config = LIBRARY_CONFIG[LIBRARY_PAGE_ENTITY];
  const hasActiveFilters = filters.search || filters.status !== "all" || filters.tag;
  const isAdminLayout = pageLayout === "admin";

  const allItems = snapshot.sections;

  const availableTags = useMemo(() => {
    const set = new Set<string>();
    for (const item of allItems) {
      for (const tag of item.tags ?? []) set.add(tag);
    }
    return Array.from(set).sort();
  }, [allItems]);

  const filteredItems = useMemo<LibraryCatalogItem[]>(() => {
    const search = filters.search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (filters.status !== "all" && item.status !== filters.status) return false;
      if (filters.tag && !(item.tags ?? []).includes(filters.tag)) return false;
      if (!search) return true;
      const haystack = Object.values(item as Record<string, unknown>)
        .filter((v) => typeof v === "string")
        .join(" ")
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [allItems, filters]);

  const urlPage = useMemo(() => {
    const raw = Number(searchParams.get("page") ?? "1");
    return Number.isInteger(raw) && raw > 0 ? raw : 1;
  }, [searchParams]);
  const pagination = usePagination({
    totalItems: filteredItems.length,
    resetKey: `${filters.status}|${filters.tag}|${filters.search}`,
    initialPage: initialView?.page ?? 1,
    page: isAdminLayout ? urlPage : undefined,
  });
  const currentItems = pagination.pageItems(filteredItems);

  useEffect(() => {
    if (pageLayout !== "admin") return;
    const rawStatus = searchParams.get("status");
    const nextFilters: LibraryFiltersState = {
      search: searchParams.get("q") ?? "",
      status: rawStatus && ["draft", "in_review", "published", "deprecated", "archived"].includes(rawStatus)
        ? (rawStatus as LibraryFiltersState["status"])
        : "all",
      tag: searchParams.get("tag") ?? "",
    };
    if (
      nextFilters.search !== filters.search ||
      nextFilters.status !== filters.status ||
      nextFilters.tag !== filters.tag
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restaura filtros a partir do histórico da URL.
      setFilters(nextFilters);
    }
  }, [filters, pageLayout, searchParams]);

  function handleFiltersChange(next: LibraryFiltersState) {
    setFilters(next);
    if (isAdminLayout) router.replace(libraryAdminPath(next, 1), { scroll: false });
  }

  function openCreate() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(item: LibraryCatalogItem) {
    setEditing(item);
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
    setEditing(null);
  }

  function replaceInSnapshot(entity: LibraryCatalogEntity, item: LibraryCatalogItem) {
    setSnapshot((prev) => {
      switch (entity) {
        case "axes":
          return {
            ...prev,
            axes: upsertById(prev.axes, item as LibraryAxis),
          };
        case "sections":
          return {
            ...prev,
            sections: upsertById(prev.sections, item as LibrarySection),
          };
        case "recommendations":
          return {
            ...prev,
            recommendations: upsertById(
              prev.recommendations,
              item as LibraryRecommendationBase,
            ),
          };
      }
    });
  }

  function removeFromSnapshot(entity: LibraryCatalogEntity, id: string) {
    setSnapshot((prev) => {
      switch (entity) {
        case "axes":
          return { ...prev, axes: prev.axes.filter((a) => a.id !== id) };
        case "sections":
          return { ...prev, sections: prev.sections.filter((a) => a.id !== id) };
        case "recommendations":
          return {
            ...prev,
            recommendations: prev.recommendations.filter((a) => a.id !== id),
          };
      }
    });
  }

  async function handleSubmit(payload: Record<string, unknown>) {
    setSubmitting(true);
    try {
      const saved = editing
        ? await updateLibraryItem(LIBRARY_PAGE_ENTITY, editing.id, payload)
        : await createLibraryItem(LIBRARY_PAGE_ENTITY, payload);
      replaceInSnapshot(LIBRARY_PAGE_ENTITY, saved);
      notify.success(
        editing
          ? `${config.singular} atualizado com sucesso.`
          : `${config.singular} cadastrado com sucesso.`,
      );
      setModalOpen(false);
      setEditing(null);
    } catch (error) {
      notify.error(describeError(error, "Falha ao salvar."));
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

  function askDelete(item: LibraryCatalogItem) {
    setDeleteTarget({ entity: LIBRARY_PAGE_ENTITY, item });
  }

  async function handleTransition(
    item: LibraryCatalogItem,
    action: LibraryTransition,
    payload: { justification?: string | null },
  ) {
    const updated = await transitionLibraryItem(LIBRARY_PAGE_ENTITY, item.id, action, payload);
    replaceInSnapshot(LIBRARY_PAGE_ENTITY, updated);
    notify.success(`${config.singular} atualizado para "${LIBRARY_STATUS_LABEL[updated.status]}".`);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startTransition(async () => {
      try {
        await deleteLibraryItem(target.entity, target.item.id);
        removeFromSnapshot(target.entity, target.item.id);
        notify.success(
          `${LIBRARY_CONFIG[target.entity].singular} removido com sucesso.`,
        );
      } catch (error) {
        notify.error(describeError(error, "Falha ao remover."));
      } finally {
        setDeleteTarget(null);
      }
    });
  }

  const displayedPagination = isAdminLayout
    ? {
        ...pagination,
        setPage: (page: number) => router.push(libraryAdminPath(filters, page), { scroll: false }),
        goToPrevious: () => router.push(libraryAdminPath(filters, Math.max(1, pagination.page - 1)), { scroll: false }),
        goToNext: () => router.push(libraryAdminPath(filters, Math.min(pagination.totalPages, pagination.page + 1)), { scroll: false }),
      }
    : pagination;

  const catalogPanel = (
    <div className={layout.sectionStack}>
      <SectionHeader
        title={config.title}
        description={
          hasActiveFilters
            ? `${filteredItems.length} de ${allItems.length} itens`
            : `${allItems.length} ${allItems.length === 1 ? "item" : "itens"}`
        }
        actions={
          <div className="flex items-center gap-2">
            {hasActiveFilters ? (
              <span className={`${formSurface.badge.base} ${formSurface.badge.warning}`}>
                Filtros ativos
              </span>
            ) : null}
            {!isAdminLayout ? (
              <button
                type="button"
                onClick={openCreate}
                className={`${formSurface.primaryButtonSm} gap-2`}
              >
                <Plus className="h-4 w-4" aria-hidden />
                {config.addLabel}
              </button>
            ) : null}
          </div>
        }
      />

      <div
        className={
          isAdminLayout
            ? formSurface.dashboardPanel
            : "rounded-lg border border-slate-200 bg-white shadow-sm"
        }
      >
        <LibraryFilters
          state={filters}
          availableTags={availableTags}
          onChange={handleFiltersChange}
        />

        <div className={isAdminLayout ? `${formSurface.dashboardPanelPadding} pt-5` : "p-5"}>
          <EntityTable
            config={config}
            items={currentItems}
            onEdit={openEdit}
            onDelete={askDelete}
            onTransition={handleTransition}
            disabled={isPending}
          />

          <Pagination pagination={displayedPagination} />
        </div>
      </div>
    </div>
  );

  const modals = (
    <>
      <EntityModal
        config={config}
        open={modalOpen}
        editing={editing}
        axes={snapshot.axes}
        submitting={submitting}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />

      {deleteTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          role="alertdialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-popover">
            <h3 className={typography.cardTitle}>
              Remover {LIBRARY_CONFIG[deleteTarget.entity].singular}?
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Essa ação não pode ser desfeita. Itens vinculados podem impedir a remoção.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={isPending}
                className={`${formSurface.secondaryButton} disabled:opacity-50`}
              >
                Cancelar
              </button>
              <LoadingButton
                type="button"
                pending={isPending}
                pendingLabel="Removendo…"
                onClick={() => void confirmDelete()}
                className={`${formSurface.dangerButton} disabled:opacity-50`}
              >
                Remover
              </LoadingButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (isAdminLayout) {
    return (
      <div className={layout.pageStack}>
        <div className={ADMIN_PAGE_HERO_BLEED}>
          <AdminBibliotecaHero onNewSection={openCreate} />
        </div>

        <div className={`${layout.panelStack} pt-1`}>
          {error ? <div role="alert" aria-live="assertive" className={formSurface.messageError}>{error}</div> : null}
          <section className={layout.sectionStack} aria-label="Seções da biblioteca">
            {catalogPanel}
          </section>
        </div>

        {modals}
      </div>
    );
  }

  return (
    <div className={layout.panelStack}>
      {catalogPanel}
      {modals}
    </div>
  );
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((current) => current.id === item.id);
  if (index === -1) return [...list, item];
  const next = [...list];
  next[index] = item;
  return next;
}
