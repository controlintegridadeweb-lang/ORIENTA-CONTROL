import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  RecommendationsAdminService,
  RecommendationsNotFoundError,
} from "./admin-service";

const fetchRecommendationById = vi.fn();

vi.mock("./cycle-read-model", () => ({
  fetchRecommendationById: (...args: unknown[]) => fetchRecommendationById(...args),
}));

describe("RecommendationsAdminService", () => {
  beforeEach(() => {
    fetchRecommendationById.mockReset();
  });

  it("retorna not found para recomendação inexistente", async () => {
    fetchRecommendationById.mockResolvedValue(null);
    const svc = new RecommendationsAdminService({} as never);
    await expect(svc.get("rec-1")).rejects.toBeInstanceOf(RecommendationsNotFoundError);
  });

  it("mantém a recomendação imutável ao não expor operação de atualização", () => {
    const svc = new RecommendationsAdminService({} as never) as unknown as Record<string, unknown>;
    expect(svc.update).toBeUndefined();
  });
});
