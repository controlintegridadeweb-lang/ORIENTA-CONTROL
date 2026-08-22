import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DomainConflictError, DomainValidationError } from "@/infrastructure/api/domain-errors";
import {
  createAndOpenCyclesForOrganizations,
  createCyclesForOrganizations,
} from "../create-cycle-service";

function rpcClient(result: { data?: unknown; error?: { message: string } }): SupabaseClient {
  const normalized = Array.isArray(result.data)
    ? {
        ...result,
        data: {
          result: result.data,
          schedules: { jobsCreated: 0, remindersScheduled: 0 },
        },
      }
    : result;
  return { rpc: async () => normalized } as unknown as SupabaseClient;
}

const batchInput = {
  formId: "form-1",
  organizationIds: ["org-1"],
  periodLabel: "2026",
  referenceStartYear: 2026,
  referenceEndYear: 2026,
  actorUserId: "admin-1",
};

describe("validação e tradução de erros do lote", () => {
  it("mapeia o rascunho criado pela RPC", async () => {
    const result = await createCyclesForOrganizations(
      rpcClient({
        data: [
          {
            status: "created",
            cycle: {
              id: "cycle-1",
              form_version_id: "version-1",
              organization_id: "org-1",
              period_label: "2026",
              reference_start_year: 2026,
              reference_end_year: 2026,
              state: "draft",
              starts_at: null,
              response_deadline_at: null,
            },
          },
        ],
      }),
      batchInput,
    );

    expect(result.created).toEqual([
      {
        id: "cycle-1",
        formVersionId: "version-1",
        organizationId: "org-1",
        periodLabel: "2026",
        referenceStartYear: 2026,
        referenceEndYear: 2026,
        state: "draft",
        startsAt: null,
        responseDeadlineAt: null,
      },
    ]);
  });

  it("rejeita período vazio antes de consultar o banco", async () => {
    await expect(
      createCyclesForOrganizations(rpcClient({}), {
        ...batchInput,
        periodLabel: "  ",
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });

  it.each([
    ["form_has_no_published_version", "formId"],
    ["organization_not_assigned", "organizationId"],
    ["deadline_before_start", "responseDeadlineAt"],
  ])("traduz o erro %s para o campo %s", async (code, path) => {
    try {
      await createCyclesForOrganizations(
        rpcClient({ error: { message: code } }),
        batchInput,
      );
      throw new Error("A operação deveria falhar.");
    } catch (error: unknown) {
      expect(error).toBeInstanceOf(DomainValidationError);
      if (!(error instanceof DomainValidationError)) throw error;
      expect(error.issues[0]?.path).toBe(path);
    }
  });

  it("traduz conflito global de unicidade", async () => {
    await expect(
      createCyclesForOrganizations(
        rpcClient({
          error: {
            message:
              "duplicate key value violates unique constraint cycles_identity_unique",
          },
        }),
        batchInput,
      ),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });
});

describe("operações de ciclos em lote", () => {
  it("abre novos ciclos e rascunhos existentes em uma única RPC", async () => {
    const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
    const client = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        const common = {
          form_version_id: "fv-1",
          period_label: "2026",
          reference_start_year: 2026,
          reference_end_year: 2026,
          starts_at: "2026-07-16T15:00:00.000Z",
          response_deadline_at: "2026-08-16T15:00:00.000Z",
        };
        return {
          data: {
            result: [
            {
              status: "created_and_opened",
              cycle: {
                ...common,
                id: "cycle-org-new",
                organization_id: "org-new",
                state: "in_response",
              },
            },
            {
              status: "opened_existing",
              cycle: {
                ...common,
                id: "cycle-org-draft",
                organization_id: "org-draft",
                state: "in_response",
              },
            },
            {
              status: "already_open",
              cycle: {
                ...common,
                id: "cycle-org-open",
                organization_id: "org-open",
                state: "in_response",
              },
            },
            {
              status: "not_openable",
              cycle: {
                ...common,
                id: "cycle-org-submitted",
                organization_id: "org-submitted",
                state: "submitted",
              },
            },
            ],
            schedules: { jobsCreated: 0, remindersScheduled: 0 },
          },
          error: null,
        };
      },
    } as unknown as SupabaseClient;

    const result = await createAndOpenCyclesForOrganizations(client, {
      formId: "form-1",
      organizationIds: ["org-new", "org-draft", "org-open", "org-submitted"],
      periodLabel: "2026",
      referenceStartYear: 2026,
      referenceEndYear: 2026,
      startsAt: "2026-07-16T15:00:00.000Z",
      responseDeadlineAt: "2026-08-16T15:00:00.000Z",
      actorUserId: "admin-1",
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.fn).toBe("process_cycles_batch_with_reference");
    expect(calls[0]?.args.p_mode).toBe("open");
    expect(calls[0]?.args.p_organization_ids).toEqual([
      "org-new",
      "org-draft",
      "org-open",
      "org-submitted",
    ]);
    expect(result.opened).toEqual([
      expect.objectContaining({ organizationId: "org-new", source: "created" }),
      expect.objectContaining({
        organizationId: "org-draft",
        source: "existing_draft",
      }),
    ]);
    expect(result.skipped).toEqual([
      expect.objectContaining({
        organizationId: "org-open",
        state: "in_response",
      }),
      expect.objectContaining({
        organizationId: "org-submitted",
        state: "submitted",
      }),
    ]);
    expect(result.failed).toEqual([]);
  });

  it("deduplica organizações e preserva falhas por órgão no retorno", async () => {
    let calls = 0;
    const client = {
      rpc: async (_fn: string, args: Record<string, unknown>) => {
        calls += 1;
        expect(args.p_organization_ids).toEqual(["org-ok", "org-fail"]);
        return {
          data: {
            result: [
            {
              status: "created_and_opened",
              cycle: {
                id: "cycle-ok",
                form_version_id: "fv-1",
                organization_id: "org-ok",
                period_label: "2026",
                reference_start_year: 2026,
                reference_end_year: 2026,
                state: "in_response",
                starts_at: "2026-07-16T15:00:00.000Z",
                response_deadline_at: "2026-08-16T15:00:00.000Z",
              },
            },
            {
              status: "failed",
              organization_id: "org-fail",
              message: "organization_not_assigned",
            },
            ],
            schedules: { jobsCreated: 0, remindersScheduled: 0 },
          },
          error: null,
        };
      },
    } as unknown as SupabaseClient;

    const result = await createAndOpenCyclesForOrganizations(client, {
      formId: "form-1",
      organizationIds: ["org-ok", "org-ok", "org-fail"],
      periodLabel: "2026",
      referenceStartYear: 2026,
      referenceEndYear: 2026,
      startsAt: "2026-07-16T15:00:00.000Z",
      responseDeadlineAt: "2026-08-16T15:00:00.000Z",
      actorUserId: "admin-1",
    });

    expect(calls).toBe(1);
    expect(result.opened).toHaveLength(1);
    expect(result.failed).toEqual([
      {
        organizationId: "org-fail",
        message: "A organização não está atribuída a este formulário.",
      },
    ]);
  });

  it("cria rascunhos em uma única RPC e reporta conflitos", async () => {
    const client = {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        expect(fn).toBe("process_cycles_batch_with_reference");
        expect(args.p_mode).toBe("draft");
        expect(args.p_organization_ids).toEqual(["org-a", "org-b"]);
        return {
          data: {
            result: [
            {
              status: "created",
              cycle: {
                id: "cycle-a",
                form_version_id: "fv-1",
                organization_id: "org-a",
                period_label: "2026",
                reference_start_year: 2026,
                reference_end_year: 2026,
                state: "draft",
                starts_at: null,
                response_deadline_at: null,
              },
            },
            {
              status: "already_exists",
              organization_id: "org-b",
              message: "cycles_form_period_unique",
            },
            ],
            schedules: { jobsCreated: 0, remindersScheduled: 0 },
          },
          error: null,
        };
      },
    } as unknown as SupabaseClient;

    const result = await createCyclesForOrganizations(client, {
      formId: "form-1",
      organizationIds: ["org-a", "org-b"],
      periodLabel: "2026",
      referenceStartYear: 2026,
      referenceEndYear: 2026,
      actorUserId: "admin-1",
    });

    expect(result.created).toHaveLength(1);
    expect(result.skipped).toEqual([
      expect.objectContaining({ organizationId: "org-b" }),
    ]);
  });
});
