// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RespondentReportHistoryRow } from "./respondent-presentation";

const mocks = vi.hoisted(() => ({
  listRespondentReports: vi.fn(),
  notifyError: vi.fn(),
  replace: vi.fn(),
  params: new URLSearchParams(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/respondente/relatorios",
  useSearchParams: () => mocks.params,
}));

vi.mock("@/features/reports/ui/respondent-client", () => ({
  listRespondentReports: mocks.listRespondentReports,
}));

vi.mock("@/infrastructure/notifications/notify", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/notifications/notify")>();
  return {
    ...actual,
    notify: { ...actual.notify, error: mocks.notifyError },
  };
});

import { useReportHistory } from "./use-report-history";

function row(id: string): RespondentReportHistoryRow {
  return {
    id,
    cycleId: "cycle-1",
    formId: "form-1",
    formName: id,
    periodLabel: "2026",
    formTemplateVersion: 1,
    organizationId: "org-1",
    processingVersion: 1,
    policyVersion: "v3",
    latestProcessingVersion: 1,
    emissionVersion: 1,
    latestEmissionVersion: 1,
    isCurrent: true,
    reissueReason: null,
    referenceStartYear: 2026,
    referenceEndYear: 2026,
    fileSha256: "a".repeat(64),
    contentSha256: "b".repeat(64),
    fileSizeBytes: 1024,
    outdatedReason: null,
    generatedBy: "admin",
    generatedByLabel: "Administrador",
    downloadPath: `/reports/${id}`,
    generatedAt: "2026-07-10T12:00:00.000Z",
    format: "pdf",
    reportKind: "executive",
    catalogKind: "annual",
    bimester: null,
    generationKind: null,
    status: "completed",
  };
}

function page(items: RespondentReportHistoryRow[]) {
  return {
    items,
    total: items.length,
    limit: 25,
    offset: 0,
    hasMore: false,
    availableYears: [2026],
  };
}

describe("useReportHistory", () => {
  beforeEach(() => {
    mocks.listRespondentReports.mockReset();
    mocks.notifyError.mockReset();
    mocks.replace.mockReset();
    mocks.params = new URLSearchParams();
  });

  it("ignora uma página antiga que termina depois do filtro atual", async () => {
    let resolveOld!: (value: ReturnType<typeof page>) => void;
    let resolveCurrent!: (value: ReturnType<typeof page>) => void;
    mocks.listRespondentReports
      .mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveCurrent = resolve; }));

    const { result } = renderHook(() => useReportHistory());

    act(() => {
      result.current.setFilters({ ...result.current.filters, search: "atual" });
    });

    await act(async () => {
      resolveCurrent(page([row("current")]));
    });
    await waitFor(() => expect(result.current.history[0]?.id).toBe("current"));

    await act(async () => {
      resolveOld(page([row("old")]));
    });

    expect(result.current.history[0]?.id).toBe("current");
  });

  it("preserva o histórico válido quando a atualização falha", async () => {
    mocks.listRespondentReports
      .mockResolvedValueOnce(page([row("persisted")]))
      .mockRejectedValueOnce(new Error("serviço indisponível"));

    const { result } = renderHook(() => useReportHistory());
    await waitFor(() => expect(result.current.history[0]?.id).toBe("persisted"));

    await act(async () => {
      await result.current.refresh();
    });

    expect(result.current.history[0]?.id).toBe("persisted");
    expect(result.current.error).toBe("serviço indisponível");
  });
});
