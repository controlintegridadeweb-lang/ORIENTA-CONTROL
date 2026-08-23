// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ActionPlanAction } from "@/features/improvement-management/action-plans/domain-model";
import { ActionPlanEvidenceManager } from "./action-plan-evidence-manager";

const addLink = vi.fn();

vi.mock("@/features/improvement-management/action-plans/client", () => ({
  addActionPlanDocumentFile: vi.fn(),
  addActionPlanDocumentLink: (...args: unknown[]) => addLink(...args),
  removeActionPlanDocument: vi.fn(),
}));

vi.mock("@/infrastructure/notifications/notify", () => ({
  describeError: (cause: unknown, fallback: string) =>
    cause instanceof Error ? cause.message : fallback,
  notify: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  cleanup();
  addLink.mockReset();
});

function plan(): ActionPlanAction {
  return {
    id: "plan-1",
    actionText: "Publicar o calendario",
    startDate: "2026-08-11",
    dueDate: "2026-09-10",
    responsibleSector: "TI",
    responsibleUserId: "55555555-5555-4555-8555-555555555555",
    responsibleName: "Alice",
    progressPercentage: 100,
    status: "completed",
    observations: null,
    updatedAt: "2026-08-11T00:00:00Z",
    revision: 1,
    documents: [],
    slaLabel: "ok",
  };
}

describe("ActionPlanEvidenceManager", () => {
  it("reseta o formulario depois do POST sem abortar o refetch", async () => {
    let resolveLink!: () => void;
    addLink.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveLink = resolve;
      }),
    );
    const onChanged = vi.fn(async () => undefined);
    render(<ActionPlanEvidenceManager plan={plan()} onChanged={onChanged} />);

    fireEvent.click(screen.getByRole("button", { name: "Link HTTPS" }));
    fireEvent.change(screen.getByLabelText("Título da comprovação"), {
      target: { value: "Ata publicada" },
    });
    fireEvent.change(screen.getByLabelText("Endereço HTTPS"), {
      target: { value: "https://example.gov.br/orienta/e2e/1" },
    });

    const form = document.querySelector("form");
    if (!(form instanceof HTMLFormElement)) {
      throw new Error("Formulario de comprovacao nao encontrado.");
    }
    fireEvent.submit(form);

    await waitFor(() => expect(addLink).toHaveBeenCalled());
    resolveLink();

    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByLabelText("Título da comprovação") as HTMLInputElement).value).toBe("");
  });
});
