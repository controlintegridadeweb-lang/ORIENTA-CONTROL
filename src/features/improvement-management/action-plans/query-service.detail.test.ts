import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const loadRecommendationScopeMock = vi.fn();
const queryRowsMock = vi.fn();
const toListItemMock = vi.fn((row: { id: string }) => ({
  recommendationId: row.id,
}));

vi.mock("./cycle-read-model", () => ({
  loadRecommendationScope: (...args: unknown[]) =>
    loadRecommendationScopeMock(...args),
  queryActionPlanRecommendationRows: (...args: unknown[]) =>
    queryRowsMock(...args),
}));

vi.mock("./mappers", () => ({
  toListItem: (row: { id: string }) => toListItemMock(row),
}));

import { ActionPlansQueryService } from "./query-service";

const recommendationId = "123e4567-e89b-12d3-a456-426614174000";
const cycleId = "223e4567-e89b-12d3-a456-426614174000";
const organizationId = "323e4567-e89b-12d3-a456-426614174000";

function service(): ActionPlansQueryService {
  return new ActionPlansQueryService({} as SupabaseClient);
}

describe("ActionPlansQueryService.getByRecommendation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadRecommendationScopeMock.mockResolvedValue({
      recommendationId,
      cycleId,
      organizationId,
      formId: "423e4567-e89b-12d3-a456-426614174000",
      questionId: "523e4567-e89b-12d3-a456-426614174000",
      axisId: "623e4567-e89b-12d3-a456-426614174000",
      cycleState: "validated",
    });
  });

  it("seleciona o ID solicitado sem depender da primeira linha retornada", async () => {
    queryRowsMock.mockResolvedValue([
      { id: "723e4567-e89b-12d3-a456-426614174000" },
      { id: recommendationId },
    ]);

    const item = await service().getByRecommendation(recommendationId, {
      role: "respondent",
      organizationId,
    });

    expect(queryRowsMock).toHaveBeenCalledWith(expect.anything(), {
      recommendationId,
      cycleId,
      organizationId,
    });
    expect(toListItemMock).toHaveBeenCalledWith({ id: recommendationId });
    expect(item).toEqual({ recommendationId });
  });

  it("não revela recomendação de outra organização ao respondente", async () => {
    await expect(
      service().getByRecommendation(recommendationId, {
        role: "respondent",
        organizationId: "823e4567-e89b-12d3-a456-426614174000",
      }),
    ).rejects.toThrow(/não encontrado/i);

    expect(queryRowsMock).not.toHaveBeenCalled();
  });
});
