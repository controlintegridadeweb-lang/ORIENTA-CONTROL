"use client";

import { X } from "lucide-react";
import { typography } from "@/shared/layout/design-system";

export type AdminListScopePart = {
  label: string;
  value: string;
  onClear?: () => void;
};

type Props = {
  parts: AdminListScopePart[];
};

/** Contexto ativo dos filtros aplicados a uma lista administrativa. */
export function AdminListScopeBanner({ parts }: Props) {
  if (parts.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border border-slate-200/70 bg-slate-50/60 px-3 py-2"
      role="status"
      aria-live="polite"
    >
      <span className={`${typography.meta} font-medium text-slate-500`}>Escopo ativo</span>
      {parts.map((part) => (
        <span
          key={`${part.label}-${part.value}`}
          className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-200/80 bg-white py-0.5 pl-2 pr-0.5 text-micro text-slate-700 shadow-sm"
        >
          <span className="shrink-0 text-slate-500">{part.label}:</span>
          <span className="truncate font-medium text-slate-800" title={part.value}>
            {part.value}
          </span>
          {part.onClear ? (
            <button
              type="button"
              onClick={part.onClear}
              className="ml-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label={`Remover filtro ${part.label}`}
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          ) : null}
        </span>
      ))}
    </div>
  );
}
