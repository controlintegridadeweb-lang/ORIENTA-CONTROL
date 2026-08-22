"use client";

import type { PaginationState } from "@/shared/hooks/use-pagination";
import { PaginationControls } from "@/shared/ui/components/pagination-controls";

type ResultLabel = {
  singular: string;
  plural: string;
};

type PaginationProps = {
  pagination: PaginationState;
  resultLabel?: ResultLabel;
  alwaysShow?: boolean;
  variant?: "default" | "panel" | "bare";
  className?: string;
  "aria-label"?: string;
};

const DEFAULT_RESULT_LABEL: ResultLabel = { singular: "resultado", plural: "resultados" };

export function Pagination({
  pagination,
  resultLabel = DEFAULT_RESULT_LABEL,
  alwaysShow = false,
  variant = "default",
  className,
  "aria-label": ariaLabel = "Paginação",
}: PaginationProps) {
  const { page, totalPages, totalItems, pageItemCount, pageNumbers, setPage } = pagination;
  if (!alwaysShow && totalPages <= 1) return null;

  const noun = totalItems === 1 ? resultLabel.singular : resultLabel.plural;
  const summary = (
    <span aria-live="polite" className={variant === "panel" ? "tabular-nums" : undefined}>
      Página <span className="font-semibold text-slate-800">{page}</span> de{" "}
      <span className="font-semibold text-slate-800">{totalPages}</span> · exibindo{" "}
      <span className="font-semibold text-slate-800">{pageItemCount}</span> de{" "}
      <span className="font-semibold text-slate-800">{totalItems}</span> {noun}
    </span>
  );

  return (
    <PaginationControls
      page={page}
      totalPages={totalPages}
      pageNumbers={pageNumbers}
      onPageChange={setPage}
      summary={summary}
      variant={variant}
      className={className}
      aria-label={ariaLabel}
    />
  );
}
