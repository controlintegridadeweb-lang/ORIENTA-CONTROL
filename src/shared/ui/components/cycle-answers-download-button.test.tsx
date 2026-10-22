// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CycleAnswersDownloadButton } from "./cycle-answers-download-button";

describe("CycleAnswersDownloadButton", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("baixa a planilha do diagnóstico", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(new Blob(["xlsx"]), {
          status: 200,
          headers: { "Content-Disposition": 'attachment; filename="respostas-org.xlsx"' },
        }),
      ),
    );
    const downloads: string[] = [];
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:respostas");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function mockClick(this: HTMLAnchorElement) {
      downloads.push(this.download);
    });

    render(<CycleAnswersDownloadButton cycleId="cycle-1" />);
    fireEvent.click(screen.getByRole("button", { name: /baixar respostas/i }));

    await waitFor(() => expect(downloads).toEqual(["respostas-org.xlsx"]));
    expect(vi.mocked(fetch).mock.calls[0]?.[0]).toBe("/api/cycles/cycle-1/answers/export");
  });

  it("mostra o erro da API na própria tela", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ error: "Diagnóstico não encontrado." }), { status: 404 }),
      ),
    );

    render(<CycleAnswersDownloadButton cycleId="cycle-1" />);
    fireEvent.click(screen.getByRole("button", { name: /baixar respostas/i }));

    expect((await screen.findByRole("alert")).textContent).toContain("Diagnóstico não encontrado.");
  });
});
