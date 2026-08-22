// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadFamiCycles: vi.fn(),
  loadFamiSnapshot: vi.fn(),
  loadRecommendationFilters: vi.fn(),
  getRespondentEvidenceStats: vi.fn(),
  getRespondentOverviewItems: vi.fn(),
}));

vi.mock("@/features/fami/client", () => ({
  loadFamiCycles: mocks.loadFamiCycles,
  loadFamiSnapshot: mocks.loadFamiSnapshot,
}));
vi.mock("@/features/improvement-management/recommendations/client", () => ({
  loadRecommendationFilters: mocks.loadRecommendationFilters,
}));
vi.mock("@/features/evidences/respondent-client", () => ({
  getRespondentEvidenceStats: mocks.getRespondentEvidenceStats,
}));
vi.mock("@/features/improvement-management/action-plans", () => ({
  getRespondentOverviewItems: mocks.getRespondentOverviewItems,
}));
vi.mock("@/features/improvement-management/recommendations/respondent-presentation", () => ({
  toRespondentItem: (item: unknown) => item,
}));

import { useRespondentFami } from "./use-respondent-fami";

const cycles = [
  { id: "cycle-1", formId: "form-1", formName: "Form 1" },
  { id: "cycle-2", formId: "form-2", formName: "Form 2" },
];

describe("useRespondentFami", () => {
  beforeEach(() => {
    mocks.loadFamiCycles.mockReset().mockResolvedValue(cycles);
    mocks.loadFamiSnapshot.mockReset();
    mocks.loadRecommendationFilters.mockReset().mockResolvedValue({
      organizations: [{ id: "org-1", name: "Org" }],
      forms: [],
    });
    mocks.getRespondentEvidenceStats.mockReset().mockResolvedValue(null);
    mocks.getRespondentOverviewItems.mockReset().mockResolvedValue([]);
  });

  it("mantém o snapshot do diagnóstico mais recente", async () => {
    let resolveOld!: (value: unknown) => void;
    let resolveCurrent!: (value: unknown) => void;
    mocks.loadFamiSnapshot
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveCurrent = resolve; }));

    const { result } = renderHook(() => useRespondentFami("org-1", "cycle-1"));
    await waitFor(() => expect(mocks.loadFamiSnapshot).toHaveBeenCalledTimes(1));

    act(() => result.current.setScopeId("cycle-2"));
    await waitFor(() => expect(mocks.loadFamiSnapshot).toHaveBeenCalledTimes(2));

    await act(async () => {
      resolveCurrent({ marker: "current" });
    });
    await waitFor(() => expect(result.current.state.cycleScoped).toEqual({ marker: "current" }));

    await act(async () => {
      resolveOld({ marker: "old" });
    });

    expect(result.current.state.cycleScoped).toEqual({ marker: "current" });
    expect(result.current.state.error).toBeNull();
  });
});
