import { describe, expect, it } from "vitest";
import type { ActionPlanDocument } from "@/features/improvement-management/action-plans/domain-model";
import {
  summarizeActionDocuments,
} from "./summarize-action-documents";

function document(over: Partial<ActionPlanDocument> = {}): ActionPlanDocument {
  return {
    id: "doc-1",
    actionRevision: 1,
    kind: "file",
    title: "Comprovante",
    externalLink: null,
    originalFilename: "arquivo.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    fileValidationStatus: "valid",
    validatedAt: "2026-08-13T10:00:00Z",
    createdAt: "2026-08-13T10:00:00Z",
    isCurrentRevision: true,
    ...over,
  };
}

describe("summarizeActionDocuments", () => {
  it("ignora revisões anteriores e não inventa resumo vazio", () => {
    expect(
      summarizeActionDocuments([
        document({ id: "old", isCurrentRevision: false, createdAt: "2026-08-14T10:00:00Z" }),
      ]),
    ).toEqual({ current: [], recent: [], line: null });
  });

  it("resume a revisão atual e limita a lista recente", () => {
    const summary = summarizeActionDocuments([
      document({ id: "a", createdAt: "2026-08-13T12:00:00Z", fileValidationStatus: "rejected" }),
      document({ id: "b", createdAt: "2026-08-13T11:00:00Z" }),
      document({ id: "c", createdAt: "2026-08-13T10:00:00Z" }),
      document({ id: "d", createdAt: "2026-08-13T09:00:00Z" }),
    ]);

    expect(summary.line).toBe("4 comprovações · 1 formato rejeitado");
    expect(summary.recent.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });
});
