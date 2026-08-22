// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EvidencesListResult } from "@/features/evidences/types";

const mocks = vi.hoisted(() => ({
  listEvidences: vi.fn(),
}));

vi.mock("@/features/evidences/client", () => ({
  listEvidences: mocks.listEvidences,
}));

import { useEvidencesList } from "./use-evidences-list";

const emptyResult: EvidencesListResult = {
  items: [],
  total: 0,
  limit: 25,
  offset: 0,
};

describe("useEvidencesList", () => {
  beforeEach(() => {
    mocks.listEvidences.mockReset();
  });

  it("mantém erro separado do estado vazio", async () => {
    mocks.listEvidences.mockRejectedValueOnce(new Error("serviço indisponível"));

    const { result } = renderHook(() =>
      useEvidencesList({ limit: 25, offset: 0 }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe("serviço indisponível");
  });

  it("limpa o erro depois de uma nova tentativa bem-sucedida", async () => {
    mocks.listEvidences
      .mockRejectedValueOnce(new Error("falha temporária"))
      .mockResolvedValueOnce(emptyResult);

    const { result } = renderHook(() =>
      useEvidencesList({ limit: 25, offset: 0 }),
    );

    await waitFor(() => expect(result.current.error).toBe("falha temporária"));

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.error).toBeNull();
    expect(result.current.result).toEqual(emptyResult);
  });

  it("ignora a resposta de filtros antigos que termina depois", async () => {
    let resolveOld!: (value: EvidencesListResult) => void;
    let resolveCurrent!: (value: EvidencesListResult) => void;
    mocks.listEvidences
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveCurrent = resolve; }));

    const { result, rerender } = renderHook(
      ({ search }) => useEvidencesList({ search, limit: 25, offset: 0 }),
      { initialProps: { search: "antigo" } },
    );

    rerender({ search: "atual" });

    await act(async () => {
      resolveCurrent({ ...emptyResult, total: 2 });
    });
    await waitFor(() => expect(result.current.result?.total).toBe(2));

    await act(async () => {
      resolveOld({ ...emptyResult, total: 1 });
    });

    expect(result.current.result?.total).toBe(2);
    expect(result.current.loading).toBe(false);
  });
});
