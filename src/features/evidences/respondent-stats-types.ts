import type { RespondentOverallStatus } from "./respondent-evidence-helpers";

export type RespondentStatsResult = {
  enviadas: number;
  aprovadas: number;
  aguardando: number;
  reprovadas: number;
  complementacao: number;
  overall: RespondentOverallStatus;
  hasPendency: boolean;
};
