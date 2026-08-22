import { describe, expect, it } from "vitest";
import {
  cancelActionCommandSchema,
  createActionPlanSchema,
  createSupervisionNoteSchema,
  decideSupervisionRequestSchema,
  editActionDetailsSchema,
  requestActionPlanDeadlineChangeSchema,
  decideActionPlanDeadlineChangeSchema,
  historyPaginationSchema,
  listSupervisionNotesQuerySchema,
  respondSupervisionRequestSchema,
  respondentActionCommandSchema,
  updateActionProgressSchema,
} from "./schemas";

const createPayload = {
  intent: "create" as const,
  recommendationId: "11111111-1111-4111-8111-111111111111",
  actionText: "Formalizar o procedimento de acompanhamento.",
  startDate: "2026-08-01",
  dueDate: "2026-12-31",
  responsibleSector: "Integridade",
  responsibleUserId: "55555555-5555-4555-8555-555555555555",
};

describe("createActionPlanSchema", () => {
  it("aceita cadastro sem progresso nem cancelamento", () => {
    expect(createActionPlanSchema.safeParse(createPayload).success).toBe(true);
  });

  it("nova ação não exige descrição de atualização", () => {
    const parsed = createActionPlanSchema.parse(createPayload);
    expect("progressUpdateDescription" in parsed).toBe(false);
  });

  it("rejeita progresso ou cancelamento no cadastro", () => {
    expect(
      createActionPlanSchema.safeParse({ ...createPayload, progressPercentage: 0 }).success,
    ).toBe(false);
    expect(
      createActionPlanSchema.safeParse({ ...createPayload, cancelled: true }).success,
    ).toBe(false);
  });

  it("rejeita final anterior ao início", () => {
    const parsed = createActionPlanSchema.safeParse({
      ...createPayload,
      startDate: "2026-08-20",
      dueDate: "2026-08-19",
    });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(parsed.error.issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            path: ["dueDate"],
            message: "O final não pode ser anterior ao início.",
          }),
        ]),
      );
    }
  });

  it("aceita início e final no mesmo dia", () => {
    expect(
      createActionPlanSchema.safeParse({
        ...createPayload,
        startDate: "2026-08-20",
        dueDate: "2026-08-20",
      }).success,
    ).toBe(true);
  });

  it("aceita final já vencido sem confirmação extra", () => {
    expect(
      createActionPlanSchema.safeParse({
        ...createPayload,
        startDate: "2026-01-01",
        dueDate: "2026-01-15",
      }).success,
    ).toBe(true);
  });

  it("não aceita o campo de confirmação de prazo passado", () => {
    expect(
      createActionPlanSchema.safeParse({
        ...createPayload,
        pastDueDateConfirmed: true,
      }).success,
    ).toBe(false);
  });
});

describe("updateActionProgressSchema", () => {
  const progressPayload = {
    intent: "update_progress" as const,
    planId: "22222222-2222-4222-8222-222222222222",
    recommendationId: createPayload.recommendationId,
    expectedRevision: 1,
    progressPercentage: 40,
    progressUpdateDescription: "Capacitação concluída e implantação iniciada.",
  };

  it("exige descrição da atualização no histórico", () => {
    expect(updateActionProgressSchema.safeParse(progressPayload).success).toBe(true);
    expect(
      updateActionProgressSchema.safeParse({
        ...progressPayload,
        progressUpdateDescription: "",
      }).success,
    ).toBe(false);
  });

  it("não aceita campos cadastrais no andamento", () => {
    expect(
      updateActionProgressSchema.safeParse({
        ...progressPayload,
        actionText: "outro",
      }).success,
    ).toBe(false);
  });
});

describe("editActionDetailsSchema", () => {
  it("aceita apenas dados estruturais", () => {
    expect(
      editActionDetailsSchema.safeParse({
        intent: "edit_details",
        planId: "22222222-2222-4222-8222-222222222222",
        recommendationId: createPayload.recommendationId,
        expectedRevision: 1,
        actionText: createPayload.actionText,
        startDate: createPayload.startDate,
        responsibleSector: createPayload.responsibleSector,
        responsibleUserId: createPayload.responsibleUserId,
      }).success,
    ).toBe(true);
  });

  it("rejeita tentativa de alterar o prazo diretamente", () => {
    expect(
      editActionDetailsSchema.safeParse({
        intent: "edit_details",
        planId: "22222222-2222-4222-8222-222222222222",
        recommendationId: createPayload.recommendationId,
        expectedRevision: 1,
        actionText: createPayload.actionText,
        startDate: createPayload.startDate,
        dueDate: "2027-01-31",
        responsibleSector: createPayload.responsibleSector,
        responsibleUserId: createPayload.responsibleUserId,
      }).success,
    ).toBe(false);
  });
});

describe("deadline change schemas", () => {
  it("aceita solicitação com novo prazo e justificativa", () => {
    expect(
      requestActionPlanDeadlineChangeSchema.safeParse({
        planId: "22222222-2222-4222-8222-222222222222",
        recommendationId: createPayload.recommendationId,
        expectedRevision: 1,
        requestedDueDate: "2027-01-31",
        reason: "A execução depende da conclusão do processo de contratação.",
      }).success,
    ).toBe(true);
  });

  it("exige justificativa suficiente na solicitação", () => {
    expect(
      requestActionPlanDeadlineChangeSchema.safeParse({
        planId: "22222222-2222-4222-8222-222222222222",
        recommendationId: createPayload.recommendationId,
        expectedRevision: 1,
        requestedDueDate: "2027-01-31",
        reason: "curto",
      }).success,
    ).toBe(false);
  });

  it("aceita somente aprovação ou rejeição com justificativa", () => {
    expect(
      decideActionPlanDeadlineChangeSchema.safeParse({
        requestId: "22222222-2222-4222-8222-222222222222",
        decision: "approved",
        decisionReason: "Prorrogação devidamente fundamentada.",
      }).success,
    ).toBe(true);
    expect(
      decideActionPlanDeadlineChangeSchema.safeParse({
        requestId: "22222222-2222-4222-8222-222222222222",
        decision: "pending",
        decisionReason: "Ainda analisando.",
      }).success,
    ).toBe(false);
  });
});

describe("cancelActionCommandSchema", () => {
  it("exige motivo do cancelamento", () => {
    expect(
      cancelActionCommandSchema.safeParse({
        intent: "cancel",
        planId: "22222222-2222-4222-8222-222222222222",
        recommendationId: createPayload.recommendationId,
        expectedRevision: 1,
        observations: "Ação substituída por medida institucional equivalente.",
      }).success,
    ).toBe(true);
    expect(
      cancelActionCommandSchema.safeParse({
        intent: "cancel",
        planId: "22222222-2222-4222-8222-222222222222",
        recommendationId: createPayload.recommendationId,
        expectedRevision: 1,
        observations: "",
      }).success,
    ).toBe(false);
  });
});

describe("respondentActionCommandSchema (union)", () => {
  it("rejeita formId legado", () => {
    expect(
      respondentActionCommandSchema.safeParse({
        ...createPayload,
        formId: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(false);
  });

  it("normaliza espaços externos no cadastro", () => {
    const result = createActionPlanSchema.parse({
      ...createPayload,
      actionText: "  Ação válida  ",
      responsibleSector: "  TI  ",
    });
    expect(result.actionText).toBe("Ação válida");
    expect(result.responsibleSector).toBe("TI");
  });
});

describe("supervision schemas", () => {
  it("normaliza paginação de históricos", () => {
    expect(historyPaginationSchema.parse({})).toEqual({ limit: 25, offset: 0 });
    expect(historyPaginationSchema.safeParse({ limit: 101, offset: 0 }).success).toBe(false);
    expect(
      listSupervisionNotesQuerySchema.parse({
        recommendationId: "11111111-1111-4111-8111-111111111111",
        actionPlanId: "22222222-2222-4222-8222-222222222222",
        lifecycleStatuses: ["open", "acknowledged"],
        limit: "50",
        offset: "25",
      }),
    ).toMatchObject({
      actionPlanId: "22222222-2222-4222-8222-222222222222",
      lifecycleStatuses: ["open", "acknowledged"],
      limit: 50,
      offset: 25,
    });
  });

  it("exige actionPlanId em notas escopadas", () => {
    expect(
      createSupervisionNoteSchema.safeParse({
        recommendationId: "11111111-1111-4111-8111-111111111111",
        noteType: "approval",
        body: "De acordo.",
      }).success,
    ).toBe(false);
  });

  it("aceita resposta e decisão de supervisão", () => {
    expect(
      respondSupervisionRequestSchema.safeParse({
        noteId: "22222222-2222-4222-8222-222222222222",
        responseBody: "Ajuste realizado.",
      }).success,
    ).toBe(true);
    expect(
      decideSupervisionRequestSchema.safeParse({
        noteId: "22222222-2222-4222-8222-222222222222",
        decision: "resolved",
        resolutionBody: "Encerrado.",
      }).success,
    ).toBe(true);
  });
});
