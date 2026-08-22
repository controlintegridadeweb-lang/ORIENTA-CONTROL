import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAuthorizedWorkbenchContext } from "./authorized-context";

const { resolveAuthorizedCycleScope, ensureRespondentAssignmentAccess } = vi.hoisted(() => ({
  resolveAuthorizedCycleScope: vi.fn(),
  ensureRespondentAssignmentAccess: vi.fn(),
}));

vi.mock("@/features/cycles/authorized-cycle", () => ({ resolveAuthorizedCycleScope }));
vi.mock("@/features/forms/assignments/http", () => ({ ensureRespondentAssignmentAccess }));
vi.mock("@/infrastructure/supabase/server", () => ({ createSupabaseServiceRoleClient: vi.fn() }));

describe("resolveAuthorizedWorkbenchContext", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna o contexto somente após validar ciclo, organização e atribuição", async () => {
    const scope = {
      formId: "form-id",
      cycle: { id: "cycle-id", organizationId: "org-id" },
    };
    resolveAuthorizedCycleScope.mockResolvedValue({ scope, error: null });
    ensureRespondentAssignmentAccess.mockResolvedValue(null);
    const auth = {
      userId: "user-id",
      role: "respondent",
      organizationId: "org-id",
      mfaVerified: false,
    } as const;
    const supabase = {} as never;

    const result = await resolveAuthorizedWorkbenchContext(auth, "cycle-id", supabase);

    expect(result).toEqual({ context: { auth, supabase, scope }, error: null });
    expect(ensureRespondentAssignmentAccess).toHaveBeenCalledWith("respondent", "form-id", "org-id");
  });

  it("interrompe quando o ciclo não é autorizado", async () => {
    const error = new Response(null, { status: 403 });
    resolveAuthorizedCycleScope.mockResolvedValue({ scope: null, error });

    const result = await resolveAuthorizedWorkbenchContext(
      {
        userId: "user-id",
        role: "respondent",
        organizationId: "org-id",
        mfaVerified: false,
      },
      "cycle-id",
      {} as never,
    );

    expect(result).toEqual({ context: null, error });
    expect(ensureRespondentAssignmentAccess).not.toHaveBeenCalled();
  });
});
