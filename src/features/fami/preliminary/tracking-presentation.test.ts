import { describe, expect, it } from "vitest";
import { famiPreliminaryLabels } from "@/shared/labels/official-labels";
import {
  bimesterRowStatus,
  buildBimesterRowView,
  formatBimesterSummary,
  listBimesterRows,
} from "./tracking-presentation";

describe("apresentação do acompanhamento bimestral", () => {
  it("lista os seis bimestres do ano", () => {
    const rows = listBimesterRows(2026, {
      officialAvailableAt: "2026-03-01T12:00:00.000-03:00",
      closedBimesters: new Set(),
      now: new Date("2026-03-15T12:00:00.000-03:00"),
    });
    expect(rows).toHaveLength(6);
    expect(rows.map((row) => row.bimester)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rows[0]?.closed).toBe(true);
    expect(rows[1]?.canGenerateManually).toBe(true);
    expect(rows[1]?.closesQuadrimester).toBe(true);
    expect(rows[1]?.quadrimester).toBe(1);
  });

  it("não permite gerar relatório depois do corte ou sem FAMI oficial", () => {
    const closed = buildBimesterRowView(2026, 1, {
      officialAvailableAt: "2026-01-10T12:00:00.000-03:00",
      hasClosedSnapshot: false,
      now: new Date("2026-03-01T00:00:00.000-03:00"),
    });
    expect(closed.canGenerateManually).toBe(false);

    const withoutOfficial = buildBimesterRowView(2026, 2, {
      officialAvailableAt: null,
      hasClosedSnapshot: false,
      now: new Date("2026-03-15T12:00:00.000-03:00"),
    });
    expect(withoutOfficial.canGenerateManually).toBe(false);
  });

  it("rotula relatório disponível, pendente e aguardando período", () => {
    const upcoming = buildBimesterRowView(2026, 6, {
      officialAvailableAt: "2026-01-10T12:00:00.000-03:00",
      hasClosedSnapshot: false,
      now: new Date("2026-03-15T12:00:00.000-03:00"),
    });
    expect(bimesterRowStatus(upcoming, false).label).toBe(famiPreliminaryLabels.statusUpcoming);
    expect(bimesterRowStatus(upcoming, true).label).toBe(famiPreliminaryLabels.statusUpcoming);

    const open = buildBimesterRowView(2026, 2, {
      officialAvailableAt: "2026-01-10T12:00:00.000-03:00",
      hasClosedSnapshot: false,
      now: new Date("2026-03-15T12:00:00.000-03:00"),
    });
    expect(bimesterRowStatus(open, false).label).toBe(famiPreliminaryLabels.bimonthlyReportPending);
    expect(bimesterRowStatus(open, true).label).toBe(famiPreliminaryLabels.bimonthlyReportAvailable);
  });

  it("resume critérios e progresso médio do snapshot", () => {
    expect(formatBimesterSummary(null)).toBe("—");
    expect(
      formatBimesterSummary({
        completedCriterionCount: 2,
        pendingCriterionCount: 5,
        averageProgressPercentage: 40.5,
      }),
    ).toContain("2 critérios concluídos");
  });
});
