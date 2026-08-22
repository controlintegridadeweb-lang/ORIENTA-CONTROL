"use client";

import { useTableSync } from "@/infrastructure/supabase/use-table-sync";
import type { WorkbenchFeedback, WorkbenchIds } from "./workbench-types";

export function useWorkbenchRealtime({
  ids,
  enabled,
  savingQuestionId,
  submittingForm,
  hasLocalDrafts,
  setFeedback,
  reload,
}: {
  ids: WorkbenchIds;
  enabled: boolean;
  savingQuestionId: string | null;
  submittingForm: boolean;
  hasLocalDrafts: boolean;
  setFeedback: (feedback: WorkbenchFeedback | null) => void;
  reload: () => Promise<unknown>;
}) {
  useTableSync({
    table: "responses",
    filter: `cycle_id=eq.${ids.cycleId}`,
    enabled,
    onChange: async () => {
      if (document.visibilityState !== "visible" || savingQuestionId || submittingForm) return;
      if (hasLocalDrafts) {
        setFeedback({
          tone: "warning",
          title: "O diagnóstico foi alterado em outra sessão",
          description:
            "Há alterações locais ainda não salvas. Salve-as ou recarregue o diagnóstico antes de continuar.",
          retryAction: "reload",
        });
        return;
      }
      await reload();
    },
  });
}
