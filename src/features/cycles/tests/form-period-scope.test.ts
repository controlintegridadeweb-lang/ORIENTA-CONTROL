import { describe, expect, it } from "vitest";
import type { CycleListItem } from "@/features/cycles/cycle-queries";
import {
  hasExceptionalDeadline,
  listCyclesForPeriod,
  resolveFormPeriodScope,
  type FormPeriodOption,
} from "../form-period-scope";
import { selectLatestCyclePerOrganization, summarize } from "../dashboard-model";

function period(over: Partial<FormPeriodOption> = {}): FormPeriodOption {
  return {
    id: "p1",
    periodCode: "2026.1",
    label: "2026.1",
    formVersionId: "fv1",
    startsAt: null,
    responseDeadlineAt: "2026-08-31T15:00:00+00:00",
    status: "open",
    ...over,
  };
}

function cycle(over: Partial<CycleListItem> = {}): CycleListItem {
  return {
    id: "c1",
    state: "validated",
    periodId: "p1",
    periodLabel: "2026.1",
    organizationId: "org-a",
    organizationName: "Org A",
    organizationAcronym: "A",
    formId: "f1",
    formName: "Form",
    formVersionId: "fv1",
    formVersion: 1,
    reopenCount: 0,
    startsAt: null,
    responseDeadlineAt: "2026-08-31T15:00:00+00:00",
    originalResponseDeadlineAt: null,
    validationDeadlineAt: null,
    cycleCloseAt: null,
    submittedLateAt: null,
    submissionDelaySeconds: null,
    closedAt: null,
    referenceStartYear: 2026,
    referenceEndYear: 2026,
    responseCollectionPausedAt: null,
    deadlineChangeCount: 0,
    workingProcessingId: null,
    workingProcessingVersion: null,
    ...over,
  };
}

describe("resolveFormPeriodScope", () => {
  it("prioriza periodId sobre label legado", () => {
    const periods = [
      period({ id: "p-old", periodCode: "2025.1", label: "2025.1" }),
      period({ id: "p-new", periodCode: "2026.1", label: "2026.1" }),
    ];
    const scope = resolveFormPeriodScope({
      formId: "f1",
      periodId: "p-new",
      legacyPeriodLabel: "2025.1",
      periods,
    });
    expect(scope.period?.id).toBe("p-new");
  });

  it("aceita periodLabel legado só como compat de leitura", () => {
    const periods = [period({ id: "p1", periodCode: "2026.1", label: "2026.1" })];
    const scope = resolveFormPeriodScope({
      formId: "f1",
      periodId: null,
      legacyPeriodLabel: "2026.1",
      periods,
    });
    expect(scope.period?.id).toBe("p1");
  });

  it("label de apresentação não é identidade quando há periodId", () => {
    const periods = [
      period({ id: "p1", periodCode: "2026.1", label: "Diagnóstico de Integridade 2026" }),
    ];
    const scope = resolveFormPeriodScope({
      formId: "f1",
      periodId: "p1",
      legacyPeriodLabel: "outro rótulo",
      periods,
    });
    expect(scope.period?.periodCode).toBe("2026.1");
    expect(scope.period?.label).toBe("Diagnóstico de Integridade 2026");
  });
});

describe("listCyclesForPeriod", () => {
  it("versão pode ter vários form_periods sem misturar ciclos", () => {
    const cycles = [
      cycle({ id: "c1", periodId: "p1", organizationId: "o1" }),
      cycle({ id: "c2", periodId: "p2", organizationId: "o1", periodLabel: "2025.1" }),
      cycle({ id: "c3", periodId: "p1", organizationId: "o2" }),
    ];
    const scoped = listCyclesForPeriod(cycles, "p1");
    expect(scoped.map((c) => c.id).sort()).toEqual(["c1", "c3"]);
  });

  it("período tem muitos ciclos e no máximo um por órgão no escopo", () => {
    const cycles = [
      cycle({ id: "c1", periodId: "p1", organizationId: "o1" }),
      cycle({ id: "c2", periodId: "p1", organizationId: "o2" }),
      cycle({ id: "c3", periodId: "p1", organizationId: "o3", state: "draft" }),
    ];
    const scoped = listCyclesForPeriod(cycles, "p1");
    expect(scoped).toHaveLength(3);
    const orgs = new Set(scoped.map((c) => c.organizationId));
    expect(orgs.size).toBe(3);
  });

  it("órgão sem respostas aparece no quadro do período", () => {
    const cycles = [
      cycle({
        id: "empty",
        periodId: "p1",
        organizationId: "o-empty",
        state: "draft",
        responseDeadlineAt: null,
      }),
    ];
    expect(listCyclesForPeriod(cycles, "p1")).toHaveLength(1);
  });

  it("com periodId não precisa de selectLatestCyclePerOrganization para desfazer mistura", () => {
    const cycles = [
      cycle({
        id: "kept",
        periodId: "p1",
        organizationId: "o1",
        periodLabel: "2026.1",
        state: "validated",
      }),
    ];
    const scoped = listCyclesForPeriod(cycles, "p1");
    // Mesmo se houvesse outro rótulo no passado, o filtro é por periodId.
    expect(selectLatestCyclePerOrganization(scoped)).toEqual(scoped);
  });

  it("contadores = cards do período filtrado", () => {
    const cycles = [
      cycle({ id: "c1", periodId: "p1", organizationId: "o1", state: "validated" }),
      cycle({ id: "c2", periodId: "p1", organizationId: "o2", state: "in_response" }),
      cycle({ id: "c3", periodId: "p2", organizationId: "o3", state: "validated" }),
    ];
    const scoped = listCyclesForPeriod(cycles, "p1");
    const summary = summarize(scoped);
    expect(summary.total).toBe(2);
    expect(summary.total).toBe(scoped.length);
  });
});

describe("hasExceptionalDeadline", () => {
  it("prorrogação individual não cria período — só marca excepcional", () => {
    const base = period();
    expect(
      hasExceptionalDeadline(
        { responseDeadlineAt: "2026-09-15T15:00:00+00:00" },
        base,
      ),
    ).toBe(true);
    expect(
      hasExceptionalDeadline(
        { responseDeadlineAt: base.responseDeadlineAt },
        base,
      ),
    ).toBe(false);
  });
});
