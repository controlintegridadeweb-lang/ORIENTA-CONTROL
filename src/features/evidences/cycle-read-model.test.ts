import { describe, expect, it } from "vitest";
import { loadHydratedEvidences, mapEmbeddedValidationToUi } from "./cycle-read-model";
import { validationStatusSchema } from "./schemas";

function joinedRow(index: number) {
  return {
    id: `evidence-${index}`,
    response_id: `response-${index}`,
    kind: "file",
    storage_path: `org/cycle/file-${index}.pdf`,
    external_link: null,
    link_reason: null,
    original_filename: `file-${index}.pdf`,
    validation_status: "approved",
    validation_justification: null,
    validated_at: "2026-07-10T12:00:00.000Z",
    validated_by: "admin-1",
    submitted_by: "respondent-1",
    submitted_at: new Date(Date.UTC(2026, 6, 10, 10, 0, 0) - index * 1000).toISOString(),
    responses: {
      id: `response-${index}`,
      cycle_id: "cycle-1",
      cycles: {
        organization_id: "org-1",
        state: "completed",
        organizations: { id: "org-1", name: "Organização" },
        form_versions: {
          version: 1,
          form_id: "form-1",
          forms: { id: "form-1", name: "Diagnóstico" },
        },
      },
      question_versions: {
        question_id: `question-${index}`,
        prompt: `Critério ${index}`,
        axis_name: "Eixo estrutural",
        section_name: "Seção temática",
        evidence_parameter: "required",
      },
    },
  };
}

function fakeClient(evidences: unknown[], auditRows: Array<Record<string, unknown>> = []) {
  return {
    from(table: string) {
      let recordIds: string[] | null = null;
      const query = {
        select: () => query,
        is: () => query,
        order: () => query,
        eq: () => query,
        gte: () => query,
        lte: () => query,
        in(column: string, values: string[]) {
          if (column === "record_id") recordIds = values;
          return query;
        },
        async range(from: number, to: number) {
          const source = table === "evidences"
            ? evidences
            : auditRows.filter((row) => !recordIds || recordIds.includes(String(row.record_id)));
          return { data: source.slice(from, to + 1), error: null };
        },
      };
      return query;
    },
  } as never;
}

describe("contrato de current_status da RPC", () => {
  it("aceita not_required retornado pela evidence_operational_view", () => {
    expect(validationStatusSchema.safeParse("not_required").success).toBe(true);
    for (const status of [
      "pending",
      "submitted",
      "approved",
      "invalidated",
      "adjustment_requested",
      "not_required",
    ] as const) {
      expect(validationStatusSchema.parse(status)).toBe(status);
    }
  });
});

describe("mapEmbeddedValidationToUi", () => {
  it("distingue envio do diagnóstico de validação administrativa", () => {
    expect(mapEmbeddedValidationToUi("pending", "in_response")).toBe("pending");
    expect(mapEmbeddedValidationToUi("pending", "awaiting_adjustment")).toBe("pending");
    expect(mapEmbeddedValidationToUi("pending", "submitted")).toBe("submitted");
    expect(mapEmbeddedValidationToUi("pending", "in_validation")).toBe("submitted");
  });

  it("mantém ajuste solicitado separado de não aprovação definitiva", () => {
    expect(mapEmbeddedValidationToUi("adjustment_requested", "validated")).toBe(
      "adjustment_requested",
    );
    expect(mapEmbeddedValidationToUi("invalidated", "awaiting_adjustment")).toBe("invalidated");
  });

  it("consome páginas posteriores ao limite padrão do Supabase", async () => {
    const rows = Array.from({ length: 1001 }, (_, index) => joinedRow(index));
    const items = await loadHydratedEvidences(fakeClient(rows), {});

    expect(items).toHaveLength(1001);
    expect(items.at(-1)?.id).toBe("evidence-1000");
  });

  it("reconstrói o histórico de validações pelos audit_logs", async () => {
    const evidence = joinedRow(1);
    const auditRows = [
      {
        id: "audit-current",
        record_id: "evidence-1",
        actor_user_id: "admin-2",
        before_json: { validation_status: "invalidated", validated_at: "2026-07-09T10:00:00.000Z" },
        after_json: { validation_status: "approved", validated_at: "2026-07-10T12:00:00.000Z", validated_by: "admin-2" },
        created_at: "2026-07-10T12:00:00.000Z",
      },
      {
        id: "audit-previous",
        record_id: "evidence-1",
        actor_user_id: "admin-1",
        before_json: { validation_status: "pending", validated_at: null },
        after_json: { validation_status: "invalidated", validation_justification: "Documento insuficiente", validated_at: "2026-07-09T10:00:00.000Z", validated_by: "admin-1" },
        created_at: "2026-07-09T10:00:00.000Z",
      },
    ];

    const [item] = await loadHydratedEvidences(fakeClient([evidence], auditRows), {});

    expect(item?.history).toEqual([
      expect.objectContaining({ id: "audit-current", status: "approved" }),
      expect.objectContaining({
        id: "audit-previous",
        status: "invalidated",
        justification: "Documento insuficiente",
      }),
    ]);
  });
});
