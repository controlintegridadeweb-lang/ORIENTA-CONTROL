// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import {
  ANSWER_CHART_COLORS,
  AnswerDistributionChart,
  buildAnswerChartModel,
  displayPercentage,
  sumAnswerDistribution,
} from "./answer-distribution-chart";
import type { AnswerValueDistribution } from "@/features/forms/answers-types";

afterEach(() => cleanup());

const SCENARIOS: {
  name: string;
  distribution: AnswerValueDistribution;
  expectedTotal: number;
  expectedPct: { yes: number; no: number; not_applicable: number };
  expectedChartKeys: Array<"yes" | "no" | "not_applicable">;
}[] = [
  {
    name: "22 Sim, 1 Não, 0 Não se aplica",
    distribution: { yes: 22, no: 1, not_applicable: 0 },
    expectedTotal: 23,
    expectedPct: { yes: 96, no: 4, not_applicable: 0 },
    expectedChartKeys: ["yes", "no"],
  },
  {
    name: "12 Sim, 11 Não, 0 Não se aplica",
    distribution: { yes: 12, no: 11, not_applicable: 0 },
    expectedTotal: 23,
    expectedPct: { yes: 52, no: 48, not_applicable: 0 },
    expectedChartKeys: ["yes", "no"],
  },
  {
    name: "0 Sim, 0 Não, 0 Não se aplica",
    distribution: { yes: 0, no: 0, not_applicable: 0 },
    expectedTotal: 0,
    expectedPct: { yes: 0, no: 0, not_applicable: 0 },
    expectedChartKeys: [],
  },
  {
    name: "23 Sim, 0 Não, 0 Não se aplica",
    distribution: { yes: 23, no: 0, not_applicable: 0 },
    expectedTotal: 23,
    expectedPct: { yes: 100, no: 0, not_applicable: 0 },
    expectedChartKeys: ["yes"],
  },
  {
    name: "0 Sim, 23 Não, 0 Não se aplica",
    distribution: { yes: 0, no: 23, not_applicable: 0 },
    expectedTotal: 23,
    expectedPct: { yes: 0, no: 100, not_applicable: 0 },
    expectedChartKeys: ["no"],
  },
  {
    name: "10 Sim, 8 Não, 5 Não se aplica",
    distribution: { yes: 10, no: 8, not_applicable: 5 },
    expectedTotal: 23,
    expectedPct: { yes: 43, no: 35, not_applicable: 22 },
    expectedChartKeys: ["yes", "no", "not_applicable"],
  },
];

describe("buildAnswerChartModel / percentuais", () => {
  for (const scenario of SCENARIOS) {
    it(scenario.name, () => {
      const model = buildAnswerChartModel(scenario.distribution);

      expect(sumAnswerDistribution(scenario.distribution)).toBe(scenario.expectedTotal);
      expect(model.total).toBe(scenario.expectedTotal);

      expect(model.chartData.map((item) => item.key)).toEqual(scenario.expectedChartKeys);
      expect(model.chartData.every((item) => item.value > 0)).toBe(true);
      expect(model.chartData.reduce((sum, item) => sum + item.value, 0)).toBe(
        scenario.expectedTotal,
      );

      for (const item of model.legend) {
        expect(item.percentage).toBe(scenario.expectedPct[item.key]);
        expect(item.percentage).toBe(displayPercentage(item.value, model.total));
        expect(item.color).toBe(ANSWER_CHART_COLORS[item.key]);
      }

      expect(model.legend).toHaveLength(3);
    });
  }

  it("não envia percentuais ao gráfico — só contagens absolutas", () => {
    const model = buildAnswerChartModel({ yes: 22, no: 1, not_applicable: 0 });
    expect(model.chartData).toEqual([
      { key: "yes", label: "Sim", value: 22, color: ANSWER_CHART_COLORS.yes },
      { key: "no", label: "Não", value: 1, color: ANSWER_CHART_COLORS.no },
    ]);
  });
});

describe("AnswerDistributionChart render", () => {
  it("22/1/0: uma rosca, total 23, legenda e sem segmento zero", () => {
    const { container } = render(
      <AnswerDistributionChart distribution={{ yes: 22, no: 1, not_applicable: 0 }} />,
    );

    expect(screen.getByTestId("answer-chart-total").textContent).toBe("23");
    expect(screen.getByText("respostas")).toBeTruthy();

    const svgs = container.querySelectorAll("svg[data-chart-layers='1']");
    expect(svgs).toHaveLength(1);
    expect(svgs[0]!.querySelectorAll("path")).toHaveLength(2);
    expect(svgs[0]!.querySelectorAll("circle")).toHaveLength(0);

    const legend = screen.getByTestId("answer-chart-legend");
    expect(within(legend).getByText("Sim")).toBeTruthy();
    expect(legend.querySelector('[data-legend-count="yes"]')?.textContent).toBe("22");
    expect(legend.querySelector('[data-legend-pct="yes"]')?.textContent).toBe("96%");
    expect(legend.querySelector('[data-legend-count="no"]')?.textContent).toBe("1");
    expect(legend.querySelector('[data-legend-pct="no"]')?.textContent).toBe("4%");
    expect(legend.querySelector('[data-legend-count="not_applicable"]')?.textContent).toBe("0");
    expect(legend.querySelector('[data-legend-pct="not_applicable"]')?.textContent).toBe("0%");
    expect(legend.querySelector('[data-legend-color="yes"]')).toHaveProperty(
      "style.backgroundColor",
      // jsdom normaliza hex → rgb
      "rgb(52, 211, 153)",
    );
  });

  it("12/11/0: proporção ~52%/48% e duas fatias", () => {
    const { container } = render(
      <AnswerDistributionChart distribution={{ yes: 12, no: 11, not_applicable: 0 }} />,
    );

    expect(screen.getByTestId("answer-chart-total").textContent).toBe("23");
    const svg = container.querySelector("svg[data-chart-layers='1']")!;
    expect(svg.querySelectorAll("path")).toHaveLength(2);

    const legend = screen.getByTestId("answer-chart-legend");
    expect(legend.querySelector('[data-legend-pct="yes"]')?.textContent).toBe("52%");
    expect(legend.querySelector('[data-legend-pct="no"]')?.textContent).toBe("48%");
  });

  it("total zero: estado neutro sem SVG de rosca", () => {
    const { container } = render(
      <AnswerDistributionChart distribution={{ yes: 0, no: 0, not_applicable: 0 }} />,
    );

    expect(screen.getByTestId("answer-chart-empty")).toBeTruthy();
    expect(screen.getByText("Nenhuma resposta registrada")).toBeTruthy();
    expect(container.querySelector("svg")).toBeNull();

    const legend = screen.getByTestId("answer-chart-legend");
    expect(legend.querySelector('[data-legend-count="yes"]')?.textContent).toBe("0");
    expect(legend.querySelector('[data-legend-pct="yes"]')?.textContent).toBe("0%");
  });

  it("categoria única: um anel via stroke, sem círculo sobreposto de preenchimento", () => {
    const { container } = render(
      <AnswerDistributionChart distribution={{ yes: 23, no: 0, not_applicable: 0 }} />,
    );

    const svg = container.querySelector("svg[data-chart-layers='1']")!;
    expect(svg.querySelectorAll("circle")).toHaveLength(1);
    expect(svg.querySelector("circle")!.getAttribute("fill")).toBe("none");
    expect(svg.querySelectorAll("path")).toHaveLength(0);
    expect(screen.getByTestId("answer-chart-total").textContent).toBe("23");
  });

  it("três alternativas positivas: três paths e uma única camada SVG", () => {
    const { container } = render(
      <AnswerDistributionChart distribution={{ yes: 10, no: 8, not_applicable: 5 }} />,
    );

    const svgs = container.querySelectorAll("svg");
    expect(svgs).toHaveLength(1);
    expect(svgs[0]!.querySelectorAll("path")).toHaveLength(3);
    expect(screen.getByTestId("answer-chart-total").textContent).toBe("23");
  });
});
