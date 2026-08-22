import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listRespondentActionPlans: vi.fn(),
}));

vi.mock("@/features/improvement-management/action-plans/client", () => ({
  listRespondentActionPlans: mocks.listRespondentActionPlans,
}));

import {
  getRespondentOverviewItems,
  invalidateRespondentOverviewCache,
} from "./cache";

function item(index: number) {
  return { recommendationId: `recommendation-${index}` } as never;
}

describe("respondent-overview-cache", () => {
  beforeEach(() => {
    mocks.listRespondentActionPlans.mockReset();
    invalidateRespondentOverviewCache();
  });

  it("carrega todas as páginas além do limite de 200 itens", async () => {
    mocks.listRespondentActionPlans
      .mockResolvedValueOnce({
        items: Array.from({ length: 200 }, (_, index) => item(index)),
        total: 250,
      })
      .mockResolvedValueOnce({
        items: Array.from({ length: 50 }, (_, index) => item(index + 200)),
        total: 250,
      });

    const rows = await getRespondentOverviewItems({ force: true });

    expect(rows).toHaveLength(250);
    expect(mocks.listRespondentActionPlans).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ limit: 200, offset: 0 }),
    );
    expect(mocks.listRespondentActionPlans).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ limit: 200, offset: 200 }),
    );
  });

  it("trata lista vazia como cache válido dentro do TTL", async () => {
    mocks.listRespondentActionPlans.mockResolvedValue({ items: [], total: 0 });

    await getRespondentOverviewItems({ force: true });
    await getRespondentOverviewItems();

    expect(mocks.listRespondentActionPlans).toHaveBeenCalledTimes(1);
  });

  it("não restaura cache antigo quando uma requisição invalidada termina depois", async () => {
    let resolveOld!: (value: { items: never[]; total: number }) => void;
    const oldPage = new Promise<{ items: never[]; total: number }>((resolve) => {
      resolveOld = resolve;
    });

    mocks.listRespondentActionPlans
      .mockReturnValueOnce(oldPage)
      .mockResolvedValueOnce({ items: [item(2)], total: 1 });

    const oldRequest = getRespondentOverviewItems({ force: true });
    invalidateRespondentOverviewCache();
    const currentRows = await getRespondentOverviewItems({ force: true });

    resolveOld({ items: [item(1)], total: 1 });
    await oldRequest;

    const cachedRows = await getRespondentOverviewItems();
    expect(currentRows[0]).toMatchObject({ recommendationId: "recommendation-2" });
    expect(cachedRows[0]).toMatchObject({ recommendationId: "recommendation-2" });
    expect(mocks.listRespondentActionPlans).toHaveBeenCalledTimes(2);
  });
});
