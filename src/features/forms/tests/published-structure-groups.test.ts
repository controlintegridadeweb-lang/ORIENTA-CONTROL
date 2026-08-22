import { describe, expect, it } from "vitest";
import {
  groupPublishedQuestions,
  paginatePublishedQuestions,
  parsePublishedStructurePage,
  parsePublishedStructurePageSize,
} from "../published-structure-groups";
import type { PublishedFormQuestion } from "../published-structure-types";

function question(
  overrides: Partial<PublishedFormQuestion> &
    Pick<PublishedFormQuestion, "questionId" | "orderIndex" | "axisName" | "sectionName" | "prompt">,
): PublishedFormQuestion {
  return {
    questionVersion: 1,
    evidenceRequired: false,
    famiEnabled: true,
    appliesToRespondent: true,
    sectionId: "sec-1",
    sectionOrder: 1,
    axisId: "axis-1",
    metricName: null,
    metricDescription: null,
    recommendation: null,
    bindingNote: null,
    coverageScore: null,
    ...overrides,
  };
}

describe("groupPublishedQuestions", () => {
  it("agrupa na ordem Eixo → Seção → Pergunta", () => {
    const groups = groupPublishedQuestions([
      question({
        questionId: "q1",
        orderIndex: 0,
        axisName: "Ambiental",
        sectionName: "Água",
        prompt: "P1",
      }),
      question({
        questionId: "q2",
        orderIndex: 1,
        axisName: "Ambiental",
        sectionName: "Energia",
        prompt: "P2",
      }),
      question({
        questionId: "q3",
        orderIndex: 2,
        axisName: "Social",
        sectionName: "Pessoas",
        prompt: "P3",
      }),
    ]);

    expect(groups).toEqual([
      {
        axisName: "Ambiental",
        sections: [
          { sectionName: "Água", questions: [expect.objectContaining({ questionId: "q1" })] },
          { sectionName: "Energia", questions: [expect.objectContaining({ questionId: "q2" })] },
        ],
      },
      {
        axisName: "Social",
        sections: [
          { sectionName: "Pessoas", questions: [expect.objectContaining({ questionId: "q3" })] },
        ],
      },
    ]);
  });
});

describe("paginatePublishedQuestions", () => {
  const questions = Array.from({ length: 12 }, (_, index) =>
    question({
      questionId: `q${index + 1}`,
      orderIndex: index,
      axisName: index < 10 ? "Ambiental" : "Social",
      sectionName: index < 5 ? "Água" : index < 10 ? "Energia" : "Pessoas",
      prompt: `Pergunta ${index + 1}`,
    }),
  );

  it("pagina por perguntas e preserva hierarquia só com grupos da página", () => {
    const page1 = paginatePublishedQuestions(questions, 1, 10);
    expect(page1.rangeStart).toBe(1);
    expect(page1.rangeEnd).toBe(10);
    expect(page1.pageQuestions).toHaveLength(10);
    expect(page1.groups).toHaveLength(1);
    expect(page1.groups[0]?.axisName).toBe("Ambiental");
    expect(page1.groups[0]?.sections.map((s) => s.sectionName)).toEqual(["Água", "Energia"]);

    const page2 = paginatePublishedQuestions(questions, 2, 10);
    expect(page2.rangeStart).toBe(11);
    expect(page2.rangeEnd).toBe(12);
    expect(page2.pageQuestions.map((q) => q.orderIndex)).toEqual([10, 11]);
    expect(page2.groups).toEqual([
      {
        axisName: "Social",
        sections: [
          {
            sectionName: "Pessoas",
            questions: [
              expect.objectContaining({ questionId: "q11", orderIndex: 10 }),
              expect.objectContaining({ questionId: "q12", orderIndex: 11 }),
            ],
          },
        ],
      },
    ]);
  });

  it("repete o eixo/seção quando a página continua o mesmo grupo", () => {
    const page = paginatePublishedQuestions(questions, 2, 5);
    expect(page.pageQuestions.map((q) => q.orderIndex)).toEqual([5, 6, 7, 8, 9]);
    expect(page.groups).toEqual([
      {
        axisName: "Ambiental",
        sections: [
          {
            sectionName: "Energia",
            questions: expect.arrayContaining([
              expect.objectContaining({ orderIndex: 5 }),
              expect.objectContaining({ orderIndex: 9 }),
            ]),
          },
        ],
      },
    ]);
  });

  it("não reinicia a numeração original ao mudar de página", () => {
    const page = paginatePublishedQuestions(questions, 2, 10);
    expect(page.pageQuestions[0]?.orderIndex).toBe(10);
  });
});

describe("parsers da URL da estrutura publicada", () => {
  it("aceita pageSize 5, 10 e 20 e cai no padrão 10", () => {
    expect(parsePublishedStructurePageSize("5")).toBe(5);
    expect(parsePublishedStructurePageSize("10")).toBe(10);
    expect(parsePublishedStructurePageSize("20")).toBe(20);
    expect(parsePublishedStructurePageSize("7")).toBe(10);
    expect(parsePublishedStructurePageSize(null)).toBe(10);
  });

  it("aceita página positiva e cai em 1", () => {
    expect(parsePublishedStructurePage("3")).toBe(3);
    expect(parsePublishedStructurePage("0")).toBe(1);
    expect(parsePublishedStructurePage("abc")).toBe(1);
  });
});
