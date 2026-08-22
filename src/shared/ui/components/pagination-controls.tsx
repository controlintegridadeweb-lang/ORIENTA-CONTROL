"use client";

import type { ReactNode } from "react";
import type { PageNumberItem } from "@/shared/hooks/use-pagination";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  page: number;
  totalPages: number;
  pageNumbers: readonly PageNumberItem[];
  onPageChange: (page: number) => void;
  summary: ReactNode;
  variant?: "default" | "panel" | "bare";
  className?: string;
  "aria-label"?: string;
  /** No mobile, oculta a faixa de números e mantém Anterior/Próxima. */
  compactMobile?: boolean;
};

/** Apresentação única dos controles de paginação local e por servidor. */
export function PaginationControls({
  page,
  totalPages,
  pageNumbers,
  onPageChange,
  summary,
  variant = "default",
  className,
  "aria-label": ariaLabel = "Paginação",
  compactMobile = false,
}: Props) {
  const surfaceClass =
    variant === "panel"
      ? `flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-xs text-slate-600 ${formSurface.dashboardPanel}`
      : variant === "bare"
        ? "flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600"
        : "mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200/80 bg-slate-50/50 px-4 py-3 text-xs text-slate-600";

  return (
    <nav aria-label={ariaLabel} className={`${surfaceClass} ${className ?? ""}`}>
      <div className="min-w-0 w-full sm:w-auto">{summary}</div>

      <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className={`${formSurface.secondaryButtonSm} w-full justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto`}
        >
          Anterior
        </button>

        <div
          className={`flex flex-wrap items-center justify-center gap-1 ${
            compactMobile ? "hidden sm:flex" : ""
          }`}
        >
          {pageNumbers.map((pageNumber, index) =>
            pageNumber === "ellipsis" ? (
              <span
                key={`ellipsis-${index}`}
                aria-hidden
                className="inline-flex min-h-10 min-w-10 items-center justify-center px-1 text-slate-400"
              >
                …
              </span>
            ) : (
              <button
                key={pageNumber}
                type="button"
                onClick={() => onPageChange(pageNumber)}
                aria-current={page === pageNumber ? "page" : undefined}
                aria-label={`Página ${pageNumber}`}
                className={`inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border px-2 py-1.5 text-xs font-medium transition ${
                  page === pageNumber
                    ? "border-brand-200 bg-brand-50 text-brand-700"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {pageNumber}
              </button>
            ),
          )}
        </div>

        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className={`${formSurface.secondaryButtonSm} w-full justify-center disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto`}
        >
          Próxima
        </button>
      </div>
    </nav>
  );
}
