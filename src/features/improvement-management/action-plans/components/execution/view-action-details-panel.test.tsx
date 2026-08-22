// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionPlanAction, ActionPlanDocument } from "@/features/improvement-management/action-plans/domain-model";
import type { ActionPlanProgressUpdate } from "@/features/improvement-management/action-plans/types";
import {
  ActionPlanProgressUpdatesList,
  evidenceCountLabel,
  ViewActionDetailsPanel,
} from "./view-action-details-panel";

vi.mock("@/features/improvement-management/action-plans/client", () => ({
  listActionPlanProgressUpdates: vi.fn(async () => []),
  listRespondentActionPlanProgressUpdates: vi.fn(async () => []),
}));

afterEach(() => {
  cleanup();
});

function document(over: Partial<ActionPlanDocument> = {}): ActionPlanDocument {
  return {
    id: over.id ?? "doc-1",
    actionRevision: over.actionRevision ?? 1,
    kind: over.kind ?? "file",
    title: over.title ?? "Comprovante",
    externalLink: over.externalLink ?? null,
    originalFilename: over.originalFilename ?? "arquivo.pdf",
    mimeType: over.mimeType ?? "application/pdf",
    sizeBytes: over.sizeBytes ?? 1024,
    fileValidationStatus: over.fileValidationStatus ?? "valid",
    validatedAt: over.validatedAt ?? "2026-08-11T00:00:00Z",
    createdAt: over.createdAt ?? "2026-08-11T00:00:00Z",
    isCurrentRevision: over.isCurrentRevision ?? true,
  };
}

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
    observations: null,
    updatedAt: "2026-08-11T00:00:00Z",
    revision: 1,
    documents: [],
    slaLabel: "ok",
    ...over,
  };
}

describe("evidenceCountLabel", () => {
  it("conta só comprovações da revisão atual", () => {
    expect(evidenceCountLabel(plan({ documents: [] }))).toBe(
      "Nenhuma comprovação da execução na revisão atual.",
    );
    expect(
      evidenceCountLabel(
        plan({
          documents: [document({ id: "current", isCurrentRevision: true })],
        }),
      ),
    ).toBe("1 comprovação da execução na revisão atual.");
    expect(
      evidenceCountLabel(
        plan({
          documents: [
            document({ id: "current-a", isCurrentRevision: true }),
            document({ id: "current-b", isCurrentRevision: true }),
            document({ id: "archived", isCurrentRevision: false }),
          ],
        }),
      ),
    ).toBe("2 comprovações da execução na revisão atual.");
  });
});

describe("ViewActionDetailsPanel", () => {
  it("mostra a ação em tabela institucional, sem campos de formulário", async () => {
    render(
      <ViewActionDetailsPanel
        plan={plan({
          observations: "Capacitação iniciada com a equipe de transparência.",
          documents: [document()],
        })}
        role="respondent"
        onClose={() => undefined}
      />,
    );

    expect(screen.getByRole("heading", { name: "Visualizar ação" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Ação" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Responsável" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Início" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Final" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Situação" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Progresso" })).toBeTruthy();
    expect(screen.getByText("Publicar o calendário de capacitação")).toBeTruthy();
    expect(screen.getByText("Em andamento")).toBeTruthy();
    expect(screen.getByText("40%")).toBeTruthy();
    expect(screen.getByText("Alice")).toBeTruthy();
    expect(screen.queryByText("Ação ou compromisso")).toBeNull();
    expect(screen.queryByText("Área responsável")).toBeNull();
    expect(screen.queryByText("Respondente responsável")).toBeNull();
    expect(screen.getByText(/Última atualização:/)).toBeTruthy();
    expect(
      screen.getByText("Capacitação iniciada com a equipe de transparência."),
    ).toBeTruthy();
    expect(screen.getByText("1 comprovação da execução na revisão atual.")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Histórico da ação" })).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByText("Nenhuma movimentação registrada.")).toBeTruthy();
    });
  });

  it("usa a área responsável quando não há respondente", () => {
    render(
      <ViewActionDetailsPanel
        plan={plan({ responsibleName: "  ", responsibleSector: "TI" })}
        role="respondent"
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText("TI")).toBeTruthy();
  });

  it("mantém 0% como valor informado", () => {
    render(
      <ViewActionDetailsPanel
        plan={plan({ progressPercentage: 0, status: "not_started" })}
        role="respondent"
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText("0%")).toBeTruthy();
    expect(screen.getByText("Não iniciado")).toBeTruthy();
  });

  it("marca ação atrasada e omite observações vazias", () => {
    render(
      <ViewActionDetailsPanel
        plan={plan({ dueDate: "2000-01-01", observations: "   " })}
        role="respondent"
        onClose={() => undefined}
      />,
    );

    expect(screen.getByText("Atrasada")).toBeTruthy();
    expect(screen.queryByText("Observações")).toBeNull();
  });

  it("fecha a visualização", () => {
    const onClose = vi.fn();
    render(<ViewActionDetailsPanel plan={plan()} role="respondent" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "fechar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("ActionPlanProgressUpdatesList", () => {
  it("mostra a movimentação real em tabela, sem repetir comprovação", () => {
    const item: ActionPlanProgressUpdate = {
      id: "upd-1",
      previousPercentage: 0,
      newPercentage: 15,
      previousStatus: "not_started",
      newStatus: "in_progress",
      description: "Capacitação iniciada com a equipe.",
      createdAt: "2026-08-13T12:00:00Z",
      createdByName: "Flávio Henrique dos Santos Lima",
    };

    render(<ActionPlanProgressUpdatesList items={[item]} />);

    expect(screen.getByRole("columnheader", { name: "Data" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Situação" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "Atualização" })).toBeTruthy();
    expect(screen.getByText("13/08/2026")).toBeTruthy();
    expect(screen.getByText("Em andamento")).toBeTruthy();
    expect(screen.getByText("Capacitação iniciada com a equipe.")).toBeTruthy();
    expect(screen.getByText("Flávio Henrique dos Santos Lima")).toBeTruthy();
    expect(screen.queryByText("0% → 15% · Não iniciado → Em andamento")).toBeNull();
    expect(screen.queryByText(/comprovação da execução/)).toBeNull();
  });

  it("descreve progresso sem descrição e informa ausência de movimentação", () => {
    const item: ActionPlanProgressUpdate = {
      id: "upd-2",
      previousPercentage: 3,
      newPercentage: 9,
      previousStatus: "in_progress",
      newStatus: "in_progress",
      description: null,
      createdAt: "2026-08-11T15:27:00Z",
      createdByName: "Alice",
    };

    const { rerender } = render(<ActionPlanProgressUpdatesList items={[item]} />);
    expect(screen.getByText("Progresso atualizado para 9%")).toBeTruthy();

    rerender(<ActionPlanProgressUpdatesList items={[]} />);
    expect(screen.getByText("Nenhuma movimentação registrada.")).toBeTruthy();
  });
});
