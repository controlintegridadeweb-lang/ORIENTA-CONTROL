// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { ActionPlanMonitoringDashboard } from "./action-plan-monitoring-dashboard";

afterEach(() => {
  cleanup();
});

function action(over: Partial<ActionPlanAction> = {}): ActionPlanAction {
  return {
    id: "plan-1",
    actionText: "Publicar informações no portal institucional",
    startDate: "2026-04-01",
    dueDate: "2026-09-30",
    responsibleSector: "UCI",
    responsibleUserId: "user-1",
    responsibleName: "Unidade X",
    progressPercentage: 12,
    status: "in_progress",
    observations: null,
    updatedAt: "2026-08-12T12:00:00.000Z",
    revision: 1,
    documents: [],
    slaLabel: "ok",
    ...over,
  };
}

describe("ActionPlanMonitoringDashboard", () => {
  it("mostra os gráficos de situação, execução e progresso por ação", () => {
    render(
      <ActionPlanMonitoringDashboard
        description="Painel da seção."
        items={[
          { action: action(), label: "A1" },
          {
            action: action({
              id: "plan-2",
              actionText: "Capacitar a equipe",
              progressPercentage: 0,
              status: "not_started",
              slaLabel: "overdue",
            }),
            label: "A2",
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Monitoramento" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Situação das ações" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Execução média" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Progresso por ação" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Situação das ações" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Execução média de 6 por cento" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Progresso por ação" })).toBeTruthy();
    expect(screen.queryByText("execução média")).toBeNull();
    expect(screen.getByText("1 ação em atraso")).toBeTruthy();
  });
});
