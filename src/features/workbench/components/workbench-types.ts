import type { Mode } from "./workbench-helpers";

export type WorkbenchIds = {
  cycleId: string;
};

export type UseWorkbenchParams = {
  mode: Mode;
  ids: WorkbenchIds;
  canAutoLoad: boolean;
  simplifiedRespondent: boolean;
  initialFocusQuestionId?: string;
  submissionReturnTo?: string;
};

type WorkbenchFeedbackRetryAction = "reload" | "submit";

export type WorkbenchFeedback = {
  tone: "error" | "warning" | "info";
  title: string;
  description?: string;
  retryAction?: WorkbenchFeedbackRetryAction;
};

export type SaveResponseOptions = {
  silent?: boolean;
  deferReload?: boolean;
  /** Exige evidência válida (ação explícita “Salvar resposta”). */
  requireEvidence?: boolean;
};
