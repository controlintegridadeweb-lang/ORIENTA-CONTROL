import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cycleId: "76fe8b00-5d04-4b03-9a64-39377413a732",
  auth: {
    userId: "admin-1",
    role: "admin" as const,
    organizationId: null as string | null,
    mfaVerified: true,
  },
  authorizedError: null as Response | null,
  cycle: {
    id: "76fe8b00-5d04-4b03-9a64-39377413a732",
    state: "validated" as string,
  },
  updated: {
    id: "76fe8b00-5d04-4b03-9a64-39377413a732",
    state: "in_validation" as string,
  },
  require: vi.fn(),
  transition: vi.fn(),
  reopen: vi.fn(),
  reopenValidation: vi.fn(),
}));

vi.mock("@/infrastructure/api/with-route", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/infrastructure/api/with-route")>();
  return {
    ...actual,
    withRoute:
      <P,>(
        _options: unknown,
        handler: (input: { request: Request; auth: typeof mocks.auth; params: P }) => Promise<Response>,
      ) =>
      async (request: Request, ctx?: { params: Promise<P> }) =>
        handler({
          request,
          auth: mocks.auth,
          params: ctx?.params ? await ctx.params : ({} as P),
        }),
  };
});
vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => ({})),
}));
vi.mock("@/features/cycles/authorized-cycle", () => ({
  resolveAuthorizedCycleScope: vi.fn(async () =>
    mocks.authorizedError
      ? { scope: null, error: mocks.authorizedError }
      : { scope: { cycle: { organizationId: "org-1" } }, error: null },
  ),
}));
vi.mock("@/features/cycles/cycle-state-service", () => ({
  CycleStateService: class {
    require = mocks.require;
    transition = mocks.transition;
    reopen = mocks.reopen;
    reopenValidation = mocks.reopenValidation;
  },
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request(`http://localhost/api/admin/cycles/${mocks.cycleId}/transition`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/admin/cycles/[cycleId]/transition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizedError = null;
    mocks.cycle.state = "validated";
    mocks.updated.state = "in_validation";
    mocks.require.mockResolvedValue(mocks.cycle);
    mocks.reopenValidation.mockResolvedValue(mocks.updated);
    mocks.reopen.mockResolvedValue({ id: mocks.cycleId, state: "in_response" });
    mocks.transition.mockResolvedValue({ id: mocks.cycleId, state: "in_validation" });
  });

  it("reabre a validação pelo serviço dedicado", async () => {
    const response = await POST(
      request({
        to: "in_validation",
        validationReopenReason: "Revisão administrativa das evidências aprovadas.",
      }),
      { params: Promise.resolve({ cycleId: mocks.cycleId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.reopenValidation).toHaveBeenCalledWith(mocks.cycleId, "admin-1", {
      reason: "Revisão administrativa das evidências aprovadas.",
    });
    expect(mocks.transition).not.toHaveBeenCalled();
    await expect(response.json()).resolves.toEqual({
      cycle: { id: mocks.cycleId, from: "validated", to: "in_validation" },
      closed: false,
      report: null,
    });
  });

  it("reabre o diagnóstico concluído com prazo e justificativa", async () => {
    mocks.cycle.state = "completed";
    mocks.updated.state = "in_response";
    mocks.reopen.mockResolvedValue(mocks.updated);

    const response = await POST(
      request({
        to: "in_response",
        reopenReason: "Correção institucional solicitada pela auditoria.",
        reopenResponseDeadlineAt: "2030-08-30T21:00:00.000Z",
      }),
      { params: Promise.resolve({ cycleId: mocks.cycleId }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.reopen).toHaveBeenCalledWith(mocks.cycleId, "admin-1", {
      reason: "Correção institucional solicitada pela auditoria.",
      responseDeadlineAt: "2030-08-30T21:00:00.000Z",
    });
    expect(mocks.reopenValidation).not.toHaveBeenCalled();
  });

  it("rejeita payload sem destino", async () => {
    const response = await POST(request({}), {
      params: Promise.resolve({ cycleId: mocks.cycleId }),
    });

    expect(response.status).toBe(400);
    expect(mocks.reopenValidation).not.toHaveBeenCalled();
  });
});
