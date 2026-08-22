import { beforeEach, describe, expect, it, vi } from "vitest";

const CYCLE_ID = "76fe8b00-5d04-4b03-9a64-39377413a732";

const mocks = vi.hoisted(() => ({
  auth: {
    userId: "admin-1",
    role: "admin" as const,
    organizationId: null as string | null,
    mfaVerified: true,
  },
  authorizedError: null as Response | null,
  impact: {
    actionPlanCount: 0,
    supervisionNoteCount: 0,
    exceptionCount: 0,
    blocked: false,
  },
  getImpact: vi.fn(),
  supabase: { rpc: vi.fn() },
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
  createSupabaseServiceRoleClient: vi.fn(() => mocks.supabase),
}));
vi.mock("@/features/cycles/authorized-cycle", () => ({
  resolveAuthorizedCycleScope: vi.fn(async () =>
    mocks.authorizedError
      ? { scope: null, error: mocks.authorizedError }
      : { scope: { cycle: { organizationId: "org-1" } }, error: null },
  ),
}));
vi.mock("@/features/cycles/validation-reopen-impact", () => ({
  getValidationReopenImpact: (...args: unknown[]) => mocks.getImpact(...args),
}));

import { GET } from "./route";

function request() {
  return new Request(
    `http://localhost/api/admin/cycles/${CYCLE_ID}/validation-reopen-impact`,
  );
}

describe("GET /api/admin/cycles/[cycleId]/validation-reopen-impact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authorizedError = null;
    mocks.getImpact.mockResolvedValue(mocks.impact);
  });

  it("devolve o impacto da reabertura do diagnóstico autorizado", async () => {
    const response = await GET(request(), {
      params: Promise.resolve({ cycleId: CYCLE_ID }),
    });

    expect(response.status).toBe(200);
    expect(mocks.getImpact).toHaveBeenCalledWith(mocks.supabase, CYCLE_ID);
    await expect(response.json()).resolves.toEqual({ impact: mocks.impact });
  });

  it("não consulta o impacto quando o diagnóstico não é autorizado", async () => {
    mocks.authorizedError = Response.json(
      { error: "Diagnóstico não encontrado." },
      { status: 404 },
    );

    const response = await GET(request(), {
      params: Promise.resolve({ cycleId: CYCLE_ID }),
    });

    expect(response.status).toBe(404);
    expect(mocks.getImpact).not.toHaveBeenCalled();
  });
});
