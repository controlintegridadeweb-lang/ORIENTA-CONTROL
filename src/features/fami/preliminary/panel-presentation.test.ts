import { describe, expect, it } from "vitest";
import {
  formatCutoffDate,
  formatPreliminaryScore,
  buildQuadrimesterDisplay,
  preliminaryPercentageForPeriod,
  quadrimesterAvailability,
  quadrimesterDateRangeLabel,
  readPreliminaryApiError,
  resolveQuadrimesterDisplay,
  selectLatestCheckpoint,
} from "./panel-presentation";
import {
  canAutomaticallyCloseQuadrimester,
  canManuallyMaterializeQuadrimester,
} from "./domain";

const NOW = new Date("2026-08-13T10:00:00.000-03:00");
const MANUAL_CHECKPOINT = {
  percentage: 48,
  calculatedAt: "2026-08-10T14:30:00.000-03:00",
  closedAt: null,
  calculationKind: "manual" as const,
};
const CLOSED_CHECKPOINT = {
  percentage: 51.2,
  calculatedAt: "2026-09-01T03:00:00.000-03:00",
  closedAt: "2026-09-01T03:00:00.000-03:00",
  calculationKind: "automatic" as const,
};

describe("apresentação do FAMI preliminar", () => {
  it("lê a mensagem de erro da API sem exigir o payload de sucesso", () => {
    expect(
      readPreliminaryApiError(
        { error: "Este quadrimestre já foi fechado e o snapshot histórico não pode ser alterado." },
        "Falha ao calcular o FAMI preliminar.",
      ),
    ).toBe("Este quadrimestre já foi fechado e o snapshot histórico não pode ser alterado.");
    expect(readPreliminaryApiError({ latestByPeriod: [] }, "Falha ao calcular o FAMI preliminar.")).toBe(
      "Falha ao calcular o FAMI preliminar.",
    );
    expect(readPreliminaryApiError(null, "Falha ao calcular o FAMI preliminar.")).toBe(
      "Falha ao calcular o FAMI preliminar.",
    );
  });

  it("descreve o período em português e o início do quadrimestre", () => {
    expect(quadrimesterDateRangeLabel("2026-01-01", "2026-04-30")).toBe("janeiro a abril");
    expect(formatCutoffDate("2026-04-30")).toBe("30/04/2026");

    const first = quadrimesterAvailability(2026, 1, NOW);
    expect(first.closed).toBe(true);
    expect(first.periodLabel).toBe("1º quadrimestre");
    expect(first.rangeLabel).toBe("janeiro a abril");
    expect(first.cutoffLabel).toBe("30/04/2026");

    const third = quadrimesterAvailability(2026, 3, NOW);
    expect(third.started).toBe(false);
    expect(third.waitingLabel).toBe("O período começa em 01/09/2026.");
  });

  it("escolhe o quadrimestre mais recente já calculado", () => {
    expect(selectLatestCheckpoint([])).toBeNull();
    expect(
      selectLatestCheckpoint([
        { quadrimester: 1 as const },
        { quadrimester: 3 as const },
        { quadrimester: 2 as const },
      ])?.quadrimester,
    ).toBe(3);
    expect(
      formatPreliminaryScore({
        pointsObtained: 12,
        pointsPossible: 20,
        percentage: 49.5,
        maturityLevel: 3,
      }),
    ).toBe("49,5% · nível 3");
  });

  it("nunca exibe percentual sem cálculo persistido", () => {
    expect(preliminaryPercentageForPeriod({ checkpointPercentage: null })).toBeNull();
    expect(preliminaryPercentageForPeriod({ checkpointPercentage: 49.5 })).toBe(49.5);
    expect(
      resolveQuadrimesterDisplay({
        started: true,
        closed: false,
        officialAvailable: true,
        hasImplementation: true,
        checkpoint: null,
      }).percentage,
    ).toBeNull();
  });
});

describe("cinco situações do acompanhamento quadrimestral", () => {
  it("1. quadrimestre futuro permanece aguardando período, sem valor e sem ação", () => {
    const display = buildQuadrimesterDisplay({
      referenceYear: 2026,
      quadrimester: 3,
      officialAvailableAt: "2026-06-15T12:00:00.000-03:00",
      earliestActionCreatedAt: "2026-07-01T12:00:00.000-03:00",
      checkpoint: null,
      now: NOW,
    });
    expect(display.kind).toBe("upcoming");
    expect(display.percentage).toBeNull();
    expect(display.action).toBe("none");
    expect(display.canCalculateManually).toBe(false);
  });

  it("2. sem base oficial no corte fica não implementado", () => {
    const withoutOfficial = buildQuadrimesterDisplay({
      referenceYear: 2026,
      quadrimester: 1,
      officialAvailableAt: "2026-06-15T12:00:00.000-03:00",
      earliestActionCreatedAt: "2026-07-01T12:00:00.000-03:00",
      checkpoint: null,
      now: NOW,
    });
    expect(withoutOfficial.kind).toBe("not_implemented");
    expect(withoutOfficial.percentage).toBeNull();
    expect(withoutOfficial.action).toBe("none");
    expect(withoutOfficial.reason).toMatch(/FAMI oficial/);
  });

  it("2b. período aberto com base oficial permanece em andamento mesmo sem ações", () => {
    const openWithoutActions = buildQuadrimesterDisplay({
      referenceYear: 2026,
      quadrimester: 2,
      officialAvailableAt: "2026-06-15T12:00:00.000-03:00",
      earliestActionCreatedAt: null,
      checkpoint: null,
      now: NOW,
    });
    expect(openWithoutActions.kind).toBe("open");
    expect(openWithoutActions.percentage).toBeNull();
    expect(openWithoutActions.action).toBe("calculate");
    expect(openWithoutActions.canCalculateManually).toBe(true);
  });

  it("2c. período vencido sem ações permanece não implementado", () => {
    const closedWithoutActions = buildQuadrimesterDisplay({
      referenceYear: 2026,
      quadrimester: 1,
      officialAvailableAt: "2026-03-15T12:00:00.000-03:00",
      earliestActionCreatedAt: null,
      checkpoint: null,
      now: NOW,
    });
    expect(closedWithoutActions.kind).toBe("not_implemented");
    expect(closedWithoutActions.percentage).toBeNull();
    expect(closedWithoutActions.action).toBe("none");
    expect(closedWithoutActions.reason).toMatch(/Monitoramento/);
  });

  it("3. período aberto sem cálculo mostra em andamento e Calcular agora", () => {
    const display = buildQuadrimesterDisplay({
      referenceYear: 2026,
      quadrimester: 2,
      officialAvailableAt: "2026-06-15T12:00:00.000-03:00",
      earliestActionCreatedAt: "2026-07-01T12:00:00.000-03:00",
      checkpoint: null,
      now: NOW,
    });
    expect(display.kind).toBe("open");
    expect(display.percentage).toBeNull();
    expect(display.action).toBe("calculate");
    expect(display.canCalculateManually).toBe(true);
  });

  it("4. período aberto com cálculo manual mostra o percentual e Recalcular", () => {
    const display = buildQuadrimesterDisplay({
      referenceYear: 2026,
      quadrimester: 2,
      officialAvailableAt: "2026-06-15T12:00:00.000-03:00",
      earliestActionCreatedAt: "2026-07-01T12:00:00.000-03:00",
      checkpoint: MANUAL_CHECKPOINT,
      now: NOW,
    });
    expect(display.kind).toBe("open_calculated");
    expect(display.percentage).toBe(48);
    expect(display.action).toBe("recalculate");
    expect(display.auxiliary).toMatch(/Calculado em/);
    expect(display.canCalculateManually).toBe(true);
  });

  it("5. quadrimestre fechado automaticamente fica concluído, sem recálculo", () => {
    const display = buildQuadrimesterDisplay({
      referenceYear: 2026,
      quadrimester: 1,
      officialAvailableAt: "2026-04-10T12:00:00.000-03:00",
      earliestActionCreatedAt: "2026-03-01T12:00:00.000-03:00",
      checkpoint: {
        ...CLOSED_CHECKPOINT,
        percentage: 47.1,
      },
      now: NOW,
    });
    expect(display.kind).toBe("completed");
    expect(display.percentage).toBe(47.1);
    expect(display.action).toBe("view_details");
    expect(display.auxiliary).toMatch(/Fechado automaticamente em/);
    expect(display.canCalculateManually).toBe(false);
  });

  it("corrige a inconsistência visual entre percentual e ação", () => {
    const withoutPersist = resolveQuadrimesterDisplay({
      started: true,
      closed: false,
      officialAvailable: true,
      hasImplementation: true,
      checkpoint: null,
    });
    expect(withoutPersist.percentage).toBeNull();
    expect(withoutPersist.action).toBe("calculate");

    const withPersist = resolveQuadrimesterDisplay({
      started: true,
      closed: false,
      officialAvailable: true,
      hasImplementation: true,
      checkpoint: MANUAL_CHECKPOINT,
    });
    expect(withPersist.percentage).toBe(48);
    expect(withPersist.action).toBe("recalculate");
  });
});

describe("regras de cálculo manual, recálculo e fechamento", () => {
  it("permite recálculo manual só no período aberto ainda não fechado", () => {
    expect(
      canManuallyMaterializeQuadrimester({
        started: true,
        closed: false,
        officialAvailable: true,
        hasClosedSnapshot: false,
      }),
    ).toBe(true);
    expect(
      canManuallyMaterializeQuadrimester({
        started: true,
        closed: true,
        officialAvailable: true,
        hasClosedSnapshot: false,
      }),
    ).toBe(false);
    expect(
      canManuallyMaterializeQuadrimester({
        started: true,
        closed: false,
        officialAvailable: true,
        hasClosedSnapshot: true,
      }),
    ).toBe(false);
  });

  it("fecha automaticamente período vencido com base e execução, de forma idempotente", () => {
    const eligible = {
      closed: true,
      officialAvailable: true,
      hasImplementation: true,
      hasCheckpoint: false,
      hasClosedSnapshot: false,
    };
    expect(canAutomaticallyCloseQuadrimester(eligible)).toBe(true);
    expect(canAutomaticallyCloseQuadrimester({ ...eligible, hasCheckpoint: true })).toBe(true);
    expect(canAutomaticallyCloseQuadrimester({ ...eligible, hasClosedSnapshot: true })).toBe(false);
    expect(canAutomaticallyCloseQuadrimester({ ...eligible, officialAvailable: false })).toBe(false);
    expect(
      canAutomaticallyCloseQuadrimester({
        ...eligible,
        hasImplementation: false,
        hasCheckpoint: false,
      }),
    ).toBe(false);
  });

  it("não permite alterar quadrimestre já fechado", () => {
    const display = resolveQuadrimesterDisplay({
      started: true,
      closed: true,
      officialAvailable: true,
      hasImplementation: true,
      checkpoint: CLOSED_CHECKPOINT,
    });
    expect(display.kind).toBe("completed");
    expect(display.action).not.toBe("recalculate");
    expect(display.action).not.toBe("calculate");
    expect(
      canManuallyMaterializeQuadrimester({
        started: true,
        closed: true,
        officialAvailable: true,
        hasClosedSnapshot: true,
      }),
    ).toBe(false);
  });
});
