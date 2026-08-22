"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  queueSituationFilterToParam,
  type QueueSituationFilter,
} from "../form-view-model";
import {
  clampValidationPage,
  DEFAULT_VALIDATION_PAGE_SIZE,
  parseValidationPage,
  parseValidationPageSize,
  type ValidationPageSize,
} from "../pagination";
import {
  ALL_AXES_PARAM,
  ALL_SECTIONS_PARAM,
  buildSectionNavigation,
  groupSectionsByAxis,
  pickPreferredSectionIdForAxis,
  resolveSelectedAxisId,
  resolveSelectedSectionId,
  sectionsForAxis,
  type QueueSectionSummary,
} from "../queue-model";

export type ValidationQueuePagination = {
  page: number;
  pageSize: ValidationPageSize;
  totalItems: number;
  sectionId: string | null;
  axisId: string | null;
  queueSituation: QueueSituationFilter;
  search: string;
};

export type ReplaceValidationQueueParams = {
  queueSituation?: QueueSituationFilter;
  sectionId?: string | null;
  axisId?: string | null;
  search?: string;
  page?: number;
  pageSize?: ValidationPageSize;
  resetPage?: boolean;
};

export function useValidationQueueNavigation({
  cycleId,
  returnTo,
  targetEvidenceId,
  formSections,
  pagination,
}: {
  cycleId: string;
  returnTo?: string | null;
  targetEvidenceId?: string | null;
  formSections: QueueSectionSummary[];
  pagination: ValidationQueuePagination;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [navigationPending, startNavigationTransition] = useTransition();
  const [searchDraft, setSearchDraft] = useState(pagination.search);
  const [seenSearch, setSeenSearch] = useState(pagination.search);
  if (seenSearch !== pagination.search) {
    setSeenSearch(pagination.search);
    setSearchDraft(pagination.search);
  }
  const hasTargetEvidence = Boolean(targetEvidenceId);
  const queueSituation = pagination.queueSituation;
  const page = hasTargetEvidence
    ? pagination.page
    : parseValidationPage(
        searchParams.get("pagina") ?? String(pagination.page),
      );
  const pageSize = hasTargetEvidence
    ? pagination.pageSize
    : parseValidationPageSize(
        searchParams.get("porPagina") ?? String(pagination.pageSize),
      );
  const sectionNav = useMemo(
    () =>
      buildSectionNavigation(
        formSections.flatMap((section) =>
          Array.from(
            {
              length: Math.max(
                section.pendingCount + section.completedCount,
                1,
              ),
            },
            (_, index) => ({
              sectionId: section.id,
              sectionName: section.title,
              sectionOrder: section.sectionOrder,
              axisId: section.axisId,
              axisName: section.axisName,
              status: index < section.pendingCount ? "pending" : "approved",
            }),
          ),
        ),
      ),
    [formSections],
  );

  const selectedSectionId = resolveSelectedSectionId(
    hasTargetEvidence
      ? pagination.sectionId
      : searchParams.get("secao") ?? pagination.sectionId,
    formSections,
  );

  const axisFromUrl = hasTargetEvidence
    ? pagination.axisId
    : searchParams.get("eixo") ?? pagination.axisId;
  const axisFromSection =
    selectedSectionId !== ALL_SECTIONS_PARAM
      ? formSections.find((section) => section.id === selectedSectionId)
          ?.axisId ?? null
      : null;
  const selectedAxisId = resolveSelectedAxisId(
    axisFromUrl ?? axisFromSection,
    sectionNav.groups.length > 0
      ? sectionNav.groups
      : groupSectionsByAxis(formSections),
  );

  const replaceParams = useCallback(
    (next: ReplaceValidationQueueParams) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("evidenceId");
      params.set(
        "situacao",
        queueSituationFilterToParam(next.queueSituation ?? queueSituation),
      );

      const axisValue =
        next.axisId === undefined
          ? selectedAxisId === ALL_AXES_PARAM
            ? null
            : selectedAxisId
          : next.axisId;
      if (axisValue) params.set("eixo", axisValue);
      else params.delete("eixo");

      let sectionValue =
        next.sectionId === undefined
          ? selectedSectionId
          : (next.sectionId ?? ALL_SECTIONS_PARAM);

      if (next.axisId !== undefined) {
        const axisSections = sectionsForAxis(formSections, axisValue);
        if (
          sectionValue &&
          sectionValue !== ALL_SECTIONS_PARAM &&
          !axisSections.some((section) => section.id === sectionValue)
        ) {
          sectionValue =
            pickPreferredSectionIdForAxis(axisSections) ?? ALL_SECTIONS_PARAM;
        }
      }

      if (!sectionValue || sectionValue === ALL_SECTIONS_PARAM) {
        params.delete("secao");
      } else {
        params.set("secao", sectionValue);
      }
      const search = next.search ?? pagination.search;
      if (search.trim()) params.set("busca", search.trim());
      else params.delete("busca");
      const nextPage = next.resetPage ? 1 : next.page ?? page;
      const nextPageSize = next.pageSize ?? pageSize;
      if (nextPage > 1) params.set("pagina", String(nextPage));
      else params.delete("pagina");
      if (nextPageSize !== DEFAULT_VALIDATION_PAGE_SIZE) {
        params.set("porPagina", String(nextPageSize));
      } else {
        params.delete("porPagina");
      }
      for (const key of [
        "tipo",
        "visao",
        "resposta",
        "decisao",
        "comprovacao",
      ]) {
        params.delete(key);
      }
      const query = params.toString();
      startNavigationTransition(() => {
        router.replace(query ? `${pathname}?${query}` : pathname);
      });
    },
    [
      formSections,
      page,
      pageSize,
      pagination.search,
      pathname,
      queueSituation,
      router,
      searchParams,
      startNavigationTransition,
      selectedAxisId,
      selectedSectionId,
    ],
  );

  useEffect(() => {
    const handle = window.setTimeout(() => {
      if (searchDraft.trim() === pagination.search.trim()) return;
      replaceParams({ search: searchDraft, resetPage: true });
    }, 400);
    return () => window.clearTimeout(handle);
  }, [pagination.search, replaceParams, searchDraft]);

  const fullFormHref = useMemo(() => {
    const queueParams = new URLSearchParams();
    queueParams.set("situacao", queueSituationFilterToParam(queueSituation));
    if (selectedAxisId && selectedAxisId !== ALL_AXES_PARAM) {
      queueParams.set("eixo", selectedAxisId);
    }
    if (selectedSectionId && selectedSectionId !== ALL_SECTIONS_PARAM) {
      queueParams.set("secao", selectedSectionId);
    }
    if (pagination.search.trim()) {
      queueParams.set("busca", pagination.search.trim());
    }
    if (page > 1) queueParams.set("pagina", String(page));
    if (pageSize !== DEFAULT_VALIDATION_PAGE_SIZE) {
      queueParams.set("porPagina", String(pageSize));
    }
    if (returnTo) queueParams.set("returnTo", returnTo);
    const params = new URLSearchParams();
    if (queueParams.size > 0) params.set("fila", queueParams.toString());
    if (returnTo) params.set("returnTo", returnTo);
    return `/admin/ciclos/${cycleId}/validacao/formulario?${params.toString()}`;
  }, [
    cycleId,
    page,
    pageSize,
    pagination.search,
    queueSituation,
    returnTo,
    selectedAxisId,
    selectedSectionId,
  ]);

  const cycleHref = useMemo(() => {
    const params = new URLSearchParams();
    if (returnTo) params.set("returnTo", returnTo);
    const query = params.toString();
    return `/admin/ciclos/${cycleId}${query ? `?${query}` : ""}`;
  }, [cycleId, returnTo]);

  function clearFilters() {
    setSearchDraft("");
    replaceParams({
      queueSituation: "pending",
      sectionId: null,
      axisId: null,
      search: "",
      page: 1,
      resetPage: true,
    });
  }

  return {
    queueSituation,
    searchDraft,
    setSearchDraft,
    page,
    pageSize,
    totalItems: pagination.totalItems,
    safePage: clampValidationPage(page, pagination.totalItems, pageSize),
    selectedAxisId,
    selectedSectionId,
    selectedSection:
      selectedSectionId === ALL_SECTIONS_PARAM
        ? null
        : formSections.find((section) => section.id === selectedSectionId) ??
          null,
    sectionNav,
    cycleHref,
    fullFormHref,
    replaceParams,
    clearFilters,
    navigationPending,
  };
}
