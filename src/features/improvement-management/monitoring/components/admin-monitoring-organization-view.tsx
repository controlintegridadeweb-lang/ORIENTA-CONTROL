"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Pagination } from "@/shared/ui/components/pagination";
import { usePagination } from "@/shared/hooks/use-pagination";

type OrganizationGroup = {
  organizationId: string;
  organizationName: string;
};

type Props<TItem, TGroup extends OrganizationGroup> = {
  items: TItem[];
  groups: TGroup[];
  getOrganizationId: (item: TItem) => string;
  renderSummary: (group: TGroup, rows: TItem[]) => ReactNode;
  renderRows: (rows: TItem[]) => ReactNode;
  ariaLabel: string;
  initiallyExpanded?: number;
  paginationResetKey?: string | number;
  serverPaginated?: boolean;
};

export function AdminMonitoringOrganizationView<TItem, TGroup extends OrganizationGroup>({
  items,
  groups,
  getOrganizationId,
  renderSummary,
  renderRows,
  ariaLabel,
  initiallyExpanded = 1,
  paginationResetKey,
  serverPaginated = false,
}: Props<TItem, TGroup>) {
  const pagination = usePagination({
    totalItems: groups.length,
    resetKey: paginationResetKey,
  });
  const pagedGroups = serverPaginated ? groups : pagination.pageItems(groups);
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(groups.slice(0, initiallyExpanded).map((group) => group.organizationId)),
  );

  const rowsByOrganization = useMemo(() => {
    const map = new Map<string, TItem[]>();
    for (const item of items) {
      const organizationId = getOrganizationId(item);
      const rows = map.get(organizationId) ?? [];
      rows.push(item);
      map.set(organizationId, rows);
    }
    return map;
  }, [getOrganizationId, items]);

  function toggle(organizationId: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(organizationId)) next.delete(organizationId);
      else next.add(organizationId);
      return next;
    });
  }

  if (groups.length === 0) return null;

  return (
    <>
      <div className="space-y-3" role="list" aria-label={ariaLabel}>
        {pagedGroups.map((group) => {
          const isOpen = expanded.has(group.organizationId);
          const rows = rowsByOrganization.get(group.organizationId) ?? [];

          return (
            <section
              key={group.organizationId}
              role="listitem"
              className="overflow-hidden rounded-xl border border-slate-200/95 bg-white shadow-card"
            >
              <button
                type="button"
                onClick={() => toggle(group.organizationId)}
                aria-expanded={isOpen}
                className={`flex w-full items-center justify-between gap-4 px-4 py-4 text-left transition hover:bg-slate-50/60 sm:px-5 sm:py-4.5 ${
                  isOpen ? "border-b border-slate-100/90" : ""
                }`}
              >
                <div className="min-w-0 space-y-2">
                  <p
                    className="text-sm font-semibold leading-snug text-slate-900 sm:text-base"
                    title={group.organizationName}
                  >
                    {group.organizationName}
                  </p>
                  {renderSummary(group, rows)}
                </div>

                <span className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-transparent px-2 py-1.5 text-xs font-medium text-slate-500">
                  <span className="hidden sm:inline">{isOpen ? "Recolher" : "Expandir"}</span>
                  <ChevronDown
                    className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden
                  />
                </span>
              </button>

              {isOpen ? <div className="p-3 sm:p-4">{renderRows(rows)}</div> : null}
            </section>
          );
        })}
      </div>
      {serverPaginated ? null : (
        <Pagination
          pagination={pagination}
          resultLabel={{ singular: "organização", plural: "organizações" }}
          aria-label="Paginação por organização"
          variant="panel"
        />
      )}
    </>
  );
}
