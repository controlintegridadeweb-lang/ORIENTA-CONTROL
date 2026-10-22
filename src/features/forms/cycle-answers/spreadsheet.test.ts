import { describe, expect, it } from "vitest";
import { perguntaLabels } from "@/shared/labels/official-labels";
import { buildCycleAnswersXlsx } from "./xlsx";
import {
  CYCLE_ANSWERS_EXPORT_HEADERS,
  buildCycleAnswersXlsxSheets,
  cycleAnswersFilename,
  mapCycleAnswerRow,
  type CycleAnswerSource,
} from "./spreadsheet";

function source(overrides: Partial<CycleAnswerSource> = {}): CycleAnswerSource {
  return {
    orderIndex: 0,
    prompt: "A organização publica a política de integridade?",
    answer: "yes",
    notes: " Publicada no portal. ",
    isWaived: false,
    waiverReason: null,
    isNotApplicable: false,
    evidences: [{ title: "Portaria" }, { title: "  " }, { title: "Link do portal" }],
    ...overrides,
  };
}

describe("mapCycleAnswerRow", () => {
  it("traduz sim, não e ausência de resposta", () => {
    expect(mapCycleAnswerRow(source(), { axisName: "Governança", sectionName: "Política" })).toMatchObject({
      order: 1,
      axisName: "Governança",
      sectionName: "Política",
      prompt: "A organização publica a política de integridade?",
      answer: "Sim",
      notes: "Publicada no portal.",
      evidences: "Portaria; Link do portal",
    });
    expect(mapCycleAnswerRow(source({ answer: "no", notes: "  ", evidences: [] }), null).answer).toBe("Não");
    expect(mapCycleAnswerRow(source({ answer: null, notes: null, evidences: [] }), null)).toMatchObject({
      answer: "Sem resposta",
      notes: null,
      evidences: null,
      axisName: "",
    });
  });

  it("usa o vocabulário de não aplicável e preserva o motivo", () => {
    const waived = mapCycleAnswerRow(
      source({
        isWaived: true,
        waiverReason: "Órgão sem essa competência",
        answer: "yes",
        notes: null,
        evidences: [],
      }),
      null,
    );
    expect(waived.answer).toBe(perguntaLabels.notApplicableForOrganization);
    expect(waived.notes).toBe("Órgão sem essa competência");

    const marked = mapCycleAnswerRow(
      source({ isNotApplicable: true, answer: "not_applicable", notes: "Fora do período" }),
      null,
    );
    expect(marked.answer).toBe(perguntaLabels.notApplicableInDiagnosis);
    expect(marked.notes).toBe("Fora do período");
  });
});

describe("planilha de respostas", () => {
  const data = {
    formName: "Diagnóstico de Integridade",
    organizationName: "Controladoria-Geral do Estado",
    periodLabel: "2026.1",
    rows: [mapCycleAnswerRow(source({ orderIndex: 3 }), { axisName: "Eixo", sectionName: "Seção" })],
  };

  it("monta cabeçalho, pergunta e resposta na mesma linha", () => {
    const sheet = buildCycleAnswersXlsxSheets(data)[0];
    expect(sheet?.sheet).toBe("Respostas");
    expect(sheet?.stickyRowsCount).toBe(1);
    expect(sheet?.data?.[0]).toHaveLength(CYCLE_ANSWERS_EXPORT_HEADERS.length);
    const row = sheet?.data?.[1] as Array<{ value?: string } | number | null>;
    expect(row?.[0]).toBe(4);
    expect(row?.[3]).toMatchObject({ value: "A organização publica a política de integridade?" });
    expect(row?.[4]).toMatchObject({ value: "Sim" });
    expect(row?.[7]).toBe("Controladoria-Geral do Estado");
    expect(row?.[9]).toBe("Diagnóstico de Integridade");
  });

  it("nomeia o arquivo com diagnóstico, organização e período", () => {
    expect(cycleAnswersFilename(data)).toBe(
      "respostas-diagnostico-de-integridade-controladoria-geral-do-estado-2026-1.xlsx",
    );
  });

  it("gera um arquivo xlsx válido", async () => {
    const file = await buildCycleAnswersXlsx(data);
    expect(file.filename).toBe(cycleAnswersFilename(data));
    expect(file.content.subarray(0, 2).toString()).toBe("PK");
  });
});
