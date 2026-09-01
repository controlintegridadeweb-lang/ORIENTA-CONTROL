export const ACTION_PLAN_BIMONTHLY_EXPORT_NO_CYCLE = "action_plan_bimonthly_export_no_cycle";
export const ACTION_PLAN_BIMONTHLY_EXPORT_AMBIGUOUS_CYCLE =
  "action_plan_bimonthly_export_ambiguous_cycle";
export const ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT = "action_plan_bimonthly_export_no_report";

export function resolveActionPlanExportCycleId(
  queryCycleId: string | undefined,
  itemCycleIds: readonly string[],
):
  | { cycleId: string }
  | {
      error:
        | typeof ACTION_PLAN_BIMONTHLY_EXPORT_NO_CYCLE
        | typeof ACTION_PLAN_BIMONTHLY_EXPORT_AMBIGUOUS_CYCLE;
    } {
  if (queryCycleId) return { cycleId: queryCycleId };
  const unique = [...new Set(itemCycleIds.filter(Boolean))];
  if (unique.length === 0) return { error: ACTION_PLAN_BIMONTHLY_EXPORT_NO_CYCLE };
  if (unique.length > 1) return { error: ACTION_PLAN_BIMONTHLY_EXPORT_AMBIGUOUS_CYCLE };
  return { cycleId: unique[0]! };
}

export function actionPlanBimonthlyExportErrorMessage(error: string): string {
  if (error === ACTION_PLAN_BIMONTHLY_EXPORT_AMBIGUOUS_CYCLE) {
    return "Selecione um diagnóstico para exportar o relatório bimestral.";
  }
  if (error === ACTION_PLAN_BIMONTHLY_EXPORT_NO_CYCLE) {
    return "Nenhum diagnóstico identificado para exportar o relatório bimestral.";
  }
  if (error === ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT) {
    return "Nenhum relatório bimestral disponível. Gere o relatório na aba Evolução do Resultado FAMI.";
  }
  return "Falha ao exportar o relatório bimestral.";
}
