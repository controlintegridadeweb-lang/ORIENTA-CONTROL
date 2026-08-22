// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RespondentSectionNavigation } from "./respondent-section-navigation";

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockReset();
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: scrollIntoView,
  });
});

describe("RespondentSectionNavigation", () => {
  it("mantém a seção ativa visível na faixa horizontal", () => {
    render(
      <RespondentSectionNavigation
        sections={[
          { name: "Seção inicial", rows: [] },
          { name: "Seção ativa", rows: [] },
        ]}
        currentSectionIndex={1}
        evidenceDrafts={{}}
        onSelect={vi.fn()}
      />,
    );

    expect(scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  });
  it("mostra as correções pendentes por seção", () => {
    render(
      <RespondentSectionNavigation
        sections={[
          {
            name: "Seção sem pendência",
            rows: [
              {
                questionId: "q1",
                prompt: "Pergunta 1",
                requiresEvidence: true,
                famiEnabled: true,
                recommendationText: "",
                axisName: "Governança",
                sectionName: "Seção sem pendência",
                responseId: "r1",
                answer: "yes",
                notes: null,
                isNotApplicable: false,
                naJustification: null,
                naValidationStatus: null,
                naRejectionReason: null,
                evidenceId: "e1",
                evidenceTitle: "Documento",
                evidenceDescription: null,
                externalLink: null,
                storagePath: "arquivo.pdf",
                validationStatus: "approved",
                validationJustification: null,
                unresolvedAdjustmentRequestCount: 0,
              },
            ],
          },
          {
            name: "Seção com pendência",
            rows: [
              {
                questionId: "q2",
                prompt: "Pergunta 2",
                requiresEvidence: true,
                famiEnabled: true,
                recommendationText: "",
                axisName: "Governança",
                sectionName: "Seção com pendência",
                responseId: "r2",
                answer: "yes",
                notes: null,
                isNotApplicable: false,
                naJustification: null,
                naValidationStatus: null,
                naRejectionReason: null,
                evidenceId: "e2",
                evidenceTitle: "Documento",
                evidenceDescription: null,
                externalLink: null,
                storagePath: "arquivo.pdf",
                validationStatus: "adjustment_requested",
                validationJustification: "Atualize o documento.",
                unresolvedAdjustmentRequestCount: 2,
              },
            ],
          },
        ]}
        currentSectionIndex={1}
        evidenceDrafts={{}}
        adjustmentMode
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByText("Sem correções pendentes").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2 correções pendentes").length).toBeGreaterThan(0);
  });

});
