import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildOfficialReportPdf } = vi.hoisted(() => ({
  buildOfficialReportPdf: vi.fn(),
}));

vi.mock("@/features/reports/pdf/pdf", () => ({ buildOfficialReportPdf }));

import {
  OfficialReportPersistError,
  persistOfficialReport,
} from "./persist-official-report";
import type { OfficialReportData } from "@/features/reports/pdf/report-types";

const data = {
  organizationId: "44444444-4444-4444-8444-444444444444",
  cycleId: "11111111-1111-4111-8111-111111111111",
  cycleProcessingId: "22222222-2222-4222-8222-222222222222",
  formId: "55555555-5555-4555-8555-555555555555",
  processingVersion: 3,
  policyVersion: "v3",
  generatedAtIso: "2026-01-01T00:00:00.000Z",
  referenceYear: 2026,
  referenceStartYear: 2026,
  referenceEndYear: 2026,
  referencePeriodLabel: "2026",
  actionPlanRevision: 0,
  document: null,
} as OfficialReportData;

const reserved = {
  id: "33333333-3333-4333-8333-333333333333",
  emission_version: 1,
  file_path:
    "44444444-4444-4444-8444-444444444444/11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.pdf",
  generated_at: "2026-01-01T00:00:00.000Z",
  generated_by_name: "Administradora",
  reissue_reason: null,
  reference_start_year: 2026,
  reference_end_year: 2026,
  action_plan_revision: 0,
};

function completed() {
  return {
    ...reserved,
    status: "completed",
    file_sha256: expect.any(String),
    content_sha256: expect.any(String),
    file_size_bytes: 3,
  };
}

function makeClient(input?: {
  uploadError?: { message: string } | null;
  reserveError?: { message: string } | null;
  finalizeError?: { message: string } | null;
  finalizeMalformed?: boolean;
  currentCompleted?: boolean;
}) {
  const upload = vi.fn().mockResolvedValue({ error: input?.uploadError ?? null });
  const remove = vi.fn().mockResolvedValue({ error: null });
  let finalizedRecord: Record<string, unknown> | null = null;
  const rpc = vi.fn().mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn === "reserve_report_emission") {
      return { data: input?.reserveError ? null : reserved, error: input?.reserveError ?? null };
    }
    if (fn === "finalize_report_emission") {
      const final = {
        ...reserved,
        status: "completed",
        file_sha256: args.p_file_sha256,
        content_sha256: args.p_content_sha256,
        file_size_bytes: args.p_file_size_bytes,
      };
      finalizedRecord = final;
      return {
        data: input?.finalizeError ? null : input?.finalizeMalformed ? { unexpected: true } : final,
        error: input?.finalizeError ?? null,
      };
    }
    if (fn === "cancel_report_emission") return { data: null, error: null };
    throw new Error(`RPC inesperada: ${fn}`);
  });
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({
          data: input?.currentCompleted ? finalizedRecord : { status: "preparing" },
          error: null,
        }),
      }),
    }),
  }));
  const client = {
    storage: { from: () => ({ upload, remove }) },
    rpc,
    from,
  } as never;
  return { client, upload, remove, rpc };
}

describe("persistOfficialReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    buildOfficialReportPdf.mockResolvedValue(new Uint8Array([1, 2, 3]));
  });

  it("reserva, gera, envia e finaliza a emissão identificada", async () => {
    const { client, upload, rpc } = makeClient();
    const result = await persistOfficialReport(client, {
      data,
      generatedBy: "66666666-6666-4666-8666-666666666666",
    });

    expect(result.reportId).toBe(reserved.id);
    expect(result.emissionVersion).toBe(1);
    expect(upload).toHaveBeenCalledWith(reserved.file_path, expect.any(Buffer), {
      contentType: "application/pdf",
      upsert: false,
    });
    expect(rpc).toHaveBeenNthCalledWith(
      1,
      "reserve_report_emission",
      expect.objectContaining({ p_cycle_id: data.cycleId }),
    );
    expect(rpc).toHaveBeenCalledWith(
      "finalize_report_emission",
      expect.objectContaining({
        p_report_id: reserved.id,
        p_file_size_bytes: 3,
        p_file_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
        p_content_sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    expect(completed().status).toBe("completed");
  });

  it("não envia arquivo quando a reserva falha", async () => {
    const { client, upload } = makeClient({ reserveError: { message: "conflict" } });
    await expect(
      persistOfficialReport(client, { data, generatedBy: "user-1" }),
    ).rejects.toMatchObject({ code: "reservation_failed" });
    expect(upload).not.toHaveBeenCalled();
  });

  it("cancela a reserva quando o upload falha", async () => {
    const { client, rpc } = makeClient({ uploadError: { message: "storage down" } });
    await expect(
      persistOfficialReport(client, { data, generatedBy: "user-1" }),
    ).rejects.toMatchObject({ code: "upload_failed" });
    expect(rpc).toHaveBeenCalledWith("cancel_report_emission", {
      p_report_id: reserved.id,
    });
  });

  it("remove o objeto e cancela a reserva quando a finalização falha", async () => {
    const { client, remove, rpc } = makeClient({ finalizeError: { message: "conflict" } });
    await expect(
      persistOfficialReport(client, { data, generatedBy: "user-1" }),
    ).rejects.toMatchObject({ code: "report_persist_failed" });
    expect(remove).toHaveBeenCalledWith([reserved.file_path]);
    expect(rpc).toHaveBeenCalledWith("cancel_report_emission", {
      p_report_id: reserved.id,
    });
  });

  it("reconcilia uma finalização confirmada quando a resposta da RPC é inesperada", async () => {
    const { client, remove, rpc } = makeClient({
      finalizeMalformed: true,
      currentCompleted: true,
    });
    const result = await persistOfficialReport(client, { data, generatedBy: "user-1" });

    expect(result.reportId).toBe(reserved.id);
    expect(result.filePath).toBe(reserved.file_path);
    expect(remove).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalledWith("cancel_report_emission", expect.anything());
  });

  it("rejeita payload sem ciclo e processamento canônicos", async () => {
    const { client } = makeClient();
    await expect(
      persistOfficialReport(client, {
        data: { organizationId: "org" } as never,
        generatedBy: "user-1",
      }),
    ).rejects.toBeInstanceOf(OfficialReportPersistError);
  });
});
