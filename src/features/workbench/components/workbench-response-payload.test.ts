import { describe, expect, it } from "vitest";
import type { EvidenceDraft } from "@/features/workbench/evidence-draft";
import type { WorkbenchRow } from "@/features/workbench/load-workbench-payload";
import {
  buildWorkbenchEvidencePayload,
  buildWorkbenchEvidencePayloads,
} from "./workbench-response-payload";

function emptyDraft(overrides: Partial<EvidenceDraft> = {}): EvidenceDraft {
  return {
    kind: null,
    title: "",
    description: "",
    externalLink: "",
    storagePath: null,
    pendingUploadId: null,
    textBody: "",
    ...overrides,
  };
}

function row(overrides: Partial<WorkbenchRow> = {}): WorkbenchRow {
  return {
    questionId: "11111111-1111-4111-8111-111111111111",
    prompt: "Existe evidência?",
    requiresEvidence: true,
    famiEnabled: true,
    recommendationText: "",
    axisName: "Governança",
    sectionName: "Seção",
    responseId: null,
    answer: "yes",
    notes: null,
    evidenceId: null,
    evidenceTitle: null,
    evidenceDescription: null,
    externalLink: null,
    storagePath: null,
    textBody: null,
    validationStatus: null,
    validationJustification: null,
    isNotApplicable: false,
    naJustification: null,
    naValidationStatus: null,
    naRejectionReason: null,
    ...overrides,
  };
}

describe("buildWorkbenchEvidencePayload", () => {
  it("permite salvar Sim sem evidência para registrar a ausência no diagnóstico", () => {
    expect(buildWorkbenchEvidencePayload(row(), emptyDraft())).toBeUndefined();
  });

  it("preserva múltiplos uploads no mesmo critério", () => {
    expect(
      buildWorkbenchEvidencePayloads(
        row(),
        emptyDraft({
          attachments: [
            {
              clientId: "upload-1",
              kind: "file",
              title: "Portaria",
              description: "",
              externalLink: null,
              storagePath: "org/cycle/portaria.pdf",
              pendingUploadId: "11111111-1111-4111-8111-111111111111",
            },
            {
              clientId: "upload-2",
              kind: "file",
              title: "Ata",
              description: "",
              externalLink: null,
              storagePath: "org/cycle/ata.pdf",
              pendingUploadId: "22222222-2222-4222-8222-222222222222",
            },
          ],
        }),
      ),
    ).toEqual([
      expect.objectContaining({ title: "Portaria", storagePath: "org/cycle/portaria.pdf" }),
      expect.objectContaining({ title: "Ata", storagePath: "org/cycle/ata.pdf" }),
    ]);
  });

  it("bloqueia um payload acima do limite transacional", () => {
    expect(
      buildWorkbenchEvidencePayloads(
        row(),
        emptyDraft({
          attachments: Array.from({ length: 21 }, (_, index) => ({
            clientId: `upload-${index}`,
            kind: "file" as const,
            title: `Arquivo ${index}`,
            description: "",
            externalLink: null,
            storagePath: `org/cycle/${index}.pdf`,
            pendingUploadId: "11111111-1111-4111-8111-111111111111",
          })),
        }),
      ),
    ).toBeNull();
  });

  it("exige um upload pendente para arquivo novo", () => {
    expect(
      buildWorkbenchEvidencePayload(
        row(),
        emptyDraft({
          kind: "file",
          title: "Comprovante",
          storagePath: "org/cycle/object.pdf",
        }),
      ),
    ).toBeNull();
  });

  it("preserva a identidade do upload pendente no payload de arquivo", () => {
    expect(
      buildWorkbenchEvidencePayload(
        row(),
        emptyDraft({
          kind: "file",
          title: "Comprovante",
          description: "Descrição",
          storagePath: "org/cycle/object.pdf",
          pendingUploadId: "22222222-2222-4222-8222-222222222222",
        }),
      ),
    ).toEqual({
      kind: "file",
      title: "Comprovante",
      description: "Descrição",
      storagePath: "org/cycle/object.pdf",
      pendingUploadId: "22222222-2222-4222-8222-222222222222",
    });
  });

  it("monta payload de comprovação textual com textBody", () => {
    expect(
      buildWorkbenchEvidencePayload(
        row(),
        emptyDraft({
          kind: "text",
          title: "Relato institucional",
          textBody: "Descrição da prática adotada pela unidade.",
        }),
      ),
    ).toEqual({
      kind: "text",
      title: "Relato institucional",
      description: undefined,
      textBody: "Descrição da prática adotada pela unidade.",
    });
  });

  it("não exige novo payload quando a evidência persistida continua válida", () => {
    expect(
      buildWorkbenchEvidencePayload(
        row({ evidenceId: "e1", storagePath: "org/cycle/existente.pdf", evidenceTitle: "Existente" }),
        emptyDraft(),
      ),
    ).toBeUndefined();
  });

  it("não reenvia automaticamente um link com ajuste solicitado", () => {
    expect(
      buildWorkbenchEvidencePayload(
        row({
          evidenceId: "e-link",
          evidenceTitle: "https://exemplo.org/evidencia",
          evidenceDescription: "Documento institucional",
          externalLink: "https://exemplo.org/evidencia",
          validationStatus: "adjustment_requested",
        }),
        emptyDraft({
          kind: "link",
          title: "https://exemplo.org/evidencia",
          description: "Documento institucional",
          externalLink: "https://exemplo.org/evidencia",
        }),
        { hasLocalChanges: false },
      ),
    ).toBeUndefined();
  });

  it("envia o link persistido quando o usuário realmente o altera", () => {
    expect(
      buildWorkbenchEvidencePayload(
        row({ evidenceId: "e-link", externalLink: "https://exemplo.org/antigo" }),
        emptyDraft({
          kind: "link",
          title: "Documento atualizado",
          description: "Versão corrigida",
          externalLink: "https://exemplo.org/novo",
        }),
        { hasLocalChanges: true },
      ),
    ).toMatchObject({ externalLink: "https://exemplo.org/novo" });
  });
});
