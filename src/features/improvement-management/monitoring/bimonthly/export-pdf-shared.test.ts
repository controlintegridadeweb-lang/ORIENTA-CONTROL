import { describe, expect, it } from "vitest";
import {
  ACTION_PLAN_BIMONTHLY_EXPORT_AMBIGUOUS_CYCLE,
  ACTION_PLAN_BIMONTHLY_EXPORT_NO_CYCLE,
  ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT,
  actionPlanBimonthlyExportErrorMessage,
  resolveActionPlanExportCycleId,
} from "./export-pdf-shared";

describe("exportação PDF do plano via relatório bimestral", () => {
  it("prioriza o cycleId do filtro", () => {
    expect(
      resolveActionPlanExportCycleId("cycle-filter", ["cycle-a", "cycle-b"]),
    ).toEqual({ cycleId: "cycle-filter" });
  });

  it("infere o diagnóstico quando há um único cycleId nos itens", () => {
    expect(resolveActionPlanExportCycleId(undefined, ["cycle-a", "cycle-a", ""])).toEqual({
      cycleId: "cycle-a",
    });
  });

  it("rejeita exportação ambígua ou sem diagnóstico", () => {
    expect(resolveActionPlanExportCycleId(undefined, [])).toEqual({
      error: ACTION_PLAN_BIMONTHLY_EXPORT_NO_CYCLE,
    });
    expect(resolveActionPlanExportCycleId(undefined, ["cycle-a", "cycle-b"])).toEqual({
      error: ACTION_PLAN_BIMONTHLY_EXPORT_AMBIGUOUS_CYCLE,
    });
  });

  it("expõe mensagens orientando a gerar o relatório na aba Evolução", () => {
    expect(actionPlanBimonthlyExportErrorMessage(ACTION_PLAN_BIMONTHLY_EXPORT_NO_REPORT)).toContain(
      "Evolução",
    );
  });
});
