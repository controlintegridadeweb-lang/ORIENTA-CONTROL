// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { QueueEvidenceGroup } from "../queue-model";
import {
  CriterionAdministrativeDecisionSection,
  CriterionAnalysisState,
  CriterionEvidenceEmptyState,
  CriterionEvidenceSection,
  CriterionHeader,
  CriterionResponseSection,
  resolveCriterionAnalysisState,
} from "./criterion-card-sections";

afterEach(() => cleanup());

function makeGroup(
  over: Partial<QueueEvidenceGroup> = {},
): QueueEvidenceGroup {
  return {
    responseId: "response-1",
    questionPrompt: "Existe política de integridade?",
    sectionId: "section-1",
    sectionName: "Integridade",
    sectionOrder: 0,
    axisId: "axis-1",
    axisName: "Governança",
    orderIndex: 2,
    answer: "yes",
    respondentNote: "Observação do órgão",
    answeredByName: "Mauricio",
    answeredAt: "2026-07-28T15:30:00.000Z",
    allowsNotApplicable: false,
    adminProofObservation: null,
    status: "pending",
    documents: [],
    ...over,
  };
}

describe("resolveCriterionAnalysisState", () => {
  it("distingue ausência de comprovação e aguardo de validação documental", () => {
    expect(
      resolveCriterionAnalysisState(
        makeGroup({ status: "not_presented", documents: [] }),
      ).title,
    ).toBe("Resposta positiva sem comprovação");

    expect(
      resolveCriterionAnalysisState(
        makeGroup({
          status: "pending",
          documents: [
            {
              id: "e1",
              responseId: "response-1",
              questionPrompt: "Q",
              sectionId: "s",
              sectionName: "S",
              sectionOrder: 0,
              axisId: "a",
              axisName: "A",
              orderIndex: 0,
              kind: "file",
              fileName: "a.pdf",
              externalLink: null,
              linkReason: null,
              submittedAt: null,
              status: "pending",
              justification: null,
              answer: "yes",
              respondentNote: null,
              answeredByName: null,
              answeredAt: null,
            },
          ],
        }),
      ).title,
    ).toBe("Aguardando validação da evidência");
  });
});

describe("seções do card de critério", () => {
  it("mantém hierarquia estável e empty state estruturado sem documento", () => {
    const group = makeGroup({ status: "not_presented", documents: [] });
    render(
      <article>
        <CriterionHeader group={group} />
        <CriterionResponseSection group={group} />
        <CriterionEvidenceSection responseId={group.responseId} evidenceCount={0}>
          <CriterionEvidenceEmptyState />
        </CriterionEvidenceSection>
        <CriterionAnalysisState group={group} />
        <CriterionAdministrativeDecisionSection responseId={group.responseId}>
          <button type="button">Validar sem comprovação</button>
        </CriterionAdministrativeDecisionSection>
      </article>,
    );

    const headings = screen.getAllByRole("heading").map((node) => node.textContent);
    expect(headings).toEqual([
      "Existe política de integridade?",
      "Resposta do órgão",
      "Comprovações apresentadas",
      "Estado da análise",
      "Decisão administrativa do critério",
    ]);

    const response = screen.getByRole("region", { name: "Resposta do órgão" });
    expect(within(response).queryByText(/não apresentada/i)).toBeNull();
    expect(within(response).queryByText(/Comprovações apresentadas/i)).toBeNull();

    expect(screen.getByTestId("criterion-evidence-empty")).toBeTruthy();
    expect(screen.getByText("Nenhuma comprovação")).toBeTruthy();
    expect(screen.getByTestId("criterion-analysis-state")).toBeTruthy();
    expect(screen.getByText("Resposta positiva sem comprovação")).toBeTruthy();
  });

  it("usa o mesmo título de comprovação com contagem quando há evidência", () => {
    render(
      <CriterionEvidenceSection responseId="response-1" evidenceCount={2}>
        <div>documento</div>
      </CriterionEvidenceSection>,
    );
    expect(
      screen.getByRole("heading", { name: "Comprovações apresentadas (2)" }),
    ).toBeTruthy();
  });
});
