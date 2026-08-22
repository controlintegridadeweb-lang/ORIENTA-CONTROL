// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EvidencesKpiCards } from "./evidences-kpi-cards";

const mocks = vi.hoisted(() => ({
  getEvidenceStats: vi.fn(),
}));

vi.mock("@/features/evidences/client", () => ({
  getEvidenceStats: mocks.getEvidenceStats,
}));

describe("EvidencesKpiCards", () => {
  afterEach(() => cleanup());

  beforeEach(() => {
    mocks.getEvidenceStats.mockReset();
    mocks.getEvidenceStats.mockResolvedValue({
      total: 10,
      aguardando_envio: 0,
      aguardando_validacao: 4,
      ajuste_solicitado: 2,
      aprovadas: 3,
      nao_aprovadas: 1,
    });
  });

  it("não exibe o indicador Aguardando envio e mostra os quatro estados pós-envio", async () => {
    render(<EvidencesKpiCards filters={{}} />);

    expect(await screen.findByText("Aguardando validação")).toBeTruthy();
    expect(screen.getByText("Ajuste solicitado")).toBeTruthy();
    expect(screen.getByText("Aprovadas")).toBeTruthy();
    expect(screen.getByText("Não aprovadas")).toBeTruthy();
    expect(screen.queryByText("Aguardando envio")).toBeNull();
  });

  it("filtra a lista ao clicar em um indicador pós-envio", async () => {
    const onSelectStatus = vi.fn();
    render(<EvidencesKpiCards filters={{}} onSelectStatus={onSelectStatus} />);

    await screen.findByText("Aguardando validação");
    fireEvent.click(screen.getByText("Aguardando validação"));

    expect(onSelectStatus).toHaveBeenCalledWith("submitted");
    expect(onSelectStatus).not.toHaveBeenCalledWith("pending");
  });
});
