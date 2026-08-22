"use client";

import { ServerPagination } from "@/shared/ui/components/server-pagination";
import { formSurface } from "@/shared/layout/form-surface";
import type { ValidationPageSize } from "@/features/validation/pagination";

export function ValidationQueuePagination({
  page,
  pageSize,
  totalItems,
  pageItemCount,
  onPageChange,
}: {
  page: number;
  pageSize: ValidationPageSize;
  totalItems: number;
  pageItemCount: number;
  onPageChange: (page: number) => void;
}) {
  if (totalItems === 0) return null;

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  if (totalPages > 1) {
    return (
      <ServerPagination
        page={page}
        pageSize={pageSize}
        totalItems={totalItems}
        totalPages={totalPages}
        pageItemCount={pageItemCount}
        onPageChange={onPageChange}
        resultLabel={{ singular: "critério", plural: "critérios" }}
        aria-label="Paginação da fila de validação"
      />
    );
  }

  return (
    <p
      className={`px-4 py-3 text-xs text-slate-600 ${formSurface.dashboardPanel}`}
      aria-live="polite"
    >
      Exibindo{" "}
      <span className="font-semibold text-slate-800">
        1–{pageItemCount}
      </span>{" "}
      de <span className="font-semibold text-slate-800">{totalItems}</span>{" "}
      {totalItems === 1 ? "critério" : "critérios"}
    </p>
  );
}
