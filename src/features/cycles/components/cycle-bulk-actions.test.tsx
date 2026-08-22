// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CycleBulkActions } from "./cycle-bulk-actions";

describe("CycleBulkActions", () => {
  afterEach(() => cleanup());

  it("separa diagnósticos em validação dos realmente prontos para concluir", () => {
    const onSelect = vi.fn();

    render(
      <CycleBulkActions
        visibleCount={15}
        validationCount={12}
        finalizationCount={7}
        closingCount={2}
        reportsCount={1}
        pendingAction={null}
        pendingCount={0}
        running={false}
        result={null}
        onSelect={onSelect}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(
      screen.getByText("Em validação:").closest("div")?.querySelector("dd")?.textContent,
    ).toBe("12");
    expect(
      screen
        .getByText("Prontos para concluir:")
        .closest("div")
        ?.querySelector("dd")?.textContent,
    ).toBe("7");

    fireEvent.click(
      screen.getByRole("button", { name: "Concluir validações prontas (7)" }),
    );
    expect(onSelect).toHaveBeenCalledWith("finalize_validation");
  });

  it("bloqueia a conclusão em lote quando nenhuma validação está pronta", () => {
    render(
      <CycleBulkActions
        visibleCount={4}
        validationCount={4}
        finalizationCount={0}
        closingCount={0}
        reportsCount={0}
        pendingAction={null}
        pendingCount={0}
        running={false}
        result={null}
        onSelect={vi.fn()}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    const button = screen.getByRole("button", {
      name: "Concluir validações prontas (0)",
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
