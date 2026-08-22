"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  parseAdminListCardFilter,
  parseAdminListLayout,
  parseAdminListPage,
  type AdminListLayout,
  type AdminListUrlFilters,
} from "@/shared/config/admin-list-url";
import { useAdminListUrlSync } from "@/shared/hooks/use-admin-list-url-sync";
import { useDebounce } from "@/shared/hooks/use-debounce";

type Options<TCardFilter extends string> = {
  allowedCardFilters: readonly TCardFilter[];
  urlFilters: AdminListUrlFilters;
  signatureParts: readonly (string | number | boolean | null | undefined)[];
  includeAxis?: boolean;
  initialLayout?: AdminListLayout;
};

/**
 * Estado transversal das listagens administrativas: busca com debounce,
 * paginação, modo de exibição, filtro por indicador e sincronização da URL.
 */
export function useAdminMonitoringListControls<TCardFilter extends string>({
  allowedCardFilters,
  urlFilters,
  signatureParts,
  includeAxis = false,
  initialLayout,
}: Options<TCardFilter>) {
  const searchParams = useSearchParams();
  const [cardFilter, setCardFilter] = useState<TCardFilter | null>(() =>
    parseAdminListCardFilter(
      new URLSearchParams(searchParams.toString()),
      allowedCardFilters,
    ),
  );
  const [viewMode, setViewMode] = useState<AdminListLayout>(() => {
    if (initialLayout) return initialLayout;
    return parseAdminListLayout(new URLSearchParams(searchParams.toString()));
  });
  const [page, setPage] = useState(() =>
    parseAdminListPage(new URLSearchParams(searchParams.toString())),
  );
  const searchDebounced = useDebounce(urlFilters.search, 250);
  const filterSignature = [
    viewMode,
    searchDebounced,
    ...signatureParts,
    cardFilter ?? "",
  ].join("|");
  const previousFilterSignature = useRef(filterSignature);

  useEffect(() => {
    if (filterSignature === previousFilterSignature.current) return;
    previousFilterSignature.current = filterSignature;
    setPage(1);
  }, [filterSignature]);

  useAdminListUrlSync({
    layout: viewMode,
    debouncedSearch: searchDebounced,
    includeAxis,
    page,
    cardFilter,
    filters: urlFilters,
  });

  return {
    cardFilter,
    setCardFilter,
    viewMode,
    setViewMode,
    page,
    setPage,
    searchDebounced,
    filterSignature,
  };
}
