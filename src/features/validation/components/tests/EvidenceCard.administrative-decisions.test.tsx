// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueueEvidenceGroup } from "@/features/validation/queue-model";
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

describe("EvidenceCard — decisões administrativas", () => {
  afterEach(() => cleanup());
  beforeEach(() => {
    mocks.success.mockReset();
  });

  it("apresenta Sim sem documento sem selo de rejeição automática", () => {
    const group: QueueEvidenceGroup = {
      responseId: "response-empty",
      questionPrompt: "Existem canais formais para consulta ética?",
      sectionId: "section-etica",
      sectionName: "Gestão da Ética",
      sectionOrder: 5,
      axisId: "axis-gov",
      axisName: "Governança",
      orderIndex: 41,
      answer: "yes",
      respondentNote: "corregedoriasetorial.fundase@gmail.com",
      answeredByName: "Respondente",
      answeredAt: "2026-07-28T15:30:00.000Z",
      allowsNotApplicable: false,
      adminProofObservation: null,
      status: "not_presented",
      documents: [],
    };
    render(
      <EvidenceCard
        group={group}
        onVerdict={vi.fn()}
        onAbsentProofDecision={vi.fn()}
        canRequestProof
      />,
    );
    expect(
      screen.getByRole("button", { name: "Validar sem comprovação" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", {
        name: "Considerar o critério insuficiente",
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Solicitar comprovação" }),
    ).toBeTruthy();

    expect(screen.getByText("Aguardando comprovação")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Resposta do órgão" })).toBeTruthy();
    expect(screen.getByText("Resposta registrada")).toBeTruthy();
    expect(screen.getByText("Sim")).toBeTruthy();
    expect(screen.getByText("Informação complementar")).toBeTruthy();
    expect(
      screen.getByText("corregedoriasetorial.fundase@gmail.com"),
    ).toBeTruthy();

    const response = screen.getByRole("region", { name: "Resposta do órgão" });
    expect(within(response).queryByText(/não apresentada/i)).toBeNull();
    expect(
      within(response).queryByText(/Comprovações apresentadas/i),
    ).toBeNull();

    expect(
      screen.getByRole("heading", { name: "Comprovações apresentadas" }),
    ).toBeTruthy();
    expect(screen.getByTestId("criterion-evidence-empty")).toBeTruthy();
    expect(screen.getByText("Nenhuma comprovação")).toBeTruthy();
    expect(screen.getByText("Não apresentada")).toBeTruthy();

    const analysis = screen.getByTestId("criterion-analysis-state");
    expect(analysis.textContent).toContain("Resposta positiva sem comprovação");
    expect(
      screen.getByRole("heading", { name: "Estado da análise" }),
    ).toBeTruthy();

    const adminSection = screen.getByRole("region", {
      name: /Decisão administrativa do critério/i,
    });
    expect(
      within(adminSection).getByRole("button", {
        name: "Validar sem comprovação",
      }),
    ).toBeTruthy();
    expect(screen.queryByText("Evidência não apresentada")).toBeNull();
    expect(screen.queryByText("Evidências apresentadas (0)")).toBeNull();
  });

  it("considera insuficiente Sim sem documento com justificativa obrigatória", async () => {
    const onAbsentProofDecision = vi.fn().mockResolvedValue(undefined);
    const group: QueueEvidenceGroup = {
      responseId: "response-empty",
      questionPrompt: "Existem canais formais para consulta ética?",
      sectionId: "section-etica",
      sectionName: "Gestão da Ética",
      sectionOrder: 5,
      axisId: "axis-gov",
      axisName: "Governança",
      orderIndex: 41,
      answer: "yes",
      respondentNote: "e-mail institucional",
      answeredByName: "Respondente",
      answeredAt: "2026-07-28T15:30:00.000Z",
      allowsNotApplicable: false,
      adminProofObservation: null,
      status: "not_presented",
      documents: [],
    };
    render(
      <EvidenceCard
        group={group}
        onVerdict={vi.fn()}
        onAbsentProofDecision={onAbsentProofDecision}
        canRequestProof
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Considerar o critério insuficiente",
      }),
    );
    const confirm = screen.getByRole("button", {
      name: "Confirmar: Considerar o critério insuficiente",
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "A informação complementar não comprova o critério." },
    });
    fireEvent.click(confirm);

    await waitFor(() =>
      expect(onAbsentProofDecision).toHaveBeenCalledWith(
        "response-empty",
        "consider_insufficient",
        "A informação complementar não comprova o critério.",
      ),
    );
    expect(mocks.success).toHaveBeenCalledWith(
      "Critério marcado como insuficiente.",
    );
  });

  it("não oferece “Não se aplica” quando o critério não é elegível", () => {
    render(
      <EvidenceCard
        group={makeGroup([makeEvidence()], { allowsNotApplicable: false })}
        onVerdict={vi.fn()}
        onMarkAdminNotApplicable={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("button", { name: /Marcar como “Não se aplica”/i }),
    ).toBeNull();
  });

  it("em critério elegível sem documento, N/A fica na seção administrativa do critério", () => {
    render(
      <EvidenceCard
        group={makeGroup(
          [
            makeEvidence({
              id: "absent:response-empty",
              responseId: "response-empty",
              absentEvidence: true,
              fileName: null,
              status: "not_presented",
              allowsNotApplicable: true,
            }),
          ],
          {
            documents: [],
            status: "not_presented",
            allowsNotApplicable: true,
          },
        )}
        onVerdict={vi.fn()}
        onAbsentProofDecision={vi.fn()}
        onMarkAdminNotApplicable={vi.fn()}
        canRequestProof
      />,
    );

    const adminSection = screen.getByRole("region", {
      name: /Decisão administrativa do critério/i,
    });
    expect(
      within(adminSection).getByRole("button", {
        name: /Validar sem comprovação/i,
      }),
    ).toBeTruthy();
    expect(
      within(adminSection).getByRole("button", {
        name: /Considerar o critério insuficiente/i,
      }),
    ).toBeTruthy();
    expect(
      within(adminSection).getByRole("button", {
        name: /Solicitar comprovação/i,
      }),
    ).toBeTruthy();
    expect(
      within(adminSection).getByRole("button", {
        name: /Marcar como “Não se aplica”/i,
      }),
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Aprovar evidência" }),
    ).toBeNull();
    expect(
      screen.queryByText(/Critério elegível a classificação administrativa/i),
    ).toBeNull();
  });

  it("marca critério elegível como “Não se aplica” com justificativa obrigatória", async () => {
    const onMarkAdminNotApplicable = vi.fn().mockResolvedValue(undefined);
    render(
      <EvidenceCard
        group={makeGroup([makeEvidence({ id: "evidence-1", answer: "yes" })], {
          allowsNotApplicable: true,
        })}
        onVerdict={vi.fn()}
        onMarkAdminNotApplicable={onMarkAdminNotApplicable}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: /Marcar como “Não se aplica”/i }),
    );
    expect(
      screen.getByRole("heading", { name: /Confirmar “Não se aplica”/i }),
    ).toBeTruthy();
    expect(
      screen.getByText(/Critério elegível a classificação administrativa/i),
    ).toBeTruthy();
    expect(
      screen.getByText(/A resposta “Sim” permanece registrada/i),
    ).toBeTruthy();
    expect(
      screen.getAllByText("Existe política de integridade?").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Resposta original")).toBeTruthy();
    expect(screen.getAllByText("Comprovações apresentadas").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText("politica.pdf").length).toBeGreaterThan(0);

    const confirmButton = screen.getByRole("button", {
      name: /Confirmar como não se aplica/i,
    });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "   " },
    });
    expect((confirmButton as HTMLButtonElement).disabled).toBe(true);
    expect(onMarkAdminNotApplicable).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "O órgão não possui atribuição legal para o critério." },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar como não se aplica/i }),
    );

    await waitFor(() =>
      expect(onMarkAdminNotApplicable).toHaveBeenCalledWith(
        "response-1",
        "O órgão não possui atribuição legal para o critério.",
      ),
    );
    expect(mocks.success).toHaveBeenCalledWith(
      "Critério classificado como “Não se aplica”.",
    );
  });
});
