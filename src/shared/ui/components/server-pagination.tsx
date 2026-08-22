"use client";

import { PaginationControls } from "@/shared/ui/components/pagination-controls";
import { buildPageNumbers } from "@/shared/hooks/use-pagination";

type ResultLabel = { singular: string; plural: string };

type Props = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  pageItemCount: number;
  onPageChange: (page: number) => void;
  resultLabel?: ResultLabel;
  "aria-label"?: string;
};

export function ServerPagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  pageItemCount,
  onPageChange,
  resultLabel = { singular: "resultado", plural: "resultados" },
  "aria-label": ariaLabel = "Paginação",
}: Props) {
  if (totalPages <= 1) return null;

  const safePage = Math.min(Math.max(1, page), Math.max(1, totalPages));
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = totalItems === 0 ? 0 : Math.min(start + pageItemCount - 1, totalItems);
  const noun = totalItems === 1 ? resultLabel.singular : resultLabel.plural;
  const summary = (
    <span aria-live="polite" className="tabular-nums">
      Página <span className="font-semibold text-slate-800">{safePage}</span> de{" "}
      <span className="font-semibold text-slate-800">{totalPages}</span> · exibindo{" "}
      <span className="font-semibold text-slate-800">{start}–{end}</span> de{" "}
      <span className="font-semibold text-slate-800">{totalItems}</span> {noun}
    </span>
  );

  return (
    <PaginationControls
      page={safePage}
      totalPages={totalPages}
      pageNumbers={buildPageNumbers(safePage, totalPages)}
      onPageChange={onPageChange}
      summary={summary}
      variant="panel"
      aria-label={ariaLabel}
    />
  );
}
