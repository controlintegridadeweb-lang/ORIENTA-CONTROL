// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { ActionPlanActionList } from "./action-plan-action-list";

afterEach(() => {
  cleanup();
});

vi.mock("./update-action-progress-form", () => ({
  UpdateActionProgressForm: () => <div>Formulário de andamento</div>,
}));

vi.mock("./edit-action-details-form", () => ({
  EditActionDetailsForm: () => <div>Formulário de dados</div>,
}));

vi.mock("./request-deadline-change-form", () => ({
  RequestDeadlineChangeForm: () => <div>Formulário de final</div>,
}));

vi.mock("@/features/improvement-management/recommendations/components/hub/action-plan-evidence-manager", () => ({
  ActionPlanEvidenceManager: () => <div>Gerenciador de comprovantes</div>,
}));

vi.mock("@/features/improvement-management/action-plans/client", () => ({
  listActionPlanProgressUpdates: vi.fn(async () => []),
  listRespondentActionPlanProgressUpdates: vi.fn(async () => []),
}));

function plan(over: Partial<ActionPlanAction> = {}): ActionPlanAction {
  return {
    id: "plan-1",
    actionText: "Publicar o calendário de capacitação",
    startDate: "2026-08-11",
    dueDate: "2026-09-10",
    responsibleSector: "TI",
    responsibleUserId: "55555555-5555-4555-8555-555555555555",
    responsibleName: "Alice",
    progressPercentage: 40,
    status: "in_progress",
    observations: "Capacitação iniciada.",
    updatedAt: "2026-08-11T00:00:00Z",
    revision: 1,
    documents: [],
    slaLabel: "ok",
    ...over,
  };
}

const listProps = {
  recommendationId: "rec-1",
  deletingId: null,
  responsibleMembers: [],
  responsibleMembersLoading: false,
  responsibleMembersError: null,
  onCancelAction: () => undefined,
  onDelete: () => undefined,
  onRetryResponsibleMembers: () => undefined,
  onSaved: async () => undefined,
  onEvidenceChanged: async () => undefined,
};

describe("ActionPlanActionList", () => {
  it.each(["respondent", "admin"] as const)(
    "oferece Visualizar no menu para o perfil %s",
    (role) => {
      render(
        <ActionPlanActionList
          {...listProps}
          plans={[plan()]}
          role={role}
          panel={{ kind: "none" }}
          onPanelChange={() => undefined}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: /Opções da ação/ }));
      expect(screen.getByRole("menuitem", { name: "Visualizar" })).toBeTruthy();
    },
  );

  it("abre a leitura completa da ação", () => {
    const onPanelChange = vi.fn();
    const { rerender } = render(
      <ActionPlanActionList
        {...listProps}
        plans={[plan()]}
        role="admin"
        panel={{ kind: "none" }}
        onPanelChange={onPanelChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Opções da ação/ }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Visualizar" }));
    expect(onPanelChange).toHaveBeenCalledWith({ kind: "view", planId: "plan-1" });

    rerender(
      <ActionPlanActionList
        {...listProps}
        plans={[plan()]}
        role="admin"
        panel={{ kind: "view", planId: "plan-1" }}
        onPanelChange={onPanelChange}
      />,
    );

    expect(screen.getByRole("heading", { name: "Visualizar ação" })).toBeTruthy();
    expect(screen.getByText("Capacitação iniciada.")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
  });
});
