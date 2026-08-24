import { describe, expect, it, vi } from "vitest";
import { CycleClosureService } from "./cycle-closure-service";

vi.mock("@/infrastructure/observability/logger", () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
}));

const completedRow = {
  id: "ecc6664d-b7f0-4490-beed-896c83f16c1d",
  form_version_id: "d46e7828-65fd-43c1-be59-6f55e9d2b61b",
  organization_id: "81d65010-2ce2-44eb-96f5-9564ce28362f",
  period_label: "2026",
  state: "completed",
  reopen_count: 0,
  starts_at: null,
  response_deadline_at: null,
  validation_deadline_at: null,
  cycle_close_at: null,
  deadline_policy: "flexible_audited",
  submitted_late_at: null,
  submission_delay_seconds: null,
  submitted_at: null,
  validated_at: null,
  closed_at: "2026-08-24T14:32:11.000Z",
  reopened_at: null,
  response_collection_paused_at: null,
  action_plan_revision: 1,
};

function supabaseWithMissingReportRpc() {
  const rpc = vi.fn(async (name: string) => {
    if (name === "cycle_report_lifecycle_status") {
      return {
        data: null,
        error: {
          code: "PGRST202",
          message:
            "Could not find the function public.cycle_report_lifecycle_status(p_cycle_id) in the schema cache",
        },
      };
    }
    if (name === "record_report_emission_failure") {
      return { data: "11111111-1111-4111-8111-111111111111", error: null };
    }
    throw new Error(`RPC não simulada: ${name}`);
  });

  return {
    rpc,
    from(table: string) {
      if (table === "cycles") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: completedRow, error: null }),
            }),
          }),
        };
      }
      if (table === "cycle_processings") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: async () => ({
                    data: [{ id: "proc-1", processing_version: 1 }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Tabela não simulada: ${table}`);
    },
  };
}

describe("CycleClosureService", () => {
  it("não desfaz o encerramento quando a RPC do relatório está ausente", async () => {
    const supabase = supabaseWithMissingReportRpc();
    const service = new CycleClosureService(supabase as never);

    await expect(
      service.ensureClosedCycleReport(completedRow.id, "530629c2-6c84-4741-80a5-71001fd1e756"),
    ).resolves.toMatchObject({
      status: "emission_failed",
      reportId: null,
      message: expect.stringContaining("emissão automática do relatório falhou"),
    });
    expect(supabase.rpc).toHaveBeenCalledWith(
      "cycle_report_lifecycle_status",
      { p_cycle_id: completedRow.id },
    );
  });
});
