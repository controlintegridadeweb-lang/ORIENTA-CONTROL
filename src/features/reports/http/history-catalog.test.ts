import { describe, expect, it } from "vitest";
import { catalogDownloadPath, catalogKindLabel } from "@/features/reports/report-catalog";
import {
  catalogOutdatedReason,
  mapHistoryEntry,
  type ReportHistoryEntryRow,
} from "./history-catalog";

function official(over: Partial<ReportHistoryEntryRow> = {}): ReportHistoryEntryRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    cycle_id: "22222222-2222-4222-8222-222222222222",
    cycle_processing_id: "33333333-3333-4333-8333-333333333333",
    generated_by: "44444444-4444-4444-8444-444444444444",
    generated_by_name: "Mauricio",
    generated_at: "2026-08-24T14:45:00.000Z",
    emission_version: 1,
    reissue_reason: null,
    processing_version: 1,
    fami_policy_version: "v7",
    organization_id: "55555555-5555-4555-8555-555555555555",
    period_label: "2026.1",
    form_id: "66666666-6666-4666-8666-666666666666",
    form_version: 1,
    form_name: "Diagnóstico",
    latest_processing_version: 1,
    latest_emission_version: 1,
    is_current: true,
    file_sha256: "a".repeat(64),
    content_sha256: "b".repeat(64),
    file_size_bytes: 1024,
    reference_start_year: 2026,
    reference_end_year: 2026,
    cycle_state: "completed",
    report_action_plan_revision: 0,
    current_action_plan_revision: 0,
    current_reference_start_year: 2026,
    current_reference_end_year: 2026,
    report_kind: "annual",
    bimester: null,
    generation_kind: null,
    ...over,
  };
}

describe("catálogo do histórico de relatórios", () => {
  it("separa o download anual persistido do export bimestral sob demanda", () => {
    expect(catalogDownloadPath("annual", "11111111-1111-4111-8111-111111111111")).toBe(
      "/api/reports/11111111-1111-4111-8111-111111111111/download",
    );
    expect(catalogDownloadPath("bimonthly", "11111111-1111-4111-8111-111111111111")).toBe(
      "/api/monitoring/bimonthly/11111111-1111-4111-8111-111111111111/export?format=pdf",
    );
  });

  it("apresenta os tipos com o vocabulário oficial", () => {
    expect(catalogKindLabel("annual")).toBe("Relatório anual");
    expect(catalogKindLabel("annual", 2026)).toBe("Relatório anual 2026");
    expect(catalogKindLabel("bimonthly")).toBe("Relatório bimestral");
  });

  it("não marca a emissão anual vigente como desatualizada", () => {
    expect(catalogOutdatedReason(official())).toBeNull();
  });

  it("explica a substituição da versão bimestral anterior", () => {
    expect(
      catalogOutdatedReason(
        official({
          report_kind: "bimonthly",
          is_current: false,
          emission_version: 1,
          latest_emission_version: 2,
          bimester: 2,
          generation_kind: "manual",
          file_sha256: null,
        }),
      ),
    ).toBe("Esta emissão foi substituída por uma versão posterior.");
  });

  it("projeta o item do catálogo com tipo e caminho de download", () => {
    const item = mapHistoryEntry(
      official({
        report_kind: "bimonthly",
        period_label: "2º bimestre de 2026",
        bimester: 2,
        generation_kind: "automatic",
        file_sha256: null,
      }),
    );
    expect(item.catalogKind).toBe("bimonthly");
    expect(item.bimester).toBe(2);
    expect(item.downloadPath).toContain("/api/monitoring/bimonthly/");
  });
});
