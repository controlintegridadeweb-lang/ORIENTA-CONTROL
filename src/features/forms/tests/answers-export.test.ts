import { describe, expect, it } from "vitest";
import {
  buildAnswersXlsx,
  buildAnswersXlsxSheets,
  type ExportPayload,
} from "../answers-export";

function makePayload(overrides?: Partial<ExportPayload>): ExportPayload {
  return {
    form: { id: "form-1", name: "Maturidade FAMI 2026" },
    overview: {
      formId: "form-1",
      formName: "Maturidade FAMI 2026",
      totalRespondents: 2,
      totalCycles: 2,
      totalQuestions: 2,
      lastAnswerAt: "2026-06-10T12:00:00.000Z",
      statusBreakdown: {
        nao_iniciada: 0,
        em_preenchimento: 1,
        completa: 0,
        submetida: 1,
        em_complementacao: 0,
      },
    },
    summary: {
      formId: "form-1",
      totalRespondents: 2,
      questions: [
        {
          questionId: "q1",
          orderIndex: 0,
          prompt: "Existe política formal de integridade?",
          answerType: "yes_no",
          totalResponses: 2,
          distribution: { yes: 1, no: 1, not_applicable: 0 },
        },
        {
          questionId: "q2",
          orderIndex: 1,
          prompt: "A organização mantém evidências atualizadas?",
          answerType: "yes_no",
          totalResponses: 1,
          distribution: { yes: 0, no: 1, not_applicable: 0 },
        },
      ],
    },
    respondents: [
      {
        cycleId: "cycle-1",
        organizationId: "org-1",
        organizationName: "Secretaria de Educação",
        periodLabel: "2026",
        answeredQuestions: 2,
        totalQuestions: 2,
        lastUpdatedAt: "2026-06-09T10:00:00.000Z",
        status: "submetida",
        contributorCount: 2,
      },
      {
        cycleId: "cycle-2",
        organizationId: "org-2",
        organizationName: "Secretaria de Saúde",
        periodLabel: "2026",
        answeredQuestions: 1,
        totalQuestions: 2,
        lastUpdatedAt: "2026-06-08T08:00:00.000Z",
        status: "em_preenchimento",
        contributorCount: 1,
      },
    ],
    generatedAtIso: "2026-06-10T12:30:00.000Z",
    ...overrides,
  };
}

describe("buildAnswersXlsx", () => {
  it("monta apenas as abas do formato operacional", () => {
    const sheets = buildAnswersXlsxSheets(makePayload());
    expect(sheets.map((sheet) => sheet.sheet)).toEqual([
      "Resumo",
      "Respondentes",
      "Resumo por pergunta",
    ]);

    const respondents = sheets.find((sheet) => sheet.sheet === "Respondentes")!;
    expect(respondents.data[1]).toEqual([
      "Secretaria de Educação",
      "2026",
      "Submetida",
      2,
      2,
      2,
      expect.stringMatching(/^09\/06\/2026,/),
    ]);

    const questions = sheets.find((sheet) => sheet.sheet === "Resumo por pergunta")!;
    expect(questions.data[1]?.slice(0, 7)).toEqual([
      1,
      expect.objectContaining({ value: "Existe política formal de integridade?" }),
      "Sim, Não ou Não se aplica",
      2,
      1,
      1,
      0,
    ]);
  });

  it("gera um arquivo XLSX binário", async () => {
    const file = await buildAnswersXlsx(makePayload());
    expect(file.subarray(0, 4).toString("binary")).toBe("PK\u0003\u0004");
    expect(file.byteLength).toBeGreaterThan(1_000);
  });
});
