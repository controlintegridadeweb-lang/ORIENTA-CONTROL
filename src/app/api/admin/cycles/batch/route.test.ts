import { beforeEach, describe, expect, it, vi } from "vitest";

const FORM_ID = "5fd07e6d-a83a-432d-93f6-922f0d7c7485";
const ORG_ID = "8bd07e6d-a83a-432d-93f6-922f0d7c7485";

const mocks = vi.hoisted(() => ({
  auth: {
    userId: "admin-1",
    role: "admin" as const,
    organizationId: null as string | null,
    mfaVerified: true,
  },
  tenantError: null as Response | null,
  processCycles: vi.fn(),
  supabase: { rpc: vi.fn() },
}));

vi.mock("@/infrastructure/api/with-route", () => ({
  withRoute:
    (_options: unknown, handler: (input: Record<string, unknown>) => Promise<Response>) =>
    (request: Request) => handler({ request, auth: mocks.auth }),
}));
vi.mock("@/infrastructure/api/tenant-guard", () => ({
  ensureOrganizationAccess: vi.fn(() => mocks.tenantError),
}));
vi.mock("@/infrastructure/supabase/server", () => ({
  createSupabaseServiceRoleClient: vi.fn(() => mocks.supabase),
}));
vi.mock("@/features/cycles/create-cycle-service", () => ({
  processCyclesForOrganizations: mocks.processCycles,
}));
vi.mock("@/infrastructure/api/domain-errors", () => ({
  handleDomainError: vi.fn(() =>
    Response.json({ error: "Falha de domínio." }, { status: 409 }),
  ),
}));

import { POST } from "./route";

function request(body: unknown) {
  return new Request("http://localhost/api/admin/cycles/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function validDraft(overrides: Record<string, unknown> = {}) {
  return {
    formId: FORM_ID,
    organizationIds: [ORG_ID],
    periodLabel: "2026",
    referenceStartYear: 2026,
    referenceEndYear: 2026,
    mode: "draft",
    reminderOffsetsDays: [],
    ...overrides,
  };
}

describe("POST /api/admin/cycles/batch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tenantError = null;
    mocks.processCycles.mockResolvedValue({ created: 1, reused: 0 });
  });

  it("rejeita payload sem organização", async () => {
    const response = await POST(request(validDraft({ organizationIds: [] })));

    expect(response.status).toBe(400);
    expect(mocks.processCycles).not.toHaveBeenCalled();
  });

  it("interrompe quando o administrador não pode operar a organização", async () => {
    mocks.tenantError = Response.json({ error: "Acesso negado." }, { status: 403 });

    const response = await POST(request(validDraft()));

    expect(response.status).toBe(403);
    expect(mocks.processCycles).not.toHaveBeenCalled();
  });

  it("remove organizações duplicadas e usa a identidade autenticada", async () => {
    const response = await POST(
      request(validDraft({ organizationIds: [ORG_ID, ORG_ID] })),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.mode).toBe("draft");
    expect(mocks.processCycles).toHaveBeenCalledWith(mocks.supabase, {
      formId: FORM_ID,
      organizationIds: [ORG_ID],
      periodLabel: "2026",
      referenceStartYear: 2026,
      referenceEndYear: 2026,
      actorUserId: "admin-1",
      mode: "draft",
      startsAt: null,
      responseDeadlineAt: null,
      reminderOffsetsDays: [],
      validationDeadlineAt: undefined,
      cycleCloseAt: undefined,
    });
  });
});
