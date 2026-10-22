// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CycleAnswersDownloadButton } from "./cycle-answers-download-button";

const downloadHttpAttachment = vi.hoisted(() => vi.fn());

vi.mock("@/shared/export/download-http-attachment", () => ({
  downloadHttpAttachment,
}));

describe("CycleAnswersDownloadButton", () => {
  afterEach(() => {
    cleanup();
    downloadHttpAttachment.mockReset();
  });

  it("baixa a planilha do diagnóstico", async () => {
    downloadHttpAttachment.mockResolvedValue(undefined);

    render(<CycleAnswersDownloadButton cycleId="cycle-1" />);
    fireEvent.click(screen.getByRole("button", { name: /baixar respostas/i }));

    expect(await screen.findByRole("button", { name: /baixar respostas/i })).toBeTruthy();
    expect(downloadHttpAttachment).toHaveBeenCalledWith(
      "/api/cycles/cycle-1/answers/export",
      "respostas.xlsx",
    );
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("mostra o erro da API na própria tela", async () => {
    downloadHttpAttachment.mockRejectedValue(new Error("Diagnóstico não encontrado."));

    render(<CycleAnswersDownloadButton cycleId="cycle-1" />);
    fireEvent.click(screen.getByRole("button", { name: /baixar respostas/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("Diagnóstico não encontrado.");
  });
});
