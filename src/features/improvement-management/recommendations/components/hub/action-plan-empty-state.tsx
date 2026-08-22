"use client";

import { ClipboardList, Plus } from "lucide-react";
import { formSurface } from "@/shared/layout/form-surface";
import { EmptyState } from "@/shared/ui/components/empty-state";

type Props = {
  onCreate: () => void;
  /** Mantido por compatibilidade com callers anteriores. */
  accentColor?: string;
};

export function ActionPlanEmptyState({ onCreate }: Props) {
  return (
    <EmptyState
      icon={ClipboardList}
      title="Nenhuma ação cadastrada"
      description="Cadastre a primeira ação para iniciar a execução desta recomendação."
      action={
        <button
          type="button"
          className={`${formSurface.primaryButton} inline-flex items-center justify-center gap-2`}
          onClick={onCreate}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Nova ação
        </button>
      }
    />
  );
}
