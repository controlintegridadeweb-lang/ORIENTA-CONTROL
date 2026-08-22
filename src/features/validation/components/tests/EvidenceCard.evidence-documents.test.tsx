// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeEvidence, makeGroup } from "./EvidenceCard.test-support";

const mocks = vi.hoisted(() => ({ success: vi.fn() }));

vi.mock("@/infrastructure/notifications/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/notifications/notify")>();
  return {
    ...actual,
    notify: { ...actual.notify, success: mocks.success },
  };
});

import { EvidenceCard } from "../EvidenceCard";

describe("EvidenceCard — documentos de evidência", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    mocks.success.mockReset();
  });

  it("confirma o veredito com feedback de sucesso", async () => {
    const onVerdict = vi.fn().mockResolvedValue(undefined);
    render(
      <EvidenceCard
        group={makeGroup([makeEvidence()])}
        onVerdict={onVerdict}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aprovar evidência" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar: Aprovar evidência" }));

    await waitFor(() => expect(onVerdict).toHaveBeenCalledWith("evidence-1", "approve", ""));
    expect(mocks.success).toHaveBeenCalledWith("Evidência aprovada.");
  });

  it("anuncia falha sem confirmar sucesso", async () => {
    const onVerdict = vi.fn().mockRejectedValue(new Error("falha na validação"));
    render(
      <EvidenceCard
        group={makeGroup([makeEvidence()])}
        onVerdict={onVerdict}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aprovar evidência" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar: Aprovar evidência" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("falha na validação");
    expect(mocks.success).not.toHaveBeenCalled();
  });

  it("aplica uma resposta padrão sem bloquear justificativa personalizada", async () => {
    const onVerdict = vi.fn().mockResolvedValue(undefined);
    render(
      <EvidenceCard
        group={makeGroup([makeEvidence()])}
        onVerdict={onVerdict}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Considerar insuficiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Evidência insuficiente" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar: Considerar insuficiente" }));

    await waitFor(() =>
      expect(onVerdict).toHaveBeenCalledWith(
        "evidence-1",
        "invalidate",
        "Evidência insuficiente",
      ),
    );
  });

  it("agrupa vários documentos da mesma resposta em um único container", () => {
    render(
      <EvidenceCard
        group={makeGroup([
          makeEvidence({ id: "evidence-1", fileName: "a.pdf" }),
          makeEvidence({ id: "evidence-2", fileName: "b.pdf" }),
        ])}
        onVerdict={vi.fn()}
      />,
    );

    expect(
      screen.getAllByRole("heading", {
        name: "Existe política de integridade?",
      }),
    ).toHaveLength(1);
    expect(screen.getByText("Comprovações apresentadas (2)")).toBeTruthy();
    expect(screen.getByText("a.pdf")).toBeTruthy();
    expect(screen.getByText("b.pdf")).toBeTruthy();
  });

  it("separa situação do critério e do documento", () => {
    render(
      <EvidenceCard
        group={makeGroup([makeEvidence({ status: "pending" })], {
          status: "pending",
        })}
        onVerdict={vi.fn()}
      />,
    );

    expect(screen.getByText("Aguardando validação")).toBeTruthy();
    expect(screen.getByText("Aguardando análise")).toBeTruthy();
    expect(screen.getAllByText("Aguardando validação")).toHaveLength(1);
  });

  it("exibe Resposta do órgão e decisões da evidência no card do documento", () => {
    render(
      <EvidenceCard
        group={makeGroup([makeEvidence()])}
        onVerdict={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Resposta do órgão" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Comprovações apresentadas (1)" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Estado da análise" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Aguardando validação da evidência"),
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Decisão sobre esta evidência" }),
    ).toBeTruthy();
    expect(
      screen.getByText("Analise a evidência e selecione o resultado da validação."),
    ).toBeTruthy();
  });

  it("delimita cada container com a mesma linha pontilhada", () => {
    render(
      <EvidenceCard
        group={makeGroup([makeEvidence()])}
        onVerdict={vi.fn()}
        onMarkAdminNotApplicable={vi.fn()}
      />,
    );

    const dividers = screen.getAllByTestId("criterion-section-divider");
    expect(dividers).toHaveLength(4);
    for (const divider of dividers) {
      expect(divider.className).toContain("border-dashed");
      expect(divider.getAttribute("role")).toBe("separator");
    }
  });

  it("mantém a mesma hierarquia de seções com e sem documento", () => {
    const { unmount } = render(
      <EvidenceCard
        group={makeGroup([makeEvidence()])}
        onVerdict={vi.fn()}
        onMarkAdminNotApplicable={vi.fn()}
      />,
    );

    const withDocs = screen
      .getAllByRole("heading")
      .map((node) => node.textContent)
      .filter((text) =>
        [
          "Resposta do órgão",
          "Comprovações apresentadas (1)",
          "Estado da análise",
          "Decisão administrativa do critério",
        ].includes(text ?? ""),
      );
    expect(withDocs).toEqual([
      "Resposta do órgão",
      "Comprovações apresentadas (1)",
      "Estado da análise",
      "Decisão administrativa do critério",
    ]);
    unmount();

    render(
      <EvidenceCard
        group={makeGroup([], {
          status: "not_presented",
          answeredByName: "Mauricio",
          answeredAt: "2026-07-28T15:30:00.000Z",
        })}
        onVerdict={vi.fn()}
        onAbsentProofDecision={vi.fn()}
        canRequestProof
      />,
    );

    const withoutDocs = screen
      .getAllByRole("heading")
      .map((node) => node.textContent)
      .filter((text) =>
        [
          "Resposta do órgão",
          "Comprovações apresentadas",
          "Estado da análise",
          "Decisão administrativa do critério",
        ].includes(text ?? ""),
      );
    expect(withoutDocs).toEqual([
      "Resposta do órgão",
      "Comprovações apresentadas",
      "Estado da análise",
      "Decisão administrativa do critério",
    ]);
    expect(screen.getByTestId("criterion-evidence-empty")).toBeTruthy();
  });

  it("não mostra “Não se aplica” dentro do card do documento", () => {
    render(
      <EvidenceCard
        group={makeGroup([makeEvidence()], { allowsNotApplicable: true })}
        onVerdict={vi.fn()}
        onMarkAdminNotApplicable={vi.fn()}
      />,
    );

    const documentCard = document.getElementById("evidence-evidence-1");
    expect(documentCard).toBeTruthy();
    expect(
      within(documentCard as HTMLElement).queryByRole("button", {
        name: /Marcar como “Não se aplica”/i,
      }),
    ).toBeNull();

    const adminSection = screen.getByRole("region", {
      name: /Decisão administrativa do critério/i,
    });
    expect(
      within(adminSection).getByRole("button", {
        name: /Marcar como “Não se aplica”/i,
      }),
    ).toBeTruthy();
    expect(
      within(adminSection).getByText(
        /A resposta original será preservada no histórico/i,
      ),
    ).toBeTruthy();
  });

  it("mantém decisões independentes para múltiplas evidências", () => {
    render(
      <EvidenceCard
        group={makeGroup([
          makeEvidence({ id: "evidence-1", fileName: "a.pdf" }),
          makeEvidence({ id: "evidence-2", fileName: "b.pdf" }),
        ])}
        onVerdict={vi.fn()}
      />,
    );

    const first = document.getElementById("evidence-evidence-1")!;
    const second = document.getElementById("evidence-evidence-2")!;
    expect(
      within(first).getAllByRole("button", { name: "Aprovar evidência" }),
    ).toHaveLength(1);
    expect(
      within(second).getAllByRole("button", { name: "Aprovar evidência" }),
    ).toHaveLength(1);
  });

  it("não usa a URL completa como elemento visual principal do link", () => {
    const longUrl =
      "https://drive.google.com/file/d/abcdefghijklmnopqrstuvwxyz1234567890/view?usp=sharing";
    render(
      <EvidenceCard
        group={makeGroup([
          makeEvidence({
            id: "evidence-link",
            kind: "link",
            fileName: null,
            externalLink: longUrl,
          }),
        ])}
        onVerdict={vi.fn()}
      />,
    );

    expect(screen.getByText("Google Drive")).toBeTruthy();
    expect(screen.getByRole("link", { name: /Abrir evidência/i })).toBeTruthy();
    expect(screen.queryByText(longUrl)).toBeNull();
    const openLink = screen.getByRole("link", { name: /Abrir evidência/i });
    expect(openLink.getAttribute("title")).toBe(longUrl);
  });
});
