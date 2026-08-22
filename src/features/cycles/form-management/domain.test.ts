import { describe, expect, it } from "vitest";
import type { CycleState } from "@/shared/domain/types";
import {
  buildDeadlineChangePreview,
  countFormApplicationOrganizations,
  deriveFormApplicationStatus,
  hasIndividualDeadlineExceptions,
  listFormAdminActions,
  resolveDeadlineScopeCycleIds,
  resolveGlobalDeadline,
  resolveReopenEligibleCycles,
  resolveValidationReopenEligibleCycles,
  validateFutureDeadline,
  validateJustification,
  validatePartialReopenScope,
  type FormManagementCycleInput,
} from "./domain";

function cycle(
  partial: Partial<FormManagementCycleInput> & {
    id: string;
    organizationId: string;
    state: CycleState;
  },
): FormManagementCycleInput {
  return {
    responseDeadlineAt: null,
    originalResponseDeadlineAt: null,
    responseCollectionPausedAt: null,
    deadlineChangeCount: 0,
    reopenCount: 0,
    startsAt: null,
    closedAt: null,
    ...partial,
  };
}

describe("form-management domain", () => {
  const now = new Date("2026-08-01T12:00:00.000Z");

  it("deriva Em aplicação quando todos os órgãos estão na fase de resposta", () => {
    const status = deriveFormApplicationStatus([
      cycle({
        id: "1",
        organizationId: "o1",
        state: "in_response",
        responseDeadlineAt: "2026-08-31T23:59:00.000Z",
      }),
      cycle({ id: "2", organizationId: "o2", state: "awaiting_adjustment" }),
    ]);
    expect(status).toBe("in_application");
  });

  it("deriva Situações mistas quando há órgãos em macrofases diferentes", () => {
    const status = deriveFormApplicationStatus([
      cycle({ id: "1", organizationId: "o1", state: "in_response" }),
      cycle({ id: "2", organizationId: "o2", state: "submitted" }),
      cycle({ id: "3", organizationId: "o3", state: "validated" }),
    ]);
    expect(status).toBe("mixed");
  });

  it("deriva Situações mistas quando apenas parte da coleta está suspensa", () => {
    const status = deriveFormApplicationStatus([
      cycle({
        id: "1",
        organizationId: "o1",
        state: "in_response",
        responseCollectionPausedAt: "2026-08-01T10:00:00.000Z",
      }),
      cycle({ id: "2", organizationId: "o2", state: "in_response" }),
    ]);
    expect(status).toBe("mixed");
  });

  it("deriva Suspenso quando toda a coleta está pausada", () => {
    const status = deriveFormApplicationStatus([
      cycle({
        id: "1",
        organizationId: "o1",
        state: "in_response",
        responseCollectionPausedAt: "2026-08-01T10:00:00.000Z",
      }),
    ]);
    expect(status).toBe("suspended");
  });

  it("conta organizações por situação operacional", () => {
    const counts = countFormApplicationOrganizations(
      [
        cycle({
          id: "1",
          organizationId: "o1",
          state: "in_response",
          responseDeadlineAt: "2026-07-01T23:59:00.000Z",
        }),
        cycle({ id: "2", organizationId: "o2", state: "awaiting_adjustment" }),
        cycle({ id: "3", organizationId: "o3", state: "submitted" }),
        cycle({ id: "4", organizationId: "o4", state: "in_validation" }),
        cycle({ id: "5", organizationId: "o5", state: "validated" }),
        cycle({ id: "6", organizationId: "o6", state: "completed" }),
      ],
      now,
    );
    expect(counts).toEqual({
      linked: 6,
      filling: 1,
      overdue: 1,
      submitted: 1,
      adjusting: 1,
      validating: 1,
      concluded: 2,
    });
  });

  it("resolve prazo global modal e detecta exceções individuais", () => {
    const cycles = [
      cycle({
        id: "1",
        organizationId: "o1",
        state: "in_response",
        originalResponseDeadlineAt: "2026-08-31T23:59:00.000Z",
        responseDeadlineAt: "2026-08-31T23:59:00.000Z",
      }),
      cycle({
        id: "2",
        organizationId: "o2",
        state: "in_response",
        originalResponseDeadlineAt: "2026-08-31T23:59:00.000Z",
        responseDeadlineAt: "2026-09-15T23:59:00.000Z",
      }),
      cycle({
        id: "3",
        organizationId: "o3",
        state: "in_response",
        originalResponseDeadlineAt: "2026-08-31T23:59:00.000Z",
        responseDeadlineAt: "2026-08-31T23:59:00.000Z",
      }),
    ];
    expect(resolveGlobalDeadline(cycles)).toBe("2026-08-31T23:59:00.000Z");
    expect(hasIndividualDeadlineExceptions(cycles)).toBe(true);
  });

  it("escopo overdue e selected respeitam elegibilidade", () => {
    const cycles = [
      cycle({
        id: "1",
        organizationId: "o1",
        state: "in_response",
        responseDeadlineAt: "2026-07-01T23:59:00.000Z",
      }),
      cycle({
        id: "2",
        organizationId: "o2",
        state: "in_response",
        responseDeadlineAt: "2026-08-31T23:59:00.000Z",
      }),
      cycle({
        id: "3",
        organizationId: "o3",
        state: "validated",
        responseDeadlineAt: "2026-07-01T23:59:00.000Z",
      }),
    ];

    expect(
      resolveDeadlineScopeCycleIds({ cycles, scope: "overdue", now }).cycleIds,
    ).toEqual(["1"]);

    expect(
      resolveDeadlineScopeCycleIds({
        cycles,
        scope: "selected",
        organizationIds: ["o3"],
        now,
      }).error,
    ).toMatch(/reabertura/i);
  });

  it("valida prazo futuro e justificativa", () => {
    expect(validateFutureDeadline("2026-07-01T00:00:00.000Z", now)).toMatch(/posterior/i);
    expect(validateFutureDeadline("2026-09-01T00:00:00.000Z", now)).toBeNull();
    expect(validateJustification("curto")).toMatch(/justificativa/i);
    expect(validateJustification("Justificativa administrativa válida.")).toBeNull();
  });

  it("monta preview da alteração de prazo", () => {
    expect(
      buildDeadlineChangePreview({
        previousDeadlines: ["2026-08-31", "2026-08-31"],
        newDeadlineAt: "2026-09-15",
        organizationCount: 5,
      }),
    ).toBe("O prazo será alterado de 2026-08-31 para 2026-09-15 para 5 organizações.");
  });

  it("reabertura só admite ciclos completed e explica bloqueios", () => {
    const result = resolveReopenEligibleCycles([
      cycle({ id: "c1", organizationId: "o1", state: "completed" }),
      cycle({ id: "c2", organizationId: "o2", state: "validated" }),
      cycle({ id: "c3", organizationId: "o3", state: "in_response" }),
    ]);
    expect(result.cycleIds).toEqual(["c1"]);
    expect(result.blocked).toHaveLength(2);
    expect(result.blocked[0]?.reason).toMatch(/validação/i);
  });

  it("reabertura de validação só admite ciclos validated", () => {
    const result = resolveValidationReopenEligibleCycles([
      cycle({ id: "c1", organizationId: "o1", state: "validated" }),
      cycle({ id: "c2", organizationId: "o2", state: "completed" }),
    ]);
    expect(result.cycleIds).toEqual(["c1"]);
    expect(result.blocked[0]?.reason).toMatch(/Reabrir para respostas/i);
    expect(validatePartialReopenScope({ mode: "partial", questionVersionIds: [] })).toMatch(
      /critério/i,
    );
    expect(
      validatePartialReopenScope({
        mode: "partial",
        questionVersionIds: ["11111111-1111-4111-8111-111111111111"],
      }),
    ).toBeNull();
  });

  it("lista ações compatíveis com a situação", () => {
    const cycles = [
      cycle({
        id: "1",
        organizationId: "o1",
        state: "in_response",
        responseDeadlineAt: "2026-07-01T23:59:00.000Z",
      }),
      cycle({ id: "2", organizationId: "o2", state: "completed" }),
    ];
    const counts = countFormApplicationOrganizations(cycles, now);
    const actions = listFormAdminActions({
      status: "in_application",
      counts,
      cycles,
      now,
    });
    const byKey = Object.fromEntries(actions.map((action) => [action.key, action]));
    expect(byKey.change_deadline?.available).toBe(true);
    expect(byKey.extend_deadline?.available).toBe(true);
    expect(byKey.reopen_responses?.available).toBe(true);
    expect(byKey.resume?.available).toBe(false);
    expect(byKey.resume?.reason).toMatch(/suspensa/i);
  });
});
