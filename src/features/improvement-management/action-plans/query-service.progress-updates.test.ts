import { describe, expect, it, vi } from "vitest";
import { ActionPlansNotFoundError } from "./access";
import { ActionPlansQueryService } from "./query-service";

const planId = "22222222-2222-4222-8222-222222222222";
const recommendationId = "11111111-1111-4111-8111-111111111111";
const organizationId = "44444444-4444-4444-8444-444444444444";
const actorUserId = "33333333-3333-4333-8333-333333333333";

function thenable<T>(result: T) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  builder.select = vi.fn(self);
  builder.eq = vi.fn(self);
  builder.in = vi.fn(self);
  builder.order = vi.fn(self);
  builder.range = vi.fn(self);
  builder.maybeSingle = vi.fn(async () => result);
  builder.then = (resolve: (value: T) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return builder;
}

function clientForProgressUpdates(args: {
  organizationId: string;
  updates?: unknown[];
  profiles?: unknown[];
}) {
  return {
    from(table: string) {
      if (table === "action_plans") {
        return thenable({
          data: { id: planId, recommendation_id: recommendationId },
          error: null,
        });
      }
      if (table === "recommendations") {
        return thenable({
          data: { id: recommendationId, cycles: { organization_id: args.organizationId } },
          error: null,
        });
      }
      if (table === "action_plan_progress_updates") {
        return thenable({ data: args.updates ?? [], error: null });
      }
      if (table === "profiles") {
        return thenable({ data: args.profiles ?? [], error: null });
      }
      throw new Error(`tabela inesperada: ${table}`);
    },
  };
}

describe("ActionPlansQueryService.listPlanProgressUpdates", () => {
  it("não revela atualizações de outra organização", async () => {
    const service = new ActionPlansQueryService(
      clientForProgressUpdates({ organizationId }) as never,
    );

    await expect(
      service.listPlanProgressUpdates(planId, {
        role: "respondent",
        organizationId: "55555555-5555-4555-8555-555555555555",
      }),
    ).rejects.toBeInstanceOf(ActionPlansNotFoundError);
  });

  it("devolve o histórico da ação com o nome de quem atualizou", async () => {
    const service = new ActionPlansQueryService(
      clientForProgressUpdates({
        organizationId,
        updates: [
          {
            id: "upd-1",
            previous_percentage: 0,
            new_percentage: 15,
            previous_status: "todo",
            new_status: "doing",
            description: "Capacitação iniciada com a equipe.",
            created_at: "2026-08-13T12:00:00Z",
            created_by: actorUserId,
          },
        ],
        profiles: [{ user_id: actorUserId, full_name: "Alice" }],
      }) as never,
    );

    await expect(
      service.listPlanProgressUpdates(planId, {
        role: "respondent",
        organizationId,
      }),
    ).resolves.toEqual([
      {
        id: "upd-1",
        previousPercentage: 0,
        newPercentage: 15,
        previousStatus: "not_started",
        newStatus: "in_progress",
        description: "Capacitação iniciada com a equipe.",
        createdAt: "2026-08-13T12:00:00Z",
        createdByName: "Alice",
      },
    ]);
  });
});
