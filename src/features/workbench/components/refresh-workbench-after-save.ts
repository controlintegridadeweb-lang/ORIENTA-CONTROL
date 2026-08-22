import type { Dispatch, SetStateAction } from "react";
import { invalidateRespondentOverviewCache } from "@/features/improvement-management";
import type { Mode } from "./workbench-helpers";
import type { WorkbenchFeedback } from "./workbench-types";

type Params = {
  deferReload: boolean;
  loadWorkbench: () => Promise<boolean>;
  mode: Mode;
  setFeedback: Dispatch<SetStateAction<WorkbenchFeedback | null>>;
};

export async function refreshWorkbenchAfterSave({
  deferReload,
  loadWorkbench,
  mode,
  setFeedback,
}: Params): Promise<boolean> {
  if (deferReload) return true;

  const reloaded = await loadWorkbench();
  if (mode === "respondent") invalidateRespondentOverviewCache();
  if (reloaded) return true;

  setFeedback({
    tone: "warning",
    title: "Resposta salva, mas a tela não foi atualizada",
    description:
      "Os dados foram registrados. Recarregue o diagnóstico para visualizar o estado mais recente.",
    retryAction: "reload",
  });
  return false;
}
