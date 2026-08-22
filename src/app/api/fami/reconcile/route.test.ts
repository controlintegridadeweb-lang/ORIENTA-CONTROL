import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: {
    userId: "admin-1",
    role: "admin" as const,
    organizationId: null as string | null,
    mfaVerified: true,
  },
  authError: null as Response | null,
  ensureOrganizationAccess: vi.fn(),
  findCycle: vi.fn(),
  reconcileCycleFami: vi.fn(),
  supabase: {},
}));

vi.mock("@/infrastructure/api/with-route", () => ({
  withRoute:
    (
      options: { extraErrorHandlers?: Array<(error: unknown) => Response | null> },
      handler: (input: Record<string, unknown>) => Promise<Response>,
    ) =>
    async (request: Request) => {
      if (mocks.authError) return mocks.authError;
      try {
        return await handler({ request, auth: mocks.auth, params: {} });
      } catch (error) {
        for (const extra of options.extraErrorHandlers ?? []) {
          const response = extra(error);
          if (response) return response;
        }
        throw error;
      }
    },
}));
vi.mock("@/infrastructure/api/tenant-guard", () => ({
  ensureOrganizationAccess: mocks.ensureOrganizationAccess,
}));
vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => mocks.supabase),
}));
vi.mock("@/features/cycles/cycle-state-service", () => ({
  CycleStateService: class {
    find = mocks.findCycle;
  },
}));
vi.mock("@/features/cycles/commit/reconcile", () => {
  class FamiProcessingNotFoundError extends Error {
    constructor(message = "Nenhum processamento concluído foi encontrado para o diagnóstico.") {
      super(message);
      this.name = "FamiProcessingNotFoundError";
    }
  }
  return {
    FamiProcessingNotFoundError,
    reconcileCycleFami: mocks.reconcileCycleFami,
  };
});

import { FamiProcessingNotFoundError } from "@/features/cycles/commit/reconcile";
import { POST } from "./route";

const cycleId = "5fd07e6d-a83a-432d-93f6-922f0d7c7485";
const processingId = "651f8320-d03f-4546-8395-1bbac3358019";

function request(body: unknown = { cycleId, dryRun: true }) {
  return new Request("http://localhost/api/fami/reconcile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/fami/reconcile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authError = null;
    mocks.ensureOrganizationAccess.mockReturnValue(null);
  });

  it("preserva o early-return de autenticação do wrapper", async () => {
    mocks.authError = Response.json(
      { error: "Autenticação obrigatória." },
      { status: 401 },
    );

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.findCycle).not.toHaveBeenCalled();
  });

  it("rejeita payload que não declara dryRun", async () => {
    const response = await POST(request({ cycleId }));

    expect(response.status).toBe(400);
    expect(mocks.findCycle).not.toHaveBeenCalled();
  });

  it("confere o último processamento concluído mesmo quando o ciclo está reaberto", async () => {
    mocks.findCycle.mockResolvedValue({
      id: cycleId,
      organizationId: "org-1",
      state: "in_response",
    });
    mocks.reconcileCycleFami.mockResolvedValue({
      cycleId,
      cycleProcessingId: processingId,
      processingVersion: 2,
      policy: { version: "v3" },
      recalculated: { pointsObtained: 2.5, pointsPossible: 2.5, percentage: 100, maturityLevel: 5 },
      stored: {
        scopeType: "global",
        scopeId: null,
        pointsObtained: 2.5,
        pointsPossible: 2.5,
        percentage: 100,
        maturityLevel: 5,
      },
      scopes: [],
      matches: true,
    });

    const response = await POST(request());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.reconcileCycleFami).toHaveBeenCalledWith(
      mocks.supabase,
      { cycleId, cycleProcessingId: undefined },
    );
    expect(payload).toMatchObject({
      processingVersion: 2,
      policyVersion: "v3",
      matches: true,
      persisted: false,
    });
  });

  it("retorna conflito quando ainda não existe processamento concluído", async () => {
    mocks.findCycle.mockResolvedValue({
      id: cycleId,
      organizationId: "org-1",
      state: "in_response",
    });
    mocks.reconcileCycleFami.mockRejectedValue(new FamiProcessingNotFoundError());

    const response = await POST(request());

    expect(response.status).toBe(409);
  });
});
