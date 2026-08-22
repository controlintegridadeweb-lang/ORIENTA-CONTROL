import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DomainValidationError,
  DomainConflictError,
} from "@/infrastructure/api/domain-errors";
import {
  markResponseAdminNotApplicable,
  revertResponseAdminNotApplicable,
} from "../admin-applicability-service";

function rpcClient(result: {
  data?: unknown;
  error?: { message: string } | null;
}): SupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue({
      data: result.data ?? null,
      error: result.error ?? null,
    }),
  } as unknown as SupabaseClient;
}

describe("admin-applicability-service", () => {
  it("exige justificativa não vazia antes de chamar a RPC", async () => {
    const client = rpcClient({});
    await expect(
      markResponseAdminNotApplicable(client, "cycle-1", "response-1", {
        justification: "   ",
        actorUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("mapeia critério não elegível para erro de validação", async () => {
    const client = rpcClient({
      error: { message: "question_does_not_allow_admin_not_applicable" },
    });
    await expect(
      markResponseAdminNotApplicable(client, "cycle-1", "response-1", {
        justification: "Motivo administrativo válido.",
        actorUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });

  it("preserva histórico ao revisar: chama revert sem apagar eventos no cliente", async () => {
    const client = rpcClient({
      data: {
        responseId: "response-1",
        cycleId: "cycle-1",
        adminApplicabilityStatus: null,
        validationRound: 2,
      },
    });
    const result = await revertResponseAdminNotApplicable(
      client,
      "cycle-1",
      "response-1",
      {
        justification: "Reabrir para nova análise de evidência.",
        actorUserId: "admin-1",
        expectedAdminStatus: "not_applicable",
      },
    );
    expect(result.adminApplicabilityStatus).toBeNull();
    expect(client.rpc).toHaveBeenCalledWith(
      "revert_response_admin_not_applicable",
      expect.objectContaining({
        p_response_id: "response-1",
        p_justification: "Reabrir para nova análise de evidência.",
      }),
    );
  });

  it("mapeia contenção de lock para conflito recuperável", async () => {
    const client = rpcClient({
      error: { message: "admin_applicability_busy" },
    });
    await expect(
      revertResponseAdminNotApplicable(client, "cycle-1", "response-1", {
        justification: "Tentar de novo.",
        actorUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });

  it("propaga conflito otimista sem mascarar a falha", async () => {
    const client = rpcClient({
      error: { message: "admin_applicability_conflict" },
    });
    await expect(
      markResponseAdminNotApplicable(client, "cycle-1", "response-1", {
        justification: "Motivo administrativo válido.",
        actorUserId: "admin-1",
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });
});
