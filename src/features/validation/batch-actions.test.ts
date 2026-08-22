import { describe, expect, it } from "vitest";
import type { UnifiedFormCriterion } from "./contracts";
import {
  buildValidationBatchCommand,
  buildValidationBatchSelection,
  isCriterionBatchSelectable,
} from "./batch-actions";

function criterion(
  overrides: Partial<UnifiedFormCriterion> = {},
): UnifiedFormCriterion {
  return {
    responseId: "123e4567-e89b-42d3-a456-426614174001",
    questionPrompt: "Critério",
    sectionId: "123e4567-e89b-42d3-a456-426614174002",
    sectionName: "Seção",
    sectionOrder: 1,
    axisId: "123e4567-e89b-42d3-a456-426614174003",
    axisName: "Eixo",
    orderIndex: 0,
    answer: "yes",
    requiresEvidence: true,
    allowsNotApplicable: false,
    famiEnabled: true,
    respondentNote: null,
    naJustification: null,
    answeredByName: null,
    answeredAt: null,
    evidenceCount: 1,
    evidenceStatus: "pending",
    validationNeed: "pending_admin",
    visualStatus: "awaiting_admin",
    visualStatusLabel: "Aguardando análise",
    awaitsAdminAction: true,
    obtainedPoints: 0,
    possiblePoints: 2,
    includedInCalculation: true,
    recommendationText: null,
    documents: [],
    evidenceGroup: {
      responseId: "123e4567-e89b-42d3-a456-426614174001",
      questionPrompt: "Critério",
      sectionId: "123e4567-e89b-42d3-a456-426614174002",
      sectionName: "Seção",
      sectionOrder: 1,
      axisId: "123e4567-e89b-42d3-a456-426614174003",
      axisName: "Eixo",
      orderIndex: 0,
      answer: "yes",
      respondentNote: null,
      answeredByName: null,
      answeredAt: null,
      allowsNotApplicable: false,
      adminProofObservation: null,
      status: "pending",
      documents: [
        {
          id: "123e4567-e89b-42d3-a456-426614174004",
          responseId: "123e4567-e89b-42d3-a456-426614174001",
          questionPrompt: "Critério",
          sectionId: "123e4567-e89b-42d3-a456-426614174002",
          sectionName: "Seção",
          sectionOrder: 1,
          axisId: "123e4567-e89b-42d3-a456-426614174003",
          axisName: "Eixo",
          orderIndex: 0,
          kind: "file",
          fileName: "evidencia.pdf",
          externalLink: null,
          linkReason: null,
          submittedAt: null,
          status: "pending",
          justification: null,
          validatedAt: null,
          answer: "yes",
          respondentNote: null,
          answeredByName: null,
          answeredAt: null,
        },
      ],
    },
    notApplicableItem: null,
    readonlyView: false,
    ...overrides,
  };
}

describe("ações em lote da validação", () => {
  it("libera somente decisões de evidência para critérios documentais", () => {
    const item = criterion();
    const selection = buildValidationBatchSelection(
      [item],
      new Set([item.responseId]),
    );
    expect(selection.options.map((option) => option.action)).toEqual([
      "approve_evidence",
      "invalidate_evidence",
      "request_adjustment",
    ]);
    expect(
      buildValidationBatchCommand(
        selection,
        "request_adjustment",
        "Complementar o documento.",
      ),
    ).toMatchObject({
      kind: "evidence",
      action: "request_adjustment",
      justification: "Complementar o documento.",
    });
  });


  it("libera somente decisões de N/A para respostas desse tipo", () => {
    const item = criterion({
      answer: "not_applicable",
      evidenceCount: 0,
      documents: [],
      evidenceGroup: null,
      notApplicableItem: {
        id: "123e4567-e89b-42d3-a456-426614174005",
        responseId: "123e4567-e89b-42d3-a456-426614174001",
        questionPrompt: "Critério",
        sectionId: "123e4567-e89b-42d3-a456-426614174002",
        sectionName: "Seção",
        sectionOrder: 1,
        axisId: "123e4567-e89b-42d3-a456-426614174003",
        axisName: "Eixo",
        orderIndex: 0,
        justification: "Não se aplica ao órgão.",
        status: "pending",
        rejectionReason: null,
        validatedAt: null,
      },
    });
    const selection = buildValidationBatchSelection(
      [item],
      new Set([item.responseId]),
    );

    expect(selection.options.map((option) => option.action)).toEqual([
      "approve_not_applicable",
      "reject_not_applicable",
    ]);
  });

  it("não oferece ação quando a seleção mistura tipos incompatíveis", () => {
    const evidenceCriterion = criterion();
    const naCriterion = criterion({
      responseId: "123e4567-e89b-42d3-a456-426614174006",
      answer: "not_applicable",
      evidenceCount: 0,
      documents: [],
      evidenceGroup: null,
      notApplicableItem: {
        id: "123e4567-e89b-42d3-a456-426614174007",
        responseId: "123e4567-e89b-42d3-a456-426614174006",
        questionPrompt: "Outro critério",
        sectionId: "123e4567-e89b-42d3-a456-426614174002",
        sectionName: "Seção",
        sectionOrder: 1,
        axisId: "123e4567-e89b-42d3-a456-426614174003",
        axisName: "Eixo",
        orderIndex: 1,
        justification: "Não se aplica ao órgão.",
        status: "pending",
        rejectionReason: null,
        validatedAt: null,
      },
    });
    const selection = buildValidationBatchSelection(
      [evidenceCriterion, naCriterion],
      new Set([evidenceCriterion.responseId, naCriterion.responseId]),
    );

    expect(selection.options).toEqual([]);
  });

  it("não permite lote para Sim sem documento quando N/A não é elegível", () => {
    const item = criterion({
      evidenceCount: 0,
      documents: [],
      evidenceGroup: {
        ...criterion().evidenceGroup!,
        documents: [],
        status: "not_presented",
      },
    });
    expect(isCriterionBatchSelectable(item)).toBe(false);
  });
});
