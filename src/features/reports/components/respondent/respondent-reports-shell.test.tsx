// @vitest-environment jsdom

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  fetchPersistedReportPdf: vi.fn(),
  revokeObjectURL: vi.fn(),
  createObjectURL: vi.fn(),
  notifyError: vi.fn(),
}));

vi.mock("@/features/reports/ui/client", () => ({
  fetchPersistedReportPdf: mocks.fetchPersistedReportPdf,
  downloadPdfBlob: vi.fn(),
}));
vi.mock("@/infrastructure/notifications/notify", () => ({
  describeError: (_error: unknown, fallback: string) => fallback,
  notify: {
    loading: vi.fn(() => "notification"),
    success: vi.fn(),
    error: mocks.notifyError,
  },
}));
vi.mock("@/features/reports/ui/use-report-history", () => ({
  useReportHistory: () => ({
    history: [
      { id: "report-a", downloadPath: "a.pdf", formName: "A", processingVersion: 1, policyVersion: "v3", emissionVersion: 1 },
      { id: "report-b", downloadPath: "b.pdf", formName: "B", processingVersion: 1, policyVersion: "v3", emissionVersion: 1 },
    ],
    loading: false,
    filters: {},
    setFilters: vi.fn(),
    filteredHistory: [
      { id: "report-a", downloadPath: "a.pdf", formName: "A", processingVersion: 1, policyVersion: "v3", emissionVersion: 1 },
      { id: "report-b", downloadPath: "b.pdf", formName: "B", processingVersion: 1, policyVersion: "v3", emissionVersion: 1 },
    ],
    reportHistoryYears: [],
    total: 2,
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
  RespondentReportsHistoryList: ({ items, onPreview }: { items: Array<{ id: string }>; onPreview: (row: unknown) => void }) => (
    <div>{items.map((row) => <button key={row.id} onClick={() => onPreview(row)}>Abrir {row.id}</button>)}</div>
  ),
}));
vi.mock("./respondent-reports-preview-drawer", () => ({
  RespondentReportsPreviewDrawer: ({ row, previewUrl }: { row: { id: string } | null; previewUrl: string | null }) => (
    <output data-testid="preview">{row?.id ?? "none"}:{previewUrl ?? "loading"}</output>
  ),
}));
vi.mock("./respondent-reports-empty-state", () => ({ RespondentReportsEmptyState: () => null }));
vi.mock("@/shared/ui/components/panel-section", () => ({ PanelSection: ({ children }: { children: ReactNode }) => <section>{children}</section> }));

import { RespondentReportsShell } from "./respondent-reports-shell";

describe("RespondentReportsShell — preview concorrente", () => {
  beforeEach(() => {
    mocks.fetchPersistedReportPdf.mockReset();
    mocks.revokeObjectURL.mockReset();
    mocks.createObjectURL.mockReset();
    mocks.notifyError.mockReset();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: mocks.createObjectURL });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: mocks.revokeObjectURL });
  });

  it("mantém o PDF do relatório mais recente e revoga a URL obsoleta", async () => {
    let resolveA!: (blob: Blob) => void;
    let resolveB!: (blob: Blob) => void;
    mocks.fetchPersistedReportPdf
      .mockReturnValueOnce(new Promise((resolve) => { resolveA = resolve; }))
      .mockReturnValueOnce(new Promise((resolve) => { resolveB = resolve; }));
    mocks.createObjectURL
      .mockReturnValueOnce("blob:b")
      .mockReturnValueOnce("blob:a");

    render(<RespondentReportsShell />);
    fireEvent.click(screen.getByRole("button", { name: "Abrir report-a" }));
    fireEvent.click(screen.getByRole("button", { name: "Abrir report-b" }));

    await act(async () => resolveB(new Blob(["b"], { type: "application/pdf" })));
    await waitFor(() => expect(screen.getByTestId("preview").textContent).toBe("report-b:blob:b"));

    await act(async () => resolveA(new Blob(["a"], { type: "application/pdf" })));

    expect(screen.getByTestId("preview").textContent).toBe("report-b:blob:b");
    expect(mocks.revokeObjectURL).toHaveBeenCalledWith("blob:a");
  });
});
