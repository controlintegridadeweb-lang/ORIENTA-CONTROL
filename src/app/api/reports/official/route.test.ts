import { beforeEach, describe, expect, it, vi } from "vitest";

const CYCLE_ID = "5fd07e6d-a83a-432d-93f6-922f0d7c7485";
const PROCESSING_ID = "6fd07e6d-a83a-432d-93f6-922f0d7c7485";
const REPORT_ID = "7fd07e6d-a83a-432d-93f6-922f0d7c7485";

const mocks = vi.hoisted(() => ({
  authContext: { userId: "admin-1" },
  authError: null as Response | null,
  scope: { cycleId: "5fd07e6d-a83a-432d-93f6-922f0d7c7485" },
  reportData: null as Record<string, unknown> | null,
  existingEmissionCount: 0,
  emissionsError: null as unknown,
  persist: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/infrastructure/api/auth", () => ({
  requireAuth: vi.fn(async () => ({
    context: mocks.authError ? null : mocks.authContext,
    error: mocks.authError,
  })),
}));
vi.mock("@/features/reports/pdf/cycle-report-read", () => ({
  resolveCycleReportScope: vi.fn(async () => mocks.scope),
}));
vi.mock("@/features/reports/pdf/build-official-report-data", () => ({
  loadOfficialReportData: vi.fn(async () => mocks.reportData),
}));
vi.mock("@/features/reports/pdf/persist-official-report", () => ({
  OfficialReportPersistError: class OfficialReportPersistError extends Error {
    code = "persist_failed";
  },
  persistOfficialReport: mocks.persist,
}));
vi.mock("@/infrastructure/observability/logger", () => ({
  logError: mocks.logError,
}));
vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          in: vi.fn(async () => ({
            count: mocks.existingEmissionCount,
            error: mocks.emissionsError,
          })),
        })),
      })),
    })),
  })),
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/reports/official", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function reportData() {
  return {
    cycleProcessingId: PROCESSING_ID,
    processingVersion: 3,
    formName: "Diagnóstico de Integridade",
    referencePeriodLabel: "2026",
  };
}

describe("POST /api/reports/official", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authError = null;
    mocks.scope = { cycleId: CYCLE_ID };
    mocks.reportData = reportData();
    mocks.existingEmissionCount = 0;
    mocks.emissionsError = null;
    mocks.persist.mockResolvedValue({
      reportId: REPORT_ID,
      emissionVersion: 1,
      fileSha256: "a".repeat(64),
      pdfBytes: new Uint8Array([37, 80, 68, 70]),
    });
  });

  it("não processa usuário sem autorização administrativa", async () => {
    mocks.authError = Response.json({ error: "Não autorizado." }, { status: 401 });

    const response = await POST(request({ cycleId: CYCLE_ID }));

    expect(response.status).toBe(401);
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("exige motivo quando já existe emissão oficial", async () => {
    mocks.existingEmissionCount = 1;

    const response = await POST(request({ cycleId: CYCLE_ID }));

    expect(response.status).toBe(422);
    expect(mocks.persist).not.toHaveBeenCalled();
  });

  it("persiste antes de devolver o PDF oficial", async () => {
    const response = await POST(request({ cycleId: CYCLE_ID }));
    const bytes = new Uint8Array(await response.arrayBuffer());

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("x-report-id")).toBe(REPORT_ID);
    expect(Array.from(bytes)).toEqual([37, 80, 68, 70]);
    expect(mocks.persist).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        generatedBy: "admin-1",
        reissueReason: undefined,
        data: expect.objectContaining({ cycleProcessingId: PROCESSING_ID }),
      }),
    );
  });
});
