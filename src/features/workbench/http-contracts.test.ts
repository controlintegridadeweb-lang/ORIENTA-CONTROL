import { describe, expect, it } from "vitest";
import {
  workbenchBatchResponseSchema,
  workbenchMutationResponseSchema,
  workbenchUploadResponseSchema,
  yesEvidenceFieldErrorsSchema,
} from "./http-contracts";

describe("contratos HTTP do workbench", () => {
  it("valida erros de campos de evidência", () => {
    expect(
      yesEvidenceFieldErrorsSchema.parse({ attachment: "Envie um arquivo." }),
    ).toEqual({ attachment: "Envie um arquivo." });
    expect(() => yesEvidenceFieldErrorsSchema.parse({ attachment: 10 })).toThrow();
  });

  it("valida respostas individuais e em lote", () => {
    expect(
      workbenchMutationResponseSchema.parse({
        fields: { title: "Informe o título." },
      }),
    ).toMatchObject({ fields: { title: "Informe o título." } });
    expect(
      workbenchBatchResponseSchema.parse({
        results: [
          { questionId: "questao-1", status: "succeeded" },
          {
            questionId: "questao-2",
            status: "failed",
            fields: { attachment: "Anexo obrigatório." },
          },
        ],
      }),
    ).toHaveProperty("results", expect.any(Array));
    expect(() => workbenchBatchResponseSchema.parse({ results: "inválido" })).toThrow();
  });

  it("exige strings nos dados de upload", () => {
    expect(
      workbenchUploadResponseSchema.parse({
        storagePath: "tenant/ciclo/arquivo.pdf",
        pendingUploadId: "upload-pendente",
      }),
    ).toMatchObject({ storagePath: "tenant/ciclo/arquivo.pdf" });
    expect(() => workbenchUploadResponseSchema.parse({ pendingUploadId: 1 })).toThrow();
  });
});
