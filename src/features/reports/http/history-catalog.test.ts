import { describe, expect, it } from "vitest";
import { catalogDownloadPath, catalogKindLabel } from "@/features/reports/report-catalog";
import {
  catalogHistoryGroupKey,
  catalogOutdatedReason,
  mapHistoryEntry,
  selectLatestVisibleHistoryEntries,
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

  it("agrupa o bimestral por formulário, ano e bimestre, separado do anual", () => {
    const bimonthly = official({
      report_kind: "bimonthly",
      bimester: 4,
      reference_start_year: 2026,
      reference_end_year: 2026,
    });
    const annual = official({
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      report_kind: "annual",
      bimester: null,
      reference_start_year: 2026,
      reference_end_year: 2026,
    });
    expect(catalogHistoryGroupKey(bimonthly)).not.toBe(catalogHistoryGroupKey(annual));
    expect(catalogHistoryGroupKey(bimonthly)).toBe(
      catalogHistoryGroupKey(official({ report_kind: "bimonthly", bimester: 4, emission_version: 9 })),
    );
    expect(catalogHistoryGroupKey(bimonthly)).not.toBe(
      catalogHistoryGroupKey(official({ report_kind: "bimonthly", bimester: 3 })),
    );
  });

  it("mantém um único card bimestral: a emissão mais recente do formulário + ano + bimestre", () => {
    const v2 = official({
      id: "21111111-1111-4111-8111-111111111111",
      report_kind: "bimonthly",
      bimester: 4,
      emission_version: 2,
      latest_emission_version: 4,
      is_current: false,
      generated_at: "2026-08-31T13:40:00.000Z",
    });
    const v3 = official({
      id: "31111111-1111-4111-8111-111111111111",
      report_kind: "bimonthly",
      bimester: 4,
      emission_version: 3,
      latest_emission_version: 4,
      is_current: false,
      generated_at: "2026-08-31T13:45:00.000Z",
    });
    const v4 = official({
      id: "41111111-1111-4111-8111-111111111111",
      report_kind: "bimonthly",
      bimester: 4,
      emission_version: 4,
      latest_emission_version: 4,
      is_current: true,
      generated_at: "2026-08-31T13:42:00.000Z",
    });

    const visible = selectLatestVisibleHistoryEntries([v3, v2, v4]);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe(v4.id);
    expect(visible[0]?.emission_version).toBe(4);
    expect(mapHistoryEntry(visible[0]!).outdatedReason).toBeNull();
  });

  it("mantém o anual como registro separado e só a emissão anual mais recente", () => {
    const annualV1 = official({
      id: "a1111111-1111-4111-8111-111111111111",
      emission_version: 1,
      latest_emission_version: 2,
      is_current: false,
      generated_at: "2026-08-31T12:00:00.000Z",
    });
    const annualV2 = official({
      id: "a2111111-1111-4111-8111-111111111111",
      emission_version: 2,
      latest_emission_version: 2,
      is_current: true,
      generated_at: "2026-08-31T12:10:00.000Z",
    });
    const bimester4 = official({
      id: "b4111111-1111-4111-8111-111111111111",
      report_kind: "bimonthly",
      bimester: 4,
      emission_version: 4,
      latest_emission_version: 4,
      generated_at: "2026-08-31T13:49:00.000Z",
    });
    const bimester3 = official({
      id: "b3111111-1111-4111-8111-111111111111",
      report_kind: "bimonthly",
      bimester: 3,
      emission_version: 1,
      latest_emission_version: 1,
      generated_at: "2026-06-30T13:00:00.000Z",
    });

    const visible = selectLatestVisibleHistoryEntries([annualV1, annualV2, bimester4, bimester3]);
    expect(visible.map((row) => row.id).sort()).toEqual(
      [annualV2.id, bimester3.id, bimester4.id].sort(),
    );
  });

  it("escolhe a emissão anual do processamento mais novo quando as versões documentais reiniciam", () => {
    const processing1 = official({
      id: "c1111111-1111-4111-8111-111111111111",
      processing_version: 1,
      emission_version: 3,
      latest_emission_version: 3,
      generated_at: "2026-08-01T12:00:00.000Z",
    });
    const processing2 = official({
      id: "c2111111-1111-4111-8111-111111111111",
      processing_version: 2,
      emission_version: 1,
      latest_emission_version: 1,
      generated_at: "2026-08-20T12:00:00.000Z",
    });

    const visible = selectLatestVisibleHistoryEntries([processing1, processing2]);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe(processing2.id);
  });

  it("preserva a emissão anual mais recente mesmo desatualizada, para o filtro de situação", () => {
    const previous = official({
      id: "d1111111-1111-4111-8111-111111111111",
      emission_version: 1,
      latest_emission_version: 2,
      is_current: false,
    });
    const latestOutdated = official({
      id: "d2111111-1111-4111-8111-111111111111",
      emission_version: 2,
      latest_emission_version: 2,
      is_current: false,
      cycle_state: "in_response",
    });

    const visible = selectLatestVisibleHistoryEntries([previous, latestOutdated]);
    expect(visible).toHaveLength(1);
    expect(visible[0]?.id).toBe(latestOutdated.id);
    expect(visible[0]?.is_current).toBe(false);
    expect(visible.filter((row) => row.is_current)).toHaveLength(0);
  });
});
