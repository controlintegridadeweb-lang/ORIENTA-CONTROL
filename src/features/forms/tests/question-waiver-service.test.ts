import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { QuestionWaiverService } from "../question-waiver-service";

describe("QuestionWaiverService", () => {
  it("divide listas grandes em blocos seguros sem duplicar organizações", async () => {
    const chunks: string[][] = [];
    const client = {
      from: (table: string) => {
        expect(table).toBe("question_organization_waivers");
        const builder = {
          select: () => builder,
          in: (_column: string, organizationIds: string[]) => {
            chunks.push(organizationIds);
            return Promise.resolve({
              data: organizationIds.map((organizationId) => ({
                organization_id: organizationId,
                question_id: `question-${organizationId}`,
                reason: null,
                waived_by: "admin-1",
                waived_at: "2026-07-16T12:00:00.000Z",
              })),
              error: null,
            });
          },
        };
        return builder;
      },
    } as unknown as SupabaseClient;

    const organizationIds = Array.from(
      { length: 401 },
      (_, index) => `organization-${index}`,
    );
    organizationIds.push("organization-0");

    const result = await new QuestionWaiverService(
      client,
    ).listWaiversForOrganizations(organizationIds);

    expect(chunks.map((chunk) => chunk.length)).toEqual([200, 200, 1]);
    expect(result).toHaveLength(401);
    expect(new Set(result.map((row) => row.organizationId)).size).toBe(401);
  });
});
