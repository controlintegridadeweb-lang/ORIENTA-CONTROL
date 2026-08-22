import { describe, expect, it, vi } from "vitest";
import {
  draftTargetKey,
  isDraftPayloadUnchanged,
} from "./validation-analysis-draft";
import {
  VALIDATION_AUTOSAVE_SAVED_LABEL,
  VALIDATION_AUTOSAVE_SAVING_LABEL,
  VALIDATION_AUTOSAVE_ERROR_MESSAGE,
  VALIDATION_ANALYSIS_CONFIRMED_LABEL,
} from "./validation-analysis-autosave";

describe("validation analysis draft helpers", () => {
  it("gera chave estável por unidade de validação", () => {
    expect(draftTargetKey("evidence", "e1", null)).toBe("evidence:e1");
    expect(draftTargetKey("absent_proof", null, "r1")).toBe("absent_proof:r1");
  });

  it("detecta rascunho sem alteração efetiva", () => {
    expect(
      isDraftPayloadUnchanged(
        { action: "approve", justification: null, notes: null },
        { action: "approve", justification: null, notes: null },
      ),
    ).toBe(true);
    expect(
      isDraftPayloadUnchanged(
        { action: "invalidate", justification: "a", notes: null },
        { action: "invalidate", justification: "b", notes: null },
      ),
    ).toBe(false);
  });

  it("usa labels que diferenciam rascunho de veredito oficial", () => {
    expect(VALIDATION_AUTOSAVE_SAVING_LABEL).toBe("Salvando rascunho...");
    expect(VALIDATION_AUTOSAVE_SAVED_LABEL).toBe("Rascunho salvo");
    expect(VALIDATION_AUTOSAVE_ERROR_MESSAGE).toBe(
      "Não foi possível salvar o rascunho",
    );
    expect(VALIDATION_ANALYSIS_CONFIRMED_LABEL).toBe("Análise confirmada");
    expect(VALIDATION_AUTOSAVE_SAVED_LABEL).not.toBe("Salvo");
  });
});

describe("saveValidationAnalysisDraft service contract", () => {
  it("chama somente a RPC de rascunho e nunca validate_evidence", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        cycleId: "22222222-2222-4222-8222-222222222222",
        targetKind: "evidence",
        evidenceId: "33333333-3333-4333-8333-333333333333",
        responseId: null,
        action: "approve",
        justification: null,
        notes: null,
        revision: 1,
        updatedAt: "2026-08-04T12:00:00.000Z",
        appliedAt: null,
        unchanged: false,
      },
      error: null,
    });
    const supabase = { rpc } as never;
    const { saveValidationAnalysisDraft } = await import(
      "./validation-analysis-draft-service"
    );
    await saveValidationAnalysisDraft(supabase, "22222222-2222-4222-8222-222222222222", {
      actorUserId: "44444444-4444-4444-8444-444444444444",
      targetKind: "evidence",
      evidenceId: "33333333-3333-4333-8333-333333333333",
      action: "approve",
      expectedRevision: null,
    });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0]?.[0]).toBe("save_validation_analysis_draft");
    expect(rpc.mock.calls[0]?.[0]).not.toBe("validate_evidence");
  });
});
