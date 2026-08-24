import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isUnchangedRequestedLinkEvidence,
  mapApplyWorkbenchResponseError,
  workbenchResponseBodySchema,
} from "./save-workbench-response";

const basePayload = {
  cycleId: "00000000-0000-4000-8000-000000000001",
  questionId: "00000000-0000-4000-8000-000000000003",
  answer: "yes" as const,
  notes: "",
};

describe("workbenchResponseBodySchema", () => {
  it("aceita o contrato canônico sem estado duplicado de não aplicável", () => {
    const parsed = workbenchResponseBodySchema.parse({
      ...basePayload,
      answer: "not_applicable",
    });

    expect(parsed.answer).toBe("not_applicable");
    expect("isNotApplicable" in parsed).toBe(false);
  });

  it("exige storagePath para evidência por arquivo", () => {
    const parsed = workbenchResponseBodySchema.safeParse({
      ...basePayload,
      evidence: {
        kind: "file",
        title: "evidencia.pdf",
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("exige externalLink para evidência por link", () => {
    const parsed = workbenchResponseBodySchema.safeParse({
      ...basePayload,
      evidence: {
        kind: "link",
        title: "Portal institucional",
      },
    });

    expect(parsed.success).toBe(false);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://exemplo.org/evidencia",
  ])("rejeita protocolo inseguro em evidência por link: %s", (externalLink) => {
    const parsed = workbenchResponseBodySchema.safeParse({
      ...basePayload,
      evidence: {
        kind: "link",
        title: "Portal institucional",
        externalLink,
      },
    });

    expect(parsed.success).toBe(false);
  });

  it("exige upload temporário válido para evidência por arquivo", () => {
    const withoutPendingUpload = workbenchResponseBodySchema.safeParse({
      ...basePayload,
      evidence: {
        kind: "file",
        title: "evidencia.pdf",
        storagePath: "org/cycle/upload-evidencia.pdf",
      },
    });
    const withPendingUpload = workbenchResponseBodySchema.safeParse({
      ...basePayload,
      evidence: {
        kind: "file",
        title: "evidencia.pdf",
        storagePath: "org/cycle/upload-evidencia.pdf",
        pendingUploadId: "00000000-0000-4000-8000-000000000004",
      },
    });

    expect(withoutPendingUpload.success).toBe(false);
    expect(withPendingUpload.success).toBe(true);
  });

  it("exige textBody para evidência textual e rejeita arquivo/link misturados", () => {
    const withoutTextBody = workbenchResponseBodySchema.safeParse({
      ...basePayload,
      evidence: {
        kind: "text",
        title: "Relato institucional",
      },
    });
    const withFileFields = workbenchResponseBodySchema.safeParse({
      ...basePayload,
      evidence: {
        kind: "text",
        title: "Relato institucional",
        textBody: "Descrição da prática.",
        storagePath: "org/cycle/arquivo.pdf",
      },
    });
    const withTextBody = workbenchResponseBodySchema.safeParse({
      ...basePayload,
      evidence: {
        kind: "text",
        title: "Relato institucional",
        textBody: "Descrição da prática adotada pela unidade.",
      },
    });

    expect(withoutTextBody.success).toBe(false);
    expect(withFileFields.success).toBe(false);
    expect(withTextBody.success).toBe(true);
    if (withTextBody.success) {
      expect(withTextBody.data.evidence).toMatchObject({
        kind: "text",
        textBody: "Descrição da prática adotada pela unidade.",
      });
    }
  });
});

describe("isUnchangedRequestedLinkEvidence", () => {
  const existing = {
    validationStatus: "adjustment_requested",
    externalLink: "https://exemplo.org/evidencia",
    linkReason: "Documento institucional",
  };

  it("detecta reenvio idêntico do link ajustado", () => {
    expect(
      isUnchangedRequestedLinkEvidence(existing, {
        kind: "link",
        title: "Evidência",
        description: "Documento institucional",
        externalLink: "https://exemplo.org/evidencia",
      }),
    ).toBe(true);
  });

  it("bloqueia save de N/A sem justificativa suficiente no domínio", async () => {
    const { validateNaJustification } = await import("@/shared/domain/not-applicable");
    expect(validateNaJustification("").ok).toBe(false);
    expect(validateNaJustification("motivo curto").ok).toBe(false);
  });
});

describe("mapApplyWorkbenchResponseError", () => {
  it("mapeia conflito de revisão para 409", () => {
    expect(
      mapApplyWorkbenchResponseError({
        message: "response_revision_conflict",
      }),
    ).toEqual({
      ok: false,
      status: 409,
      error:
        "Esta resposta foi alterada em outra aba ou por outro usuário. Recarregue o diagnóstico antes de salvar novamente.",
    });
  });

  it("mapeia critério fora do escopo da reabertura para 409", () => {
    expect(
      mapApplyWorkbenchResponseError({
        message: "question_not_in_reopen_scope",
        details: "P0001",
      }),
    ).toEqual({
      ok: false,
      status: 409,
      error:
        "Este critério está fora do escopo da reabertura parcial e não pode ser alterado.",
    });
  });

  it("não mascara erro desconhecido — o chamador deve relançar", () => {
    expect(
      mapApplyWorkbenchResponseError({
        message: "Could not find the function public.apply_workbench_response in the schema cache",
      }),
    ).toBeNull();
  });
});

describe("contrato de persistência do workbench", () => {
  it("não chama helper privado via PostgREST público", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/workbench/save-workbench-response.ts"),
      "utf8",
    );
    expect(source).not.toMatch(
      /rpc\(\s*["']is_cycle_question_collection_editable["']/,
    );
    expect(source).toContain("apply_workbench_response");
    expect(source).toContain("canInvokeLocalDatabaseRpc");
    expect(source).toContain("question_not_in_reopen_scope");
  });
});
