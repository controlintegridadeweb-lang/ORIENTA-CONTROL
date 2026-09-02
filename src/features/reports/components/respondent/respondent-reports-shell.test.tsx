// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  fetchCatalogReportPdf: vi.fn(),
  downloadPdfBlob: vi.fn(),
  openPdfBlob: vi.fn(),
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("@/features/reports/ui/client", () => ({
  fetchCatalogReportPdf: mocks.fetchCatalogReportPdf,
  downloadPdfBlob: mocks.downloadPdfBlob,
  openPdfBlob: mocks.openPdfBlob,
}));
vi.mock("@/infrastructure/notifications/notify", () => ({
  describeError: (_error: unknown, fallback: string) => fallback,
  notify: {
    loading: vi.fn(() => "notification"),
    success: mocks.notifySuccess,
    error: mocks.notifyError,
  },
}));
vi.mock("@/features/reports/ui/use-report-history", () => ({
  useReportHistory: () => ({
    history: [
      {
        id: "report-a",
        downloadPath: "a.pdf",
        formName: "Diagnóstico",
        processingVersion: 1,
        policyVersion: "v3",
        emissionVersion: 1,
        catalogKind: "annual",
      },
    ],
    loading: false,
    filters: {
      search: "",
      status: "",
      kind: "",
      from: "",
      to: "",
      yearPreset: null,
      cycleId: "",
    },
    setFilters: vi.fn(),
    filteredHistory: [
      {
        id: "report-a",
        downloadPath: "a.pdf",
        formName: "Diagnóstico",
        processingVersion: 1,
        policyVersion: "v3",
        emissionVersion: 1,
        catalogKind: "annual",
      },
    ],
    reportHistoryYears: [],
    total: 1,
    offset: 0,
    pageSize: 25,
    hasMore: false,
    error: null,
    previousPage: vi.fn(),
    nextPage: vi.fn(),
    refresh: vi.fn(),
  }),
}));
vi.mock("./respondent-reports-hero", () => ({ RespondentReportsHero: () => null }));
vi.mock("./respondent-reports-filters", () => ({
  INITIAL_HISTORY_FILTERS: {},
  RespondentReportsFilters: () => null,
}));
vi.mock("./respondent-reports-history-list", () => ({
  RespondentReportsHistoryList: ({
    items,
    onDownload,
  }: {
    items: Array<{ id: string }>;
    onDownload: (row: unknown) => void;
  }) => (
    <div>
      {items.map((row) => (
        <button key={row.id} onClick={() => onDownload(row)}>
          Baixar {row.id}
        </button>
      ))}
    </div>
  ),
}));
vi.mock("./respondent-reports-empty-state", () => ({ RespondentReportsEmptyState: () => null }));
vi.mock("@/shared/ui/components/panel-section", () => ({
  PanelSection: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));

import { RespondentReportsShell } from "./respondent-reports-shell";

describe("RespondentReportsShell", () => {
  beforeEach(() => {
    mocks.fetchCatalogReportPdf.mockReset();
    mocks.downloadPdfBlob.mockReset();
    mocks.openPdfBlob.mockReset();
    mocks.notifySuccess.mockReset();
    mocks.notifyError.mockReset();
  });

  it("baixa o PDF da emissão listada", async () => {
    const blob = new Blob(["pdf"], { type: "application/pdf" });
    mocks.fetchCatalogReportPdf.mockResolvedValue(blob);

    render(<RespondentReportsShell />);
    fireEvent.click(screen.getByRole("button", { name: "Baixar report-a" }));

    await waitFor(() => {
      expect(mocks.fetchCatalogReportPdf).toHaveBeenCalledWith("a.pdf");
      expect(mocks.downloadPdfBlob).toHaveBeenCalledWith(blob, expect.stringContaining("relatorio-orienta-diagnostico"));
    });
  });
});
