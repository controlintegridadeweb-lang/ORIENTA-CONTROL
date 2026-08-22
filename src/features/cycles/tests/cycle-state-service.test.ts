import { beforeEach, describe, expect, it, vi } from "vitest";
import { CycleStateService, type CycleRow } from "../cycle-state-service";
import { DomainConflictError } from "@/infrastructure/api/domain-errors";
import type { CycleState } from "@/shared/domain/types";

const { submissionQuestionsMock } = vi.hoisted(() => ({
  submissionQuestionsMock: vi.fn(),
}));

vi.mock("@/features/cycles/submission-collect", () => ({
  collectSubmissionQuestions: submissionQuestionsMock,
}));

beforeEach(() => {
  submissionQuestionsMock.mockReset();
  submissionQuestionsMock.mockResolvedValue([
    {
      questionId: "q1",
      appliesToRespondent: true,
      isNotApplicable: false,
      hasWaiver: false,
      famiEnabled: true,
      requiresEvidence: false,
      answer: "yes",
      hasActiveEvidence: false,
    },
  ]);
});

/**
 * Fake mínimo da superfície do Supabase usada pelo CycleStateService.
 * Mantém uma única linha de ciclo em memória e implementa o subconjunto de
 * builder methods que o serviço encadeia (.from().update().eq().eq().select().maybeSingle()).
 *
 * O lock otimista do serviço usa `.eq("state", from)`; o fake respeita isso:
 * o update só "aplica" se o filtro de estado casar com o estado atual.
 */
function makeFakeClient(
  initial: CycleRow | null,
  options: { finalizeError?: string } = {},
) {
  const store: { row: Record<string, unknown> | null } = {
    row: initial
      ? {
          id: initial.id,
          form_version_id: initial.formVersionId,
          organization_id: initial.organizationId,
          period_label: initial.periodLabel,
          state: initial.state,
          reopen_count: initial.reopenCount,
          starts_at: initial.startsAt,
          response_deadline_at: initial.responseDeadlineAt,
          validation_deadline_at: initial.validationDeadlineAt,
          cycle_close_at: initial.cycleCloseAt,
          deadline_policy: initial.deadlinePolicy,
          submitted_late_at: initial.submittedLateAt,
          submission_delay_seconds: initial.submissionDelaySeconds,
          submitted_at: initial.submittedAt,
          validated_at: initial.validatedAt,
          closed_at: initial.closedAt,
          reopened_at: initial.reopenedAt,
          response_collection_paused_at: initial.responseCollectionPausedAt,
        }
      : null,
  };

  function selectChain(resultRow: Record<string, unknown> | null) {
    return {
      select: () => ({
        maybeSingle: async () => ({ data: resultRow, error: null }),
        single: async () => ({ data: resultRow, error: null }),
      }),
    };
  }

  const client = {
    // Simula a RPC reopen_cycle (migration 0006) com o MESMO contrato da
    // função SQL: lock implícito + validação canReopen + incremento de
    // reopen_count e limpeza de closed_at. Erros são devolvidos no formato
    // { error: { message } } como o supabase-js faz, para validar o mapeamento
    // de erros do service (cycle_not_found, cannot_reopen).
    rpc(fn: string, args: Record<string, unknown>) {
      if (fn === "commit_cycle_transition" || fn === "transition_cycle") {
        const r = store.row;
        if (!r || r.id !== args.p_cycle_id) {
          return Promise.resolve({ data: null, error: { message: "cycle_not_found" } });
        }
        const from = r.state as string;
        const to = args.p_to_state as string;
        if (args.p_expected_from_state && from !== args.p_expected_from_state) {
          return Promise.resolve({ data: null, error: { message: "cycle_state_conflict" } });
        }
        if (from === to) {
          return Promise.resolve({ data: { fromState: from, toState: to, unchanged: true }, error: null });
        }
        const valid =
          (from === "draft" && to === "in_response") ||
          (from === "in_response" && to === "submitted") ||
          (from === "submitted" && to === "in_validation") ||
          (from === "in_validation" && (to === "awaiting_adjustment" || to === "validated")) ||
          (from === "awaiting_adjustment" && to === "in_validation") ||
          (from === "validated" && to === "completed") ||
          (from === "completed" && to === "in_response");
        if (!valid) {
          return Promise.resolve({ data: null, error: { message: `invalid_cycle_transition: ${from} -> ${to}` } });
        }
        const patch: Record<string, unknown> = { state: to };
        if (to === "submitted") patch.submitted_at = new Date().toISOString();
        if (to === "validated") patch.validated_at = new Date().toISOString();
        if (to === "completed") patch.closed_at = new Date().toISOString();
        if (from === "completed" && to === "in_response") {
          patch.reopen_count = (Number(r.reopen_count) || 0) + 1;
          patch.reopened_at = new Date().toISOString();
        }
        store.row = { ...r, ...patch };
        return Promise.resolve({ data: { fromState: from, toState: to }, error: null });
      }
      if (fn === "finalize_validation_cycle") {
        if (options.finalizeError) {
          return Promise.resolve({ data: null, error: { message: options.finalizeError } });
        }
        const r = store.row;
        if (!r || r.id !== args.p_cycle_id) {
          return Promise.resolve({ data: null, error: { message: "cycle_not_found" } });
        }
        if (r.state !== "in_validation" && r.state !== "validated") {
          return Promise.resolve({
            data: null,
            error: { message: "cycle_not_ready_for_validation_finalization" },
          });
        }
        const from = String(r.state);
        store.row = {
          ...r,
          state: "validated",
          validated_at: r.validated_at ?? new Date().toISOString(),
        };
        return Promise.resolve({
          data: { cycle_id: r.id, from_state: from, to_state: "validated" },
          error: null,
        });
      }
      if (fn === "reopen_cycle") {
        const r = store.row;
        if (!r || r.id !== args.p_cycle_id) {
          return Promise.resolve({ data: null, error: { message: "cycle_not_found" } });
        }
        if (r.state !== "completed") {
          return Promise.resolve({
            data: null,
            error: { message: `cannot_reopen: estado atual ${String(r.state)}` },
          });
        }
        if (typeof args.p_reason !== "string" || args.p_reason.trim().length < 10) {
          return Promise.resolve({ data: null, error: { message: "reopen_reason_required" } });
        }
        if (typeof args.p_response_deadline_at !== "string") {
          return Promise.resolve({ data: null, error: { message: "reopen_deadline_must_be_future" } });
        }
        store.row = {
          ...r,
          state: "in_response",
          starts_at: new Date().toISOString(),
          response_deadline_at: args.p_response_deadline_at,
          validation_deadline_at: null,
          cycle_close_at: null,
          reopen_count: (Number(r.reopen_count) || 0) + 1,
          reopened_at: new Date().toISOString(),
          submitted_late_at: null,
          submission_delay_seconds: null,
          closed_at: null,
        };
        return Promise.resolve({
          data: {
            fromState: "completed",
            toState: "in_response",
            reopenCount: store.row.reopen_count,
          },
          error: null,
        });
      }
      if (fn === "reopen_validation_cycle") {
        const r = store.row;
        if (!r || r.id !== args.p_cycle_id) {
          return Promise.resolve({ data: null, error: { message: "cycle_not_found" } });
        }
        if (r.state === "in_validation") {
          return Promise.resolve({
            data: null,
            error: { message: "validation_already_open: estado atual in_validation" },
          });
        }
        if (r.state !== "validated") {
          return Promise.resolve({
            data: null,
            error: {
              message: `cannot_reopen_validation: estado atual ${String(r.state)}`,
            },
          });
        }
        if (typeof args.p_reason !== "string" || args.p_reason.trim().length < 10) {
          return Promise.resolve({
            data: null,
            error: { message: "validation_reopen_reason_required" },
          });
        }
        store.row = {
          ...r,
          state: "in_validation",
          validated_at: null,
        };
        return Promise.resolve({
          data: {
            fromState: "validated",
            toState: "in_validation",
            reopenNumber: 1,
          },
          error: null,
        });
      }
      if (fn === "execute_scheduled_cycle_action") {
        const r = store.row;
        if (!r || r.id !== args.p_cycle_id) {
          return Promise.resolve({
            data: { status: "failed", fromState: null, toState: null, message: "Diagnóstico não encontrado." },
            error: null,
          });
        }
        return Promise.resolve({
          data: {
            status: "skipped",
            fromState: r.state,
            toState: r.state,
            message: "Programação obsoleta: revisão 1; revisão atual 2.",
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: { message: `unknown_rpc:${fn}` } });
    },
    from() {
      const filters: Record<string, unknown> = {};
      const builder: Record<string, unknown> = {
        select: () => ({
          eq(col: string, val: unknown) {
            filters[col] = val;
            return this;
          },
          maybeSingle: async () => {
            const r = store.row;
            const match =
              r &&
              Object.entries(filters).every(([k, v]) => r[k] === v);
            return { data: match ? r : null, error: null };
          },
          single: async () => ({ data: store.row, error: null }),
        }),
        update(patch: Record<string, unknown>) {
          const upFilters: Record<string, unknown> = {};
          const apply = () => {
            const r = store.row;
            const match =
              r && Object.entries(upFilters).every(([k, v]) => r[k] === v);
            if (match) {
              store.row = { ...r, ...patch };
              return store.row;
            }
            return null;
          };
          const chain = {
            eq(col: string, val: unknown) {
              upFilters[col] = val;
              return chain;
            },
            ...selectChain(null),
          };
          // Reescreve select para refletir o resultado do apply (lock otimista).
          chain.select = () => ({
            maybeSingle: async () => ({ data: apply(), error: null }),
            single: async () => ({ data: apply(), error: null }),
          });
          return chain;
        },
        upsert(values: Record<string, unknown>) {
          if (!store.row) {
            store.row = {
              id: "cycle-new",
              reopen_count: 0,
              submitted_at: null,
              validated_at: null,
              closed_at: null,
              reopened_at: null,
              ...values,
            };
          }
          return selectChain(store.row);
        },
      };
      return builder;
    },
  };

  return { client: client as never, store };
}

function baseCycle(state: CycleState): CycleRow {
  return {
    id: "cycle-1",
    formVersionId: "fv-1",
    organizationId: "org-1",
    periodLabel: "2026",
    state,
    reopenCount: 0,
    startsAt: null,
    responseDeadlineAt: null,
    validationDeadlineAt: null,
    cycleCloseAt: null,
    deadlinePolicy: "flexible_audited",
    submittedLateAt: null,
    submissionDelaySeconds: null,
    submittedAt: null,
    validatedAt: null,
    closedAt: null,
    reopenedAt: null,
    responseCollectionPausedAt: null,
  };
}

describe("CycleStateService.transition", () => {
  it("recusa envio inicial por transicao generica", async () => {
    const { client, store } = makeFakeClient(baseCycle("in_response"));
    const svc = new CycleStateService(client);
    const cycle = await svc.require("cycle-1");
    await expect(svc.transition(cycle, "submitted", "user-1")).rejects.toBeInstanceOf(
      DomainConflictError,
    );
    expect(store.row?.state).toBe("in_response");
  });

  it("recusa reenvio apos ajuste por transicao generica", async () => {
    const { client, store } = makeFakeClient(baseCycle("awaiting_adjustment"));
    const svc = new CycleStateService(client);
    const cycle = await svc.require("cycle-1");
    await expect(svc.transition(cycle, "in_validation", "user-1")).rejects.toBeInstanceOf(
      DomainConflictError,
    );
    expect(store.row?.state).toBe("awaiting_adjustment");
  });

  it("executa transicao administrativa intermediaria valida", async () => {
    const { client, store } = makeFakeClient(baseCycle("submitted"));
    const svc = new CycleStateService(client);
    const cycle = await svc.require("cycle-1");
    const next = await svc.transition(cycle, "in_validation", "user-1");
    expect(next.state).toBe("in_validation");
    expect(store.row?.state).toBe("in_validation");
  });

  it("recusa abrir sem início e prazo mesmo quando o serviço é chamado diretamente", async () => {
    const { client, store } = makeFakeClient(baseCycle("draft"));
    const svc = new CycleStateService(client);
    const cycle = await svc.require("cycle-1");

    await expect(svc.transition(cycle, "in_response", "user-1")).rejects.toThrow(
      "Defina início e prazo de resposta",
    );
    expect(store.row?.state).toBe("draft");
  });

  it("rejeita transicao invalida com DomainConflictError", async () => {
    const { client } = makeFakeClient(baseCycle("submitted"));
    const svc = new CycleStateService(client);
    const cycle = await svc.require("cycle-1");
    await expect(svc.transition(cycle, "validated", "user-1")).rejects.toBeInstanceOf(
      DomainConflictError,
    );
  });

  it("é idempotente quando origem == destino", async () => {
    const { client } = makeFakeClient(baseCycle("in_response"));
    const svc = new CycleStateService(client);
    const cycle = await svc.require("cycle-1");
    const same = await svc.transition(cycle, "in_response", "user-1");
    expect(same.state).toBe("in_response");
  });

  it("encerra validated->completed sem recalcular o FAMI", async () => {
    const { client, store } = makeFakeClient(baseCycle("validated"));
    const svc = new CycleStateService(client);
    const cycle = await svc.require("cycle-1");
    const completed = await svc.transition(cycle, "completed", "user-1");
    expect(completed.state).toBe("completed");
    expect(store.row?.state).toBe("completed");
  });
});

describe("CycleStateService.checkReadiness", () => {
  it("recusa abrir um diagnóstico sem início e prazo de resposta", () => {
    const svc = new CycleStateService({} as never);
    expect(svc.checkReadiness(baseCycle("draft"), "in_response")).toEqual({
      allowed: false,
      reason: "Defina início e prazo de resposta antes de abrir o diagnóstico.",
    });
  });

  it("permite abrir quando início e prazo estão definidos", () => {
    const svc = new CycleStateService({} as never);
    const cycle = {
      ...baseCycle("draft"),
      startsAt: "2026-01-01T00:00:00.000Z",
      responseDeadlineAt: "2026-01-31T23:59:59.000Z",
    };
    expect(svc.checkReadiness(cycle, "in_response")).toEqual({
      allowed: true,
      reason: null,
    });
  });
});

describe("CycleStateService.validation workflow", () => {
  it("recusa transições genéricas durante a validação", async () => {
    const { client, store } = makeFakeClient(baseCycle("in_validation"));
    const svc = new CycleStateService(client);
    const cycle = await svc.require("cycle-1");

    await expect(svc.transition(cycle, "awaiting_adjustment", "user-1")).rejects.toBeInstanceOf(
      DomainConflictError,
    );
    await expect(svc.transition(cycle, "validated", "user-1")).rejects.toBeInstanceOf(
      DomainConflictError,
    );
    expect(store.row?.state).toBe("in_validation");
  });

  it("consolida somente pela operação exclusiva da fila", async () => {
    const { client, store } = makeFakeClient(baseCycle("in_validation"));
    const svc = new CycleStateService(client);
    const cycle = await svc.require("cycle-1");

    const result = await svc.consolidateValidation(cycle, "user-1");
    expect(result.state).toBe("validated");
    expect(result.validatedAt).not.toBeNull();
    expect(store.row?.state).toBe("validated");
  });


  it("recusa consolidar fora da etapa de validação", async () => {
    const { client } = makeFakeClient(baseCycle("submitted"));
    const svc = new CycleStateService(client);
    const cycle = await svc.require("cycle-1");

    await expect(svc.consolidateValidation(cycle, "user-1")).rejects.toBeInstanceOf(
      DomainConflictError,
    );
  });
});

describe("CycleStateService.reopen — preservacao + versionamento", () => {
  it("reabre completed → in_response e incrementa reopen_count", async () => {
    const { client, store } = makeFakeClient(baseCycle("completed"));
    const svc = new CycleStateService(client);
    const res = await svc.reopen("cycle-1", "user-1", {
      reason: "Correção institucional solicitada pela administração.",
      responseDeadlineAt: "2027-08-15T18:00:00.000Z",
    });
    expect(res.state).toBe("in_response");
    expect(res.reopenCount).toBe(1);
    expect(res.reopenedAt).not.toBeNull();
    expect(store.row?.state).toBe("in_response");
    expect(store.row?.reopen_count).toBe(1);
  });

  it("rejeita reabertura de ciclo nao encerrado", async () => {
    const { client } = makeFakeClient(baseCycle("validated"));
    const svc = new CycleStateService(client);
    await expect(svc.reopen("cycle-1", "user-1", {
      reason: "Correção institucional solicitada pela administração.",
      responseDeadlineAt: "2027-08-15T18:00:00.000Z",
    })).rejects.toBeInstanceOf(
      DomainConflictError,
    );
  });

  it("limpa closed_at ao reabrir; o histórico pertence ao processamento concluído", async () => {
    const cycle = { ...baseCycle("completed"), closedAt: "2026-01-01T00:00:00Z" };
    const { client } = makeFakeClient(cycle);
    const svc = new CycleStateService(client);
    const res = await svc.reopen("cycle-1", "user-1", {
      reason: "Correção institucional solicitada pela administração.",
      responseDeadlineAt: "2027-08-15T18:00:00.000Z",
    });
    expect(res.closedAt).toBeNull();
  });
  it("envia justificativa e novo prazo para a RPC oficial", async () => {
    const { client } = makeFakeClient(baseCycle("completed"));
    const svc = new CycleStateService(client);
    const result = await svc.reopen("cycle-1", "user-1", {
      reason: "Reabertura necessária para corrigir a documentação.",
      responseDeadlineAt: "2027-09-01T12:00:00.000Z",
    });
    expect(result.responseDeadlineAt).toBe("2027-09-01T12:00:00.000Z");
  });

});

describe("CycleStateService.reopenValidation", () => {
  it("reabre validated → in_validation e limpa validated_at", async () => {
    const cycle = {
      ...baseCycle("validated"),
      validatedAt: "2026-07-01T12:00:00.000Z",
    };
    const { client, store } = makeFakeClient(cycle);
    const svc = new CycleStateService(client);
    const res = await svc.reopenValidation("cycle-1", "user-1", {
      reason: "Revisão administrativa das evidências aprovadas.",
    });
    expect(res.state).toBe("in_validation");
    expect(res.validatedAt).toBeNull();
    expect(store.row?.state).toBe("in_validation");
    expect(store.row?.validated_at).toBeNull();
  });

  it("bloqueia reabertura quando a validação já está aberta", async () => {
    const { client } = makeFakeClient(baseCycle("in_validation"));
    const svc = new CycleStateService(client);
    await expect(
      svc.reopenValidation("cycle-1", "user-1", {
        reason: "Tentativa concorrente de reabertura.",
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });

  it("exige justificativa mínima", async () => {
    const { client } = makeFakeClient(baseCycle("validated"));
    const svc = new CycleStateService(client);
    await expect(
      svc.reopenValidation("cycle-1", "user-1", { reason: "curto" }),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });

  it("não reabre diagnóstico completed pela ação de validação", async () => {
    const { client } = makeFakeClient(baseCycle("completed"));
    const svc = new CycleStateService(client);
    await expect(
      svc.reopenValidation("cycle-1", "user-1", {
        reason: "Motivo administrativo com tamanho suficiente.",
      }),
    ).rejects.toBeInstanceOf(DomainConflictError);
  });
});
