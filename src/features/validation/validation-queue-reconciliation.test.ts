import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import {
  deriveResponseEvidenceStatus,
  type QueueEvidence,
} from "./queue-model";

/**
 * Regras canônicas da aba Evidências (fonte única):
 * - resposta submetida = yes
 * - critério exige evidência
 * - LEFT JOIN de documentos (ausência não elimina o critério)
 * - paginação/contagem por response_id
 */
function expectedEvidenceQueue(
  rows: Array<{
    responseId: string;
    answer: "yes" | "no" | "not_applicable";
    requiresEvidence: boolean;
    evidenceCount: number;
    documentStatuses?: Array<QueueEvidence["status"]>;
  }>,
) {
  return rows
    .filter((row) => row.answer === "yes" && row.requiresEvidence)
    .map((row) => ({
      responseId: row.responseId,
      status:
        row.evidenceCount === 0
          ? ("not_presented" as const)
          : deriveResponseEvidenceStatus(
              (row.documentStatuses ??
                Array.from(
                  { length: row.evidenceCount },
                  () => "pending" as const,
                )
              ).map((status) => ({ status })),
            ),
    }));
}

describe("reconciliação da fila de validação", () => {
  it("distingue todas as perguntas do diagnóstico da fila de evidências", () => {
    const appliedCriteria = 126;
    const requiresEvidence = 65;
    const yesRequiresEvidence = 21;
    const yesRequiresEvidenceWithoutDocs = 14;
    const yesRequiresEvidenceWithDocs = 7;
    const yesWithoutRequirementWithDocs = 1;

    const queue = expectedEvidenceQueue([
      ...Array.from({ length: yesRequiresEvidenceWithoutDocs }, (_, i) => ({
        responseId: `missing-${i}`,
        answer: "yes" as const,
        requiresEvidence: true,
        evidenceCount: 0,
      })),
      ...Array.from({ length: yesRequiresEvidenceWithDocs }, (_, i) => ({
        responseId: `docs-${i}`,
        answer: "yes" as const,
        requiresEvidence: true,
        evidenceCount: i === 0 ? 2 : 1,
        documentStatuses: i === 0 ? ["pending", "pending"] : ["approved"],
      })),
      {
        responseId: "extra-no-require",
        answer: "yes",
        requiresEvidence: false,
        evidenceCount: 1,
        documentStatuses: ["approved"],
      },
      {
        responseId: "no-answer",
        answer: "no",
        requiresEvidence: true,
        evidenceCount: 1,
        documentStatuses: ["pending"],
      },
    ]);

    expect(queue).toHaveLength(yesRequiresEvidence);
    expect(queue.filter((item) => item.status === "not_presented")).toHaveLength(
      yesRequiresEvidenceWithoutDocs,
    );
    expect(queue.some((item) => item.responseId === "extra-no-require")).toBe(false);
    expect(queue.some((item) => item.responseId === "no-answer")).toBe(false);

    // Inner join legado (só com documento) perde os sem evidência e inclui extras.
    const legacyInnerJoinCount =
      yesRequiresEvidenceWithDocs + yesWithoutRequirementWithDocs;
    expect(legacyInnerJoinCount).toBe(8);
    expect(legacyInnerJoinCount).toBeLessThan(yesRequiresEvidence);
    expect(appliedCriteria).toBeGreaterThan(requiresEvidence);
    expect(requiresEvidence).toBeGreaterThan(yesRequiresEvidence);
  });

  it("preserva a regra SQL da fila (LEFT JOIN + exige evidência)", () => {
    const dir = path.join(process.cwd(), "supabase", "migrations");
    const sql = readdirSync(dir)
      .filter((f) => /^\d{14}_.+\.sql$/.test(f))
      .sort()
      .map((f) => readFileSync(path.join(dir, f), "utf8"))
      .join("\n");
    expect(sql).toContain("left join public.evidences e");
    expect(sql).toContain("r.answer = 'yes'::public.answer_value");
    expect(sql).toContain(
      "coalesce((qv.evidence_parameter->>'required')::boolean, false)",
    );
    expect(sql).toContain("not_presented");
    expect(sql.toLowerCase()).not.toMatch(
      /from public\.responses r\s+join public\.evidences e/,
    );
  });
});
