import { describe, expect, it } from "vitest";
import {
  evidenceExportFiltersFromSearchParams,
  evidenceListFiltersFromSearchParams,
  evidenceStatsFiltersFromSearchParams,
} from "./http-filters";

const URL_WITH_ALL_FILTERS = new URL(
  "https://orienta.test/api/admin/evidences" +
    "?cycleId=cycle-1&questionId=question-1&formId=form-1" +
    "&organizationId=org-1&status=approved&search=ata" +
    "&from=2026-01-01T00%3A00%3A00.000Z&to=2026-12-31T23%3A59%3A59.999Z" +
    "&ids=id-1%2Cid-2&limit=25&offset=50",
);

describe("filtros HTTP de evidências", () => {
  it("preserva ciclo e pergunta na exportação", () => {
    const filters = evidenceExportFiltersFromSearchParams(
      URL_WITH_ALL_FILTERS.searchParams,
    );

    expect(filters).toMatchObject({
      cycleId: "cycle-1",
      questionId: "question-1",
      formId: "form-1",
      organizationId: "org-1",
      status: "approved",
    });
    expect(filters).not.toHaveProperty("limit");
    expect(filters).not.toHaveProperty("offset");
  });

  it("mantém o mesmo escopo na lista e inclui paginação", () => {
    expect(evidenceListFiltersFromSearchParams(URL_WITH_ALL_FILTERS.searchParams)).toMatchObject({
      cycleId: "cycle-1",
      questionId: "question-1",
      limit: "25",
      offset: "50",
    });
  });

  it("indicadores preservam o escopo, mas não filtram pelo próprio status", () => {
    const filters = evidenceStatsFiltersFromSearchParams(
      URL_WITH_ALL_FILTERS.searchParams,
    );

    expect(filters).toMatchObject({
      cycleId: "cycle-1",
      questionId: "question-1",
      formId: "form-1",
      organizationId: "org-1",
    });
    expect(filters).not.toHaveProperty("status");
  });
});
