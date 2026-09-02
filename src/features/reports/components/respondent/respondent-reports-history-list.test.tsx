// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RespondentReportHistoryRow } from "@/features/reports/ui/respondent-presentation";
import { mapHistoryEntry, selectLatestVisibleHistoryEntries, type ReportHistoryEntryRow } from "@/features/reports/http/history-catalog";
import { RespondentReportsHistoryList } from "./respondent-reports-history-list";

afterEach(() => {
  cleanup();
});

function official(over: Partial<ReportHistoryEntryRow> = {}): ReportHistoryEntryRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    cycle_id: "22222222-2222-4222-8222-222222222222",
    cycle_processing_id: "33333333-3333-4333-8333-333333333333",
    generated_by: "44444444-4444-4444-8444-444444444444",
    generated_by_name: "Mauricio",
    generated_at: "2026-08-31T13:49:00.000Z",
    emission_version: 4,
    reissue_reason: null,
    processing_version: 1,
    fami_policy_version: "v7",
    organization_id: "55555555-5555-4555-8555-555555555555",
    period_label: "4º bimestre de 2026",
    form_id: "66666666-6666-4666-8666-666666666666",
    form_version: 1,
    form_name: "Diagnóstico de Integridade 2026",
    latest_processing_version: 1,
    latest_emission_version: 4,
    is_current: true,
    file_sha256: null,
    content_sha256: null,
    file_size_bytes: null,
    reference_start_year: 2026,
    reference_end_year: 2026,
    cycle_state: "completed",
    report_action_plan_revision: null,
    current_action_plan_revision: 0,
    current_reference_start_year: 2026,
    current_reference_end_year: 2026,
    report_kind: "bimonthly",
    bimester: 4,
    generation_kind: "manual",
    ...over,
  };
}

function asListRow(row: ReportHistoryEntryRow): RespondentReportHistoryRow {
  const item = mapHistoryEntry(row);
  return {
    ...item,
    formTemplateVersion: item.formVersion,
    generatedBy: item.generatedBy ?? "",
    format: "pdf",
    reportKind: "executive",
    status: "completed",
  };
}

describe("RespondentReportsHistoryList", () => {
  it("mostra um único card para várias emissões do mesmo formulário, ano e bimestre", () => {
    const visible = selectLatestVisibleHistoryEntries([
      official({
        id: "21111111-1111-4111-8111-111111111111",
        emission_version: 2,
        latest_emission_version: 4,
        is_current: false,
        generated_at: "2026-08-31T13:40:00.000Z",
      }),
      official({
        id: "31111111-1111-4111-8111-111111111111",
        emission_version: 3,
        latest_emission_version: 4,
        is_current: false,
        generated_at: "2026-08-31T13:45:00.000Z",
      }),
      official({
        id: "41111111-1111-4111-8111-111111111111",
        emission_version: 4,
        latest_emission_version: 4,
        is_current: true,
        generated_at: "2026-08-31T13:49:00.000Z",
      }),
    ]);

    render(
      <RespondentReportsHistoryList
        items={visible.map(asListRow)}
        onDownload={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("heading", { name: "Diagnóstico de Integridade 2026" })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Baixar" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Abrir PDF" })).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Emissão").className).toContain("text-slate-600");
    expect(screen.getByText("v4").className).toContain("text-slate-900");
    expect(screen.getByText("Bimestre").className).toContain("text-slate-600");
    expect(screen.getByText("4º").className).toContain("text-slate-900");
    expect(screen.queryByText("v3")).toBeNull();
    expect(screen.queryByText("v2")).toBeNull();
    expect(screen.queryByText("Versão anterior")).toBeNull();
    expect(screen.queryByText("Esta emissão foi substituída por uma versão posterior.")).toBeNull();
  });

  it("não navega para uma rota inexistente ao abrir o PDF", () => {
    render(
      <RespondentReportsHistoryList
        items={[asListRow(official({ report_kind: "annual", bimester: null, period_label: "2026" }))]}
        onDownload={vi.fn()}
        onOpen={vi.fn()}
      />,
    );

    expect(screen.queryByRole("link", { name: /emissão imutável/i })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByRole("button", { name: "Abrir PDF" })).toBeTruthy();
  });
});
