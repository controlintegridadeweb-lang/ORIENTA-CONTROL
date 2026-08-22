// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RespondentStatsResult } from "@/features/evidences/respondent-service";

const mocks = vi.hoisted(() => ({
  getRespondentEvidenceStats: vi.fn(),
}));

vi.mock("@/features/evidences/respondent-client", () => ({
  getRespondentEvidenceStats: mocks.getRespondentEvidenceStats,
}));

import { useRespondentStats } from "./use-respondent-stats";

const success: RespondentStatsResult = {
  enviadas: 4,
  aprovadas: 2,
  aguardando: 1,
  reprovadas: 0,
  complementacao: 1,
  overall: "action_required",
  hasPendency: true,
};

describe("useRespondentStats", () => {
  beforeEach(() => {
    mocks.getRespondentEvidenceStats.mockReset();
  });

  it("não transforma falha de leitura em indicadores zerados", async () => {
    mocks.getRespondentEvidenceStats.mockRejectedValueOnce(new Error("rede indisponível"));

    const { result } = renderHook(() => useRespondentStats({}));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.stats).toBeNull();
    expect(result.current.error).toBe("rede indisponível");
  });

  it("recupera os indicadores ao tentar novamente", async () => {
    mocks.getRespondentEvidenceStats
      .mockRejectedValueOnce(new Error("falha temporária"))
      .mockResolvedValueOnce(success);

    const { result } = renderHook(() => useRespondentStats({}));

    await waitFor(() => expect(result.current.error).toBe("falha temporária"));

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.stats).toEqual(success);
  });

  it("mantém os indicadores do filtro mais recente", async () => {
    let resolveOld!: (value: RespondentStatsResult) => void;
    let resolveCurrent!: (value: RespondentStatsResult) => void;
    mocks.getRespondentEvidenceStats
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveCurrent = resolve; }));

    const { result, rerender } = renderHook(
      ({ search }) => useRespondentStats({ search }),
      { initialProps: { search: "antigo" } },
    );
    rerender({ search: "atual" });

    await act(async () => {
      resolveCurrent({ ...success, enviadas: 8 });
    });
    await waitFor(() => expect(result.current.stats?.enviadas).toBe(8));

    await act(async () => {
      resolveOld({ ...success, enviadas: 1 });
    });

    expect(result.current.stats?.enviadas).toBe(8);
  });
});
