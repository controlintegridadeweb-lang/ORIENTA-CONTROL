// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AsyncErrorState } from "./async-error-state";

describe("AsyncErrorState", () => {
  it("anuncia a falha e permite tentar novamente", () => {
    const onRetry = vi.fn();

    render(
      <AsyncErrorState
        message="A conexão foi interrompida."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain("A conexão foi interrompida.");
    fireEvent.click(screen.getByRole("button", { name: "Tentar novamente" }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("expõe o estado de nova tentativa no botão", () => {
    render(
      <AsyncErrorState
        message="Falha temporária."
        onRetry={vi.fn()}
        retrying
      />,
    );

    const button = screen.getByRole("button", { name: "Tentando novamente…" });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(button.getAttribute("aria-busy")).toBe("true");
  });
});
