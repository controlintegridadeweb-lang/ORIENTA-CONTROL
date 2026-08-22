import { describe, expect, it } from "vitest";
import type {
  WorkbenchEvidence,
  WorkbenchRow,
} from "@/features/workbench/load-workbench-payload";
import {
  buildLegacyPersistedEvidence,
  hasResidualEvidenceFlatFields,
  hasUsableEvidenceAttachment,
  resolvePersistedEvidences,
} from "./resolve-persisted-evidences";
import { resolveEvidenceStatus } from "./evidence-rule-message";
import { resolveEvidenceSectionDescription } from "./evidence-section-description";

function evidence(
  overrides: Partial<WorkbenchEvidence> & Pick<WorkbenchEvidence, "id">,
): WorkbenchEvidence {
  return {
    kind: "file",
    title: "Evidência",
    description: "",
    externalLink: null,
    storagePath: "org/cycle/arquivo.pdf",
    textBody: null,
    validationStatus: "submitted",
    validatedAt: null,
    submittedAt: "2026-01-01T00:00:00.000Z",
    validationJustification: null,
    ...overrides,
  };
}

function row(
  overrides: Partial<WorkbenchRow> = {},
): Pick<
  WorkbenchRow,
  | "evidenceId"
  | "evidenceTitle"
  | "evidenceDescription"
  | "externalLink"
  | "storagePath"
  | "textBody"
  | "validationStatus"
  | "validationJustification"
  | "hasAdjustmentRequest"
  | "evidences"
  | "adjustmentRequestCount"
  | "resolvedAdjustmentRequestCount"
  | "unresolvedAdjustmentRequestCount"
> {
  return {
    evidenceId: null,
    evidenceTitle: null,
    evidenceDescription: null,
    externalLink: null,
    storagePath: null,
    textBody: null,
    validationStatus: null,
    validationJustification: null,
    hasAdjustmentRequest: false,
    evidences: undefined,
    ...overrides,
  };
}

describe("resolvePersistedEvidences", () => {
  it("usa a coleção quando evidences possui itens válidos", () => {
    const items = [
      evidence({ id: "ev-1", title: "Portaria" }),
      evidence({ id: "ev-2", title: "Ata", storagePath: "org/cycle/ata.pdf" }),
    ];
    const resolved = resolvePersistedEvidences(
      row({
        evidenceId: "ev-2",
        storagePath: "org/cycle/ata.pdf",
        evidences: items,
      }),
    );
    expect(resolved).toEqual(items);
    expect(resolved).toHaveLength(2);
  });

  it("usa fallback legado quando evidences é [] e há evidência legada válida", () => {
    const resolved = resolvePersistedEvidences(
      row({
        evidences: [],
        evidenceId: "ev-legacy",
        storagePath: "org/cycle/legado.pdf",
        evidenceTitle: "Legado",
        validationStatus: "submitted",
      }),
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      id: "ev-legacy",
      kind: "file",
      title: "Legado",
      storagePath: "org/cycle/legado.pdf",
      validationStatus: "submitted",
    });
  });

  it("usa fallback legado quando evidences está ausente e há evidência legada válida", () => {
    const resolved = resolvePersistedEvidences(
      row({
        evidences: undefined,
        evidenceId: "ev-legacy",
        externalLink: "https://exemplo.gov.br/doc",
        evidenceTitle: "Link oficial",
        validationStatus: "submitted",
      }),
    );
    expect(resolved).toHaveLength(1);
    expect(resolved[0]).toMatchObject({
      id: "ev-legacy",
      kind: "link",
      title: "Link oficial",
      externalLink: "https://exemplo.gov.br/doc",
    });
  });

  it("retorna lista vazia quando evidences é [] sem campos legados", () => {
    expect(resolvePersistedEvidences(row({ evidences: [] }))).toEqual([]);
  });

  it("exibe link externo corretamente no fallback legado", () => {
    const legacy = buildLegacyPersistedEvidence(
      row({
        evidenceId: "ev-link",
        externalLink: "https://exemplo.gov.br/norma",
        evidenceTitle: null,
      }),
    );
    expect(legacy).toMatchObject({
      kind: "link",
      externalLink: "https://exemplo.gov.br/norma",
      title: "https://exemplo.gov.br/norma",
    });
  });

  it("ignora itens incompletos na coleção e não inventa pending", () => {
    const resolved = resolvePersistedEvidences(
      row({
        evidences: [
          evidence({
            id: "ev-incomplete",
            storagePath: null,
            externalLink: null,
            title: "Sem anexo",
          }),
        ],
        evidenceId: "ev-incomplete",
        storagePath: null,
        externalLink: null,
      }),
    );
    expect(resolved).toEqual([]);
    expect(
      hasUsableEvidenceAttachment({
        storagePath: null,
        externalLink: "  ",
        textBody: null,
      }),
    ).toBe(false);
  });

  it("não trata evidenceId residual sem arquivo/link como evidência válida", () => {
    expect(
      resolvePersistedEvidences(
        row({
          evidences: [],
          evidenceId: "ev-orfao",
          storagePath: null,
          externalLink: null,
          evidenceTitle: "Título órfão",
        }),
      ),
    ).toEqual([]);
  });

  it("detecta campos planos residuais sem apagar dados", () => {
    const orphan = row({
      evidences: [],
      evidenceId: "ev-orfao",
      evidenceTitle: "Residual",
    });
    expect(resolvePersistedEvidences(orphan)).toEqual([]);
    expect(hasResidualEvidenceFlatFields(orphan)).toBe(true);
    // A resolução não muta a linha.
    expect(orphan.evidenceId).toBe("ev-orfao");
    expect(orphan.evidenceTitle).toBe("Residual");
  });
});

describe("coerência status × lista × descrição", () => {
  it("evidences com itens: banner pending, lista e texto de pendência coerentes", () => {
    const current = row({
      evidences: [evidence({ id: "ev-1", title: "Portaria", validationStatus: "submitted" })],
      evidenceId: "ev-1",
      storagePath: "org/cycle/arquivo.pdf",
      validationStatus: "submitted",
    });
    const persisted = resolvePersistedEvidences(current);
    const status = resolveEvidenceStatus(current);
    const description = resolveEvidenceSectionDescription(current as WorkbenchRow);

    expect(persisted).toHaveLength(1);
    expect(persisted[0]?.title).toBe("Portaria");
    expect(status).toBe("pending");
    expect(description).toContain("Evidência enviada e aguardando validação");
    expect(description).not.toContain("Envie um ou mais arquivos ou informe um link");
  });

  it("evidences [] com legado válido: fallback unificado para status, lista e texto", () => {
    const current = row({
      evidences: [],
      evidenceId: "ev-legacy",
      storagePath: "org/cycle/legado.pdf",
      evidenceTitle: "Legado",
      validationStatus: "submitted",
    });
    expect(resolvePersistedEvidences(current)).toHaveLength(1);
    expect(resolveEvidenceStatus(current)).toBe("pending");
    expect(resolveEvidenceSectionDescription(current as WorkbenchRow)).toContain(
      "aguardando validação",
    );
  });

  it("sem evidência válida: not_submitted e texto de envio inicial", () => {
    const current = row({ evidences: [] });
    expect(resolvePersistedEvidences(current)).toEqual([]);
    expect(resolveEvidenceStatus(current)).toBe("not_submitted");
    expect(resolveEvidenceSectionDescription(current as WorkbenchRow)).toBe(
      "Envie um ou mais arquivos ou informe um link. Cada evidência precisa de um título próprio.",
    );
  });

  it("campos residuais incompletos não geram falso pending", () => {
    const current = row({
      evidences: [],
      evidenceId: "ev-residual",
      storagePath: null,
      externalLink: null,
    });
    expect(resolvePersistedEvidences(current)).toEqual([]);
    expect(resolveEvidenceStatus(current)).toBe("not_submitted");
    expect(resolveEvidenceSectionDescription(current as WorkbenchRow)).toContain(
      "Envie um ou mais arquivos ou informe um link",
    );
  });

  it("banner e lista nunca apresentam estados contraditórios", () => {
    const cases = [
      row({ evidences: [] }),
      row({
        evidences: [],
        evidenceId: "ev-1",
        storagePath: "a.pdf",
        evidenceTitle: "A",
      }),
      row({
        evidences: [evidence({ id: "a" }), evidence({ id: "b", title: "B" })],
      }),
      row({
        evidences: [],
        evidenceId: "only-id",
      }),
      row({
        evidences: [
          evidence({
            id: "broken",
            storagePath: null,
            externalLink: null,
          }),
        ],
      }),
    ];

    for (const current of cases) {
      const persisted = resolvePersistedEvidences(current);
      const status = resolveEvidenceStatus(current);
      if (persisted.length === 0) {
        expect(status).toBe("not_submitted");
      } else {
        expect(status).not.toBe("not_submitted");
      }
      if (status === "pending" || status === "approved") {
        expect(persisted.length).toBeGreaterThan(0);
      }
    }
  });

  it("múltiplas evidências são preservadas na resolução", () => {
    const items = [
      evidence({ id: "ev-1", title: "Um" }),
      evidence({
        id: "ev-2",
        kind: "link",
        title: "Dois",
        storagePath: null,
        externalLink: "https://exemplo.gov.br/dois",
      }),
    ];
    expect(resolvePersistedEvidences(row({ evidences: items }))).toEqual(items);
  });

  it("não apaga campos planos ao resolver evidências", () => {
    const current = row({
      evidences: [],
      evidenceId: "ev-keep",
      storagePath: "org/cycle/keep.pdf",
      externalLink: null,
      evidenceTitle: "Manter",
      validationStatus: "submitted",
    });
    const before = { ...current };
    resolvePersistedEvidences(current);
    resolveEvidenceStatus(current);
    resolveEvidenceSectionDescription(current as WorkbenchRow);
    expect(current).toEqual(before);
  });
});
