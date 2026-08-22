import { describe, expect, it } from "vitest";
import {
  DomainConflictError,
  DomainValidationError,
  DomainNotFoundError,
} from "@/infrastructure/api/domain-errors";

// Réplica da lógica pura de validateEvidence: exigência de justificativa + status.
type Action = "approve" | "invalidate" | "request_adjustment";
function statusForAction(a: Action): "approved" | "invalidated" | "adjustment_requested" {
  if (a === "approve") return "approved";
  return a === "invalidate" ? "invalidated" : "adjustment_requested";
}
function checkJustification(action: Action, justification?: string | null) {
  const needs = action === "invalidate" || action === "request_adjustment";
  const j = justification?.trim() ?? "";
  if (needs && j === "") {
    throw new DomainValidationError([{ path: "justification", message: "Invalidar ou solicitar ajuste exige uma justificativa." }]);
  }
  return { status: statusForAction(action), justification: needs ? j : null };
}

describe("validateEvidence — regras de domínio", () => {
  it("approve → approved, sem exigir justificativa", () => {
    expect(checkJustification("approve")).toEqual({ status: "approved", justification: null });
  });
  it("invalidate exige justificativa não-vazia", () => {
    expect(() => checkJustification("invalidate", "  ")).toThrow(DomainValidationError);
    expect(checkJustification("invalidate", "Ilegível")).toEqual({ status: "invalidated", justification: "Ilegível" });
  });
  it("request_adjustment exige justificativa e preserva a decisão explícita", () => {
    expect(() => checkJustification("request_adjustment", "")).toThrow(DomainValidationError);
    const r = checkJustification("request_adjustment", "Falta página 2");
    expect(r.status).toBe("adjustment_requested");
    expect(r.justification).toBe("Falta página 2");
  });
  it("cada ação possui um veredito persistido próprio", () => {
    for (const a of ["approve","invalidate","request_adjustment"] as Action[]) {
      expect(["approved", "invalidated", "adjustment_requested"]).toContain(statusForAction(a));
    }
  });
});

// Integração com a RPC atômica validate_evidence (substitui as 2 operações
// separadas). Mocka supabase.rpc para provar parâmetros e mapeamento de erro.
import { validateEvidence } from "../evidence-validate-service";

function rpcClient(impl: (fn: string, args: Record<string, unknown>) => unknown) {
  return {
    rpc: async (fn: string, args: Record<string, unknown>) => impl(fn, args),
  } as unknown as Parameters<typeof validateEvidence>[0];
}

describe("validateEvidence — RPC atômica", () => {
  it("approve chama validate_evidence e devolve o estado do ciclo", async () => {
    let captured: Record<string, unknown> | null = null;
    const client = rpcClient((fn, args) => {
      expect(fn).toBe("validate_evidence");
      captured = args;
      return {
        data: { evidenceId: "e1", validationStatus: "approved", cycleId: "c1", cycleState: "in_validation", validatedAt: "2026-07-24T12:00:00.000Z" },
        error: null,
      };
    });
    const res = await validateEvidence(client, "c1", "e1", { action: "approve", actorUserId: "u1", expectedStatus: "pending", expectedValidatedAt: null });
    expect(captured).toMatchObject({ p_cycle_id: "c1", p_evidence_id: "e1", p_action: "approve", p_actor_user_id: "u1" });
    expect(res).toEqual({ evidenceId: "e1", validationStatus: "approved", cycleId: "c1", cycleState: "in_validation", validatedAt: "2026-07-24T12:00:00.000Z" });
  });

  it("request_adjustment prepara a devolutiva sem encerrar a rodada", async () => {
    const client = rpcClient(() => ({
      data: { evidenceId: "e1", validationStatus: "adjustment_requested", cycleId: "c1", cycleState: "in_validation", validatedAt: "2026-07-24T12:00:00.000Z" },
      error: null,
    }));
    const res = await validateEvidence(client, "c1", "e1", {
      action: "request_adjustment",
      justification: "Falta anexo",
      actorUserId: "u1",
      expectedStatus: "pending",
      expectedValidatedAt: null,
    });
    expect(res.validationStatus).toBe("adjustment_requested");
    expect(res.cycleState).toBe("in_validation");
  });

  it("mapeia cycle_not_in_validation com situação atual legível e sem path técnico", async () => {
    const client = rpcClient(() => ({
      data: null,
      error: { message: "cycle_not_in_validation: estado do ciclo submitted" },
    }));
    try {
      await validateEvidence(client, "c1", "e1", { action: "approve", actorUserId: "u1", expectedStatus: "pending", expectedValidatedAt: null });
      expect.unreachable("deveria rejeitar");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainValidationError);
      const issues = (error as DomainValidationError).issues;
      expect(issues[0]?.path).toBe("_");
      expect(issues[0]?.message).toContain("em validação");
      expect(issues[0]?.message).toContain("Enviado");
    }
  });

  it("mapeia evidence_not_found para DomainNotFoundError", async () => {
    const client = rpcClient(() => ({ data: null, error: { message: "evidence_not_found" } }));
    await expect(
      validateEvidence(client, "c1", "nope", { action: "approve", actorUserId: "u1", expectedStatus: "pending", expectedValidatedAt: null }),
    ).rejects.toBeInstanceOf(DomainNotFoundError);
  });

  it("rejeita divergência de diagnóstico antes de aceitar o veredito", async () => {
    const client = rpcClient(() => ({
      data: null,
      error: { message: "evidence_not_in_cycle" },
    }));
    await expect(
      validateEvidence(client, "c1", "e-outro", { action: "approve", actorUserId: "u1", expectedStatus: "pending", expectedValidatedAt: null }),
    ).rejects.toMatchObject({
      name: "DomainConflictError",
      message: "Evidência não pertence ao diagnóstico informado.",
    });
  });

  it("impede sobrescrever um parecer alterado por outro administrador", async () => {
    const client = rpcClient(() => ({
      data: null,
      error: { message: "validation_conflict" },
    }));

    await expect(
      validateEvidence(client, "c1", "e1", {
        action: "invalidate",
        justification: "Documento ilegível.",
        actorUserId: "u1",
        expectedStatus: "pending",
        expectedValidatedAt: null,
      }),
    ).rejects.toMatchObject({
      name: "DomainConflictError",
      message:
        "Este parecer foi alterado por outro administrador. A fila será atualizada; revise o estado atual antes de tentar novamente.",
    } satisfies Partial<DomainConflictError>);
  });
});
