// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminMonitoringSummaryCards } from "./admin-monitoring-summary-cards";

type Filter = "without_plan" | "executing" | null;

const CARDS: Array<{
  id: Filter;
  label: string;
  value: number;
  hint: string;
  variant: "neutral" | "warning" | "info";
}> = [
  { id: null, label: "Total no escopo", value: 110, hint: "Todas as visíveis", variant: "neutral" },
  { id: "without_plan", label: "Aguardando ação", value: 109, hint: "Sem plano", variant: "warning" },
  { id: "executing", label: "Em acompanhamento", value: 1, hint: "Em execução", variant: "info" },
];

describe("AdminMonitoringSummaryCards", () => {
  afterEach(() => cleanup());

  it("não destaca o total quando nenhum filtro de indicador está ativo", () => {
    render(
      <AdminMonitoringSummaryCards
        ariaLabel="Indicadores do portfólio"
        activeFilter={null}
        clearFilter={null}
        onSelect={vi.fn()}
        cards={CARDS}
      />,
    );

    expect(screen.getByRole("button", { name: /Total no escopo/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    expect(screen.getByRole("button", { name: /Aguardando ação/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("destaca só o indicador filtrado e o total limpa o filtro", () => {
    const onSelect = vi.fn();
    render(
      <AdminMonitoringSummaryCards
        ariaLabel="Indicadores do portfólio"
        activeFilter="without_plan"
        clearFilter={null}
        onSelect={onSelect}
        cards={CARDS}
      />,
    );

    expect(screen.getByRole("button", { name: /Aguardando ação/i }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(screen.getByRole("button", { name: /Total no escopo/i }).getAttribute("aria-pressed")).toBe(
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: /Total no escopo/i }));
    expect(onSelect).toHaveBeenCalledWith(null);
  });
});
