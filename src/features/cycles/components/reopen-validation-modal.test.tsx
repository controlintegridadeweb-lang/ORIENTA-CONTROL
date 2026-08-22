// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReopenValidationModal } from "./reopen-validation-modal";

afterEach(() => {
  cleanup();
});

describe("ReopenValidationModal", () => {
  it("não mostra erro antes da tentativa de confirmação", () => {
    render(
      <ReopenValidationModal
        open
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(screen.getByLabelText(/Motivo da reabertura/), {
      target: { value: "curto" },
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("exige motivo com pelo menos 10 caracteres ao confirmar", async () => {
    const onConfirm = vi.fn();
    render(
      <ReopenValidationModal open onClose={vi.fn()} onConfirm={onConfirm} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reabrir validação" }));
    expect(screen.getByRole("alert").textContent).toMatch(/10 caracteres/i);
    expect(onConfirm).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Motivo da reabertura/), {
      target: { value: "Motivo suficiente para reabrir." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Reabrir validação" }));

    expect(onConfirm).toHaveBeenCalledWith("Motivo suficiente para reabrir.");
  });
});
