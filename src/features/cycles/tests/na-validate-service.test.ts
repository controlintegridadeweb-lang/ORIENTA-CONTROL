import { describe, expect, it } from "vitest";
import { DomainConflictError, DomainValidationError } from "@/infrastructure/api/domain-errors";
import { validateNotApplicableResponse } from "../na-validate-service";

function rpcClient(impl: (fn: string, args: Record<string, unknown>) => unknown) {
  return {
    rpc: async (fn: string, args: Record<string, unknown>) => impl(fn, args),
  } as unknown as Parameters<typeof validateNotApplicableResponse>[0];
}

describe("validateNotApplicableResponse", () => {
  it("exige motivo para rejeitar uma resposta não se aplica", async () => {
    const client = rpcClient(() => ({ data: null, error: null }));

    await expect(
      validateNotApplicableResponse(client, "cycle-1", "response-1", {
        action: "reject",
        rejectionReason: "   ",
        actorUserId: "admin-1",
        expectedStatus: "pending",
        expectedValidatedAt: null,
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });

  it("envia a versão esperada para proteger o parecer concorrente", async () => {
    let captured: Record<string, unknown> | null = null;
    const client = rpcClient((_fn, args) => {
      captured = args;
      return {
        data: {
          responseId: "response-1",
          answer: "not_applicable",
          naValidationStatus: "approved",
          cycleId: "cycle-1",
          rejected: false,
          validatedAt: "2026-07-24T12:00:00.000Z",
        },
        error: null,
      };
    });

    await validateNotApplicableResponse(client, "cycle-1", "response-1", {
      action: "approve",
      actorUserId: "admin-1",
      expectedStatus: "rejected",
      expectedValidatedAt: "2026-07-24T11:00:00.000Z",
    });

    expect(captured).toMatchObject({
      p_expected_status: "rejected",
      p_expected_validated_at: "2026-07-24T11:00:00.000Z",
    });
  });

  it("impede sobrescrever um parecer N/A alterado por outro administrador", async () => {
    const client = rpcClient(() => ({
      data: null,
      error: { message: "validation_conflict" },
    }));

    await expect(
      validateNotApplicableResponse(client, "cycle-1", "response-1", {
        action: "approve",
        actorUserId: "admin-1",
        expectedStatus: "pending",
        expectedValidatedAt: null,
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });
});
