import { describe, expect, it } from "vitest";
import {
  filterByCollectionStatus,
  filterDashboardCycles,
  groupByState,
  isResponseDeadlineOverdue,
  selectLatestCyclePerOrganization,
  sortCyclesInColumn,
  summarize,
  PHASE_LABEL,
  STATE_ORDER,
} from "../dashboard-model";
import type { CycleListItem } from "@/features/cycles/cycle-queries";

function cyc(over: Partial<CycleListItem> & { state: string }): CycleListItem {
  return {
    id: "c"+Math.random(),
    periodId: "period-1",
    periodLabel: "2024",
    organizationId: "o",
    organizationName: "Org",
    organizationAcronym: "ORG",
    formId: "f",
    formName: "F",
    formVersionId: "fv",
    formVersion: 1,
    reopenCount: 0,
    startsAt: null,
    responseDeadlineAt: null,
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
  } as CycleListItem;
}

describe("groupByState", () => {
  it("retorna as 7 colunas na ordem operacional, mesmo vazias", () => {
    expect(STATE_ORDER).toEqual([
      "draft",
      "in_response",
      "awaiting_adjustment",
      "submitted",
      "in_validation",
      "validated",
      "completed",
    ]);
    const g = groupByState([]);
    expect(g.map((item) => item.state)).toEqual(STATE_ORDER);
    expect(g.every((item) => item.count === 0)).toBe(true);
  });
  it("distribui os ciclos no estado certo", () => {
    const g = groupByState([cyc({state:"draft"}), cyc({state:"draft"}), cyc({state:"completed"})]);
    expect(g.find(x=>x.state==="draft")!.count).toBe(2);
    expect(g.find(x=>x.state==="completed")!.count).toBe(1);
    expect(g.find(x=>x.state==="submitted")!.count).toBe(0);
  });


  it("usa Acompanhamento como fase do diagnóstico concluído", () => {
    const validated = groupByState([cyc({ state: "validated" })]).find(
      (group) => group.state === "validated",
    );
    expect(validated?.phase).toBe("acompanhamento");
    expect(PHASE_LABEL.acompanhamento).toBe("Acompanhamento");
  });

  it("ordena prazo vencido no topo da coluna", () => {
    const now = new Date("2026-07-16T12:00:00Z");
    const g = groupByState(
      [
        cyc({
          id: "ok",
          state: "in_response",
          organizationName: "Zeta",
          responseDeadlineAt: "2026-08-01T00:00:00Z",
        }),
        cyc({
          id: "late",
          state: "in_response",
          organizationName: "Alpha",
          responseDeadlineAt: "2026-07-01T00:00:00Z",
        }),
      ],
      now,
    );
    const ids = g.find((x) => x.state === "in_response")!.cycles.map((c) => c.id);
    expect(ids).toEqual(["late", "ok"]);
  });
});

describe("sortCyclesInColumn", () => {
  const now = new Date("2026-07-16T12:00:00Z");

  it("prioriza vencidos, depois prazo mais próximo, depois nome", () => {
    const sorted = sortCyclesInColumn(
      [
        cyc({
          id: "c",
          state: "in_response",
          organizationName: "Charlie",
          responseDeadlineAt: "2026-08-10T00:00:00Z",
        }),
        cyc({
          id: "a-late",
          state: "in_response",
          organizationName: "Alpha",
          responseDeadlineAt: "2026-07-01T00:00:00Z",
        }),
        cyc({
          id: "b",
          state: "in_response",
          organizationName: "Bravo",
          responseDeadlineAt: "2026-08-01T00:00:00Z",
        }),
        cyc({
          id: "z-late",
          state: "in_response",
          organizationName: "Zulu",
          responseDeadlineAt: "2026-06-01T00:00:00Z",
        }),
      ],
      now,
    ).map((c) => c.id);

    expect(sorted).toEqual(["z-late", "a-late", "b", "c"]);
  });

  it("coloca ciclos sem prazo depois dos que têm prazo", () => {
    const sorted = sortCyclesInColumn(
      [
        cyc({ id: "none", state: "draft", organizationName: "Sem prazo", responseDeadlineAt: null }),
        cyc({
          id: "with",
          state: "draft",
          organizationName: "Com prazo",
          responseDeadlineAt: "2026-08-01T00:00:00Z",
        }),
      ],
      now,
    ).map((c) => c.id);

    expect(sorted).toEqual(["with", "none"]);
  });
});

describe("summarize", () => {
  it("conta por fase corretamente", () => {
    const s = summarize([
      cyc({state:"draft"}),                 // construcao
      cyc({state:"in_response"}),           // resposta
      cyc({state:"awaiting_adjustment"}),   // resposta
      cyc({state:"submitted"}),             // validação aguardando início
      cyc({state:"in_validation"}),         // validação em andamento
      cyc({state:"validated"}),             // diagnostico
      cyc({state:"completed"}),             // encerrado
    ]);
    expect(s.total).toBe(7);
    expect(s.byPhase.resposta).toBe(2);
    expect(s.byPhase.validacao).toBe(2);
    expect(s.byPhase.construcao).toBe(1);
    expect(s.byPhase.acompanhamento).toBe(1);
    expect(s.byPhase.encerrado).toBe(1);
  });

  it("atraso conta só quem está em fase de resposta com prazo vencido", () => {
    const past = "2020-01-01T00:00:00Z";
    const future = "2999-01-01T00:00:00Z";
    const s = summarize([
      cyc({state:"in_response", responseDeadlineAt: past}),       // atrasado
      cyc({state:"awaiting_adjustment", responseDeadlineAt: past}), // atrasado
      cyc({state:"in_response", responseDeadlineAt: future}),     // no prazo
      cyc({state:"submitted", responseDeadlineAt: past}),         // enviado: ação já é do admin
      cyc({state:"completed", responseDeadlineAt: past}),         // encerrado: NÃO conta
      cyc({state:"validated", responseDeadlineAt: past}),         // diagnóstico: NÃO conta
    ]);
    expect(s.overdue).toBe(2);
  });

  it("conta reaberturas", () => {
    const s = summarize([cyc({state:"in_response", reopenCount:1}), cyc({state:"draft", reopenCount:0})]);
    expect(s.reopened).toBe(1);
  });
});

describe("selectLatestCyclePerOrganization", () => {
  it("mantém um ciclo por órgão — o período mais recente", () => {
    const selected = selectLatestCyclePerOrganization([
      cyc({
        id: "old",
        organizationId: "org-a",
        periodLabel: "2025.1",
        state: "completed",
      }),
      cyc({
        id: "new",
        organizationId: "org-a",
        periodLabel: "2026.1",
        state: "in_response",
      }),
      cyc({
        id: "other",
        organizationId: "org-b",
        periodLabel: "2026.1",
        state: "draft",
      }),
    ]);
    expect(selected).toHaveLength(2);
    expect(selected.find((item) => item.organizationId === "org-a")?.id).toBe("new");
    expect(selected.find((item) => item.organizationId === "org-b")?.id).toBe("other");
  });
});

describe("isResponseDeadlineOverdue", () => {
  const now = new Date("2026-08-01T12:00:00Z");

  it("não considera vencido quando a coleta está suspensa", () => {
    expect(
      isResponseDeadlineOverdue(
        cyc({
          state: "in_response",
          responseDeadlineAt: "2026-07-01T00:00:00Z",
          responseCollectionPausedAt: "2026-07-15T00:00:00Z",
        }),
        now,
      ),
    ).toBe(false);
  });
});


describe("filterByCollectionStatus", () => {
  const active = cyc({ id: "active", state: "in_response" });
  const suspended = cyc({
    id: "suspended",
    state: "in_response",
    responseCollectionPausedAt: "2026-08-01T10:00:00Z",
  });

  it("mantém todos quando o filtro de coleta é all", () => {
    expect(filterByCollectionStatus([active, suspended], "all")).toEqual([
      active,
      suspended,
    ]);
  });

  it("separa coleta ativa de coleta suspensa", () => {
    expect(filterByCollectionStatus([active, suspended], "active").map((item) => item.id)).toEqual([
      "active",
    ]);
    expect(
      filterByCollectionStatus([active, suspended], "suspended").map((item) => item.id),
    ).toEqual(["suspended"]);
  });
});


describe("filterDashboardCycles", () => {
  const now = new Date("2026-08-02T12:00:00Z");
  const cycles = [
    cyc({
      id: "active-late",
      state: "in_response",
      organizationId: "org-a",
      organizationName: "Polícia Civil",
      organizationAcronym: "PCRN",
      responseDeadlineAt: "2026-07-01T00:00:00Z",
    }),
    cyc({
      id: "suspended",
      state: "in_response",
      organizationId: "org-b",
      organizationName: "Instituto Ambiental",
      organizationAcronym: "IDEMA",
      responseCollectionPausedAt: "2026-08-01T00:00:00Z",
    }),
    cyc({
      id: "validated",
      state: "validated",
      organizationId: "org-c",
      organizationName: "Universidade Estadual",
      organizationAcronym: "UERN",
    }),
  ];

  it("combina busca, situação e condição da coleta", () => {
    const result = filterDashboardCycles(
      cycles,
      {
        search: "instituto",
        state: "in_response",
        dueFilter: "all",
        collectionFilter: "suspended",
      },
      now,
    );
    expect(result.map((item) => item.id)).toEqual(["suspended"]);
  });

  it("considera ação do respondente apenas com coleta ativa", () => {
    const result = filterDashboardCycles(
      cycles,
      {
        dueFilter: "in_response",
        collectionFilter: "all",
      },
      now,
    );
    expect(result.map((item) => item.id)).toEqual(["active-late"]);
  });
});
