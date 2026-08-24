// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ReportHistoryOption } from "@/features/reports/ui/client";
import { createInitialReportsState } from "./reports-controller-model";
import { ReportHistorySection } from "./report-history-section";
import type { ReportsController } from "./use-reports-controller";

afterEach(() => {
  cleanup();
});

function report(over: Partial<ReportHistoryOption> = {}): ReportHistoryOption {
  return {
    id: "report-1",
    cycleId: "cycle-1",
    cycleProcessingId: "proc-1",
    organizationId: "org-1",
    processingVersion: 1,
    policyVersion: "v7",
    latestProcessingVersion: 1,
    emissionVersion: 1,
    latestEmissionVersion: 1,
    isCurrent: true,
    formId: "form-1",
    formName: "teste",
    formVersion: 1,
    periodLabel: "2 semestre",
    generatedAt: "2026-08-24T14:45:00.000Z",
    generatedBy: "user-1",
    generatedByLabel: "Mauricio",
    reissueReason: null,
    referenceStartYear: 2026,
    referenceEndYear: 2026,
    fileSha256: "ef1a7ba8939dd124abcdef",
    contentSha256: "bb".repeat(32),
    fileSizeBytes: 1024,
    outdatedReason: null,
    downloadPath: "/reports/report-1",
    ...over,
  };
}

function controller(over: Partial<ReportsController["state"]> = {}): ReportsController {
  return {
    state: {
      ...createInitialReportsState({
        initialOrganizationId: "org-1",
        initialCycleId: "cycle-1",
        initialHistoryOffset: 0,
      }),
      loadingScopes: false,
      history: [report()],
      historyTotal: 1,
      ...over,
    },
    loadHistory: vi.fn(),
    changeHistoryPage: vi.fn(),
    download: vi.fn(),
  } as unknown as ReportsController;
}

describe("ReportHistorySection", () => {
  it("apresenta a emissão com a hierarquia visual dos demais cards institucionais", () => {
    render(<ReportHistorySection controller={controller()} />);

    expect(screen.getByRole("heading", { name: "Histórico de emissões" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "teste" })).toBeTruthy();
    expect(screen.getByText("Emissão")).toBeTruthy();
    expect(screen.getByText("v1")).toBeTruthy();
    expect(screen.getByText("Processamento")).toBeTruthy();
    expect(screen.getByText("nº 1")).toBeTruthy();
    expect(screen.getByText("Política FAMI")).toBeTruthy();
    expect(screen.getByText("v7")).toBeTruthy();
    expect(screen.getByText("SHA-256")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Baixar" })).toBeTruthy();
    expect(screen.queryByText("Versão anterior")).toBeNull();
  });

  it("dispara o download da emissão listada", () => {
    const view = controller();
    render(<ReportHistorySection controller={view} />);

    fireEvent.click(screen.getByRole("button", { name: "Baixar" }));
    expect(view.download).toHaveBeenCalledWith(view.state.history[0]);
  });
});
