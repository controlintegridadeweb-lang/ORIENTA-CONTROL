import { describe, expect, it, vi } from "vitest";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { changeFormApplicationDeadlines } from "./management-service";

describe("changeFormApplicationDeadlines", () => {
  it("recusa prazo no passado antes de chamar o banco", async () => {
    const rpc = vi.fn();
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({ data: [], error: null }),
          }),
        }),
      }),
      rpc,
    };

    await expect(
      changeFormApplicationDeadlines(supabase as never, {
        formId: "11111111-1111-1111-1111-111111111111",
        periodLabel: "2026",
        action: "change_deadline",
        scope: "all",
        newDeadlineAt: "2020-01-01T00:00:00.000Z",
        justification: "Justificativa administrativa válida.",
        actorUserId: "22222222-2222-2222-2222-222222222222",
      }),
    ).rejects.toBeInstanceOf(DomainValidationError);

    expect(rpc).not.toHaveBeenCalled();
  });

  it("recusa justificativa curta", async () => {
    await expect(
      changeFormApplicationDeadlines(
        { rpc: vi.fn() } as never,
        {
          formId: "11111111-1111-1111-1111-111111111111",
          periodLabel: "2026",
          action: "change_deadline",
          scope: "all",
          newDeadlineAt: "2030-01-01T00:00:00.000Z",
          justification: "curto",
          actorUserId: "22222222-2222-2222-2222-222222222222",
        },
      ),
    ).rejects.toBeInstanceOf(DomainValidationError);
  });
});
