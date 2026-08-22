import { z } from "zod";

export const reportLifecycleStatusSchema = z.enum([
  "not_ready",
  "ready_to_emit",
  "emitting",
  "available",
  "emission_failed",
  "outdated",
]);

export type ReportLifecycleStatus = z.infer<typeof reportLifecycleStatusSchema>;

export const REPORT_LIFECYCLE_LABEL: Record<ReportLifecycleStatus, string> = {
  not_ready: "Ainda não disponível",
  ready_to_emit: "Pronto para emitir",
  emitting: "Emissão em andamento",
  available: "Relatório disponível",
  emission_failed: "Falha na emissão",
  outdated: "Versão histórica",
};
