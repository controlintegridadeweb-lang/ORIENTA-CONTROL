import { describe, expect, it } from "vitest";
import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { respondentEvidenceExportQuerySchema } from "./respondent-contracts";
import { buildRespondentEvidencesXlsx } from "./respondent-export-xlsx";
import {
  RESPONDENT_EVIDENCE_EXPORT_HEADERS,
  buildRespondentEvidenceXlsxSheets,
} from "./respondent-export-xlsx-sheets";
import type { RespondentEvidenceItem } from "./respondent-contracts";

function item(overrides: Partial<RespondentEvidenceItem> = {}): RespondentEvidenceItem {
  return {
    id: "evidence-1",
    responseId: "response-1",
    cycleId: "11111111-1111-4111-8111-111111111111",
    cycleState: "in_response",
    organizationId: "22222222-2222-4222-8222-222222222222",
    organizationName: "Org",
    formId: "33333333-3333-4333-8333-333333333333",
    formName: "Integridade",
    formVersion: 2,
    periodLabel: "2026",
    questionId: "question-1",
    questionPrompt: "O órgão publica a política?",
    axisName: "Governança",
    sectionName: "Política",
    requiresEvidence: true,
    title: "Portaria",
    description: "  Texto da descrição  ",
    evidenceType: "link",
    storagePath: "org/file.pdf",
    externalLink: " https://exemplo.test/portaria ",
    textBody: "",
    exceptionReason: null,
    submittedAt: "2026-07-04T15:30:00.000Z",
    submittedBy: "user",
    currentStatus: "approved",
    lastValidatedAt: null,
    lastJustification: "Conferido.",
    history: [],
    respondentStatus: "approved",
    needsAction: false,
    lastComplementationAt: null,
    ...overrides,
  };
}

describe("buildRespondentEvidenceXlsxSheets", () => {
  it("monta a planilha com cabeçalho congelado e rótulos do respondente", () => {
    const sheets = buildRespondentEvidenceXlsxSheets([
      item(),
      item({
        id: "proof-1",
        evidenceType: "proof_request",
        respondentStatus: "adjustment_requested",
        needsAction: true,
        title: "Comprovação solicitada",
        description: "",
        externalLink: "  ",
        lastJustification: null,
        questionPrompt: "Falta o anexo.",
      }),
    ]);
    const sheet = sheets[0];
    expect(sheet?.sheet).toBe("Evidências");
    expect(sheet?.stickyRowsCount).toBe(1);
    expect(sheet?.data?.[0]).toHaveLength(RESPONDENT_EVIDENCE_EXPORT_HEADERS.length);

    const approved = sheet?.data?.[1] as Array<unknown>;
    expect(approved).toHaveLength(RESPONDENT_EVIDENCE_EXPORT_HEADERS.length);
    expect(approved[0]).toBe(2);
    expect(approved[1]).toBe("2026");
    expect(approved[2]).toBe("Governança");
    expect(approved[3]).toBe("Política");
    expect(approved[4]).toMatchObject({ value: "O órgão publica a política?", wrap: true });
    expect(approved[5]).toBe("Portaria");
    expect(approved[6]).toBe("Link");
    expect(approved[7]).toBe("Aprovada");
    expect(approved[8]).toBe(
      formatPlatformDateTime("2026-07-04T15:30:00.000Z", {
        dateStyle: "short",
        timeStyle: "short",
      }),
    );
    expect(approved[9]).toMatchObject({ value: "https://exemplo.test/portaria", wrap: true });

    const requested = sheet?.data?.[2] as Array<unknown>;
    expect(requested[6]).toBe("Solicitada");
    expect(requested[7]).toBe("Ajuste solicitado");
    expect(requested[9]).toBeNull();
  });

  it("coloca na última coluna o texto ou o nome do documento enviado", () => {
    const sheets = buildRespondentEvidenceXlsxSheets([
      item({
        evidenceType: "text",
        externalLink: null,
        textBody: "  Política publicada no site.  ",
      }),
      item({
        evidenceType: "file",
        externalLink: null,
        textBody: null,
        storagePath:
          "22222222-2222-4222-8222-222222222222/11111111-1111-4111-8111-111111111111/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee-portaria.pdf",
      }),
    ]);
    const rows = sheets[0]?.data ?? [];
    const textRow = rows[1] as Array<{ value?: string } | null>;
    const fileRow = rows[2] as Array<{ value?: string } | null>;
    expect(textRow[6]).toBe("Textual");
    expect(textRow[9]).toMatchObject({ value: "Política publicada no site.", wrap: true });
    expect(fileRow[6]).toBe("Anexada");
    expect(fileRow[9]).toMatchObject({ value: "portaria.pdf", wrap: true });
  });

  it("gera um arquivo xlsx com os filtros da tela, sem paginação", async () => {
    const parsed = respondentEvidenceExportQuerySchema.parse({
      pendingOnly: "1",
      status: "approved",
      search: "portaria",
    });
    expect(parsed.pendingOnly).toBe(true);
    expect(parsed.status).toBe("approved");
    expect(parsed).not.toHaveProperty("limit");
    expect(parsed).not.toHaveProperty("offset");

    const { filename, content } = await buildRespondentEvidencesXlsx([item()]);
    expect(filename).toMatch(/^evidencias-\d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(content.subarray(0, 2).toString("utf8")).toBe("PK");
  });
});
