"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";
import {
  buildAdminListSearchParams,
  type AdminListLayout,
  type AdminListUrlFilters,
} from "@/shared/config/admin-list-url";

type Options = {
  layout: AdminListLayout;
  filters: AdminListUrlFilters;
  debouncedSearch: string;
  includeAxis?: boolean;
  page?: number;
  cardFilter?: string | null;
};

/** Mantém filtros e modo de lista sincronizados com a query string (compartilhável entre módulos). */
export function useAdminListUrlSync({
  layout,
  filters,
  debouncedSearch,
  includeAxis = false,
  page,
  cardFilter,
}: Options): void {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const skipFirst = useRef(true);

  const { organizationId, formId, cycleId, axisId, status, from, to } = filters;

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }

    const next = buildAdminListSearchParams({
      layout,
      includeAxis,
      page,
      cardFilter,
      filters: {
        organizationId,
        formId,
        cycleId,
        axisId,
        status,
        from,
        to,
        search: debouncedSearch,
      },
    });
    const current = searchParams.toString();
    const built = next.toString();
    if (built === current) return;

    const href = built ? `${pathname}?${built}` : pathname;
    router.replace(href, { scroll: false });
  }, [
    layout,
    organizationId,
    formId,
    cycleId,
    axisId,
    status,
    from,
    to,
    debouncedSearch,
    includeAxis,
    page,
    cardFilter,
    pathname,
    router,
    searchParams,
  ]);
}
