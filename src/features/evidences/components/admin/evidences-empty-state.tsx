"use client";

import { FileSearch, X } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";

type Props = {
  onClearFilters: () => void;
  hasActiveFilters: boolean;
};

export function EvidencesEmptyState({ onClearFilters, hasActiveFilters }: Props) {
  return (
    <div className={formSurface.empty.container}>
      <span className={formSurface.empty.iconWrap}>
        <FileSearch className="h-5 w-5" aria-hidden />
      </span>
      <p className={formSurface.empty.title}>Nenhuma evidência encontrada</p>
      <p className={formSurface.empty.description}>
        Ajuste a busca, o intervalo de datas ou limpe os filtros para ver resultados.
      </p>
      {hasActiveFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className={formSurface.secondaryButtonSm}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Limpar filtros
        </button>
      ) : null}
    </div>
  );
}
