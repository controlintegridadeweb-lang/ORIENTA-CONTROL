import { describe, expect, it, vi } from "vitest";
import { listPreliminaryCheckpoints } from "./read";
import type { TypedSupabaseClient } from "@/infrastructure/supabase/server";

const CYCLE_ID = "a673b88b-b0a3-4892-87b4-17777c1e4a92";

type QueryCall = {
  table: string;
  filters: Array<{ method: string; args: unknown[] }>;
};

function makeClient(results: Record<string, { data: unknown; error: unknown }>) {
  const calls: QueryCall[] = [];

  function chain(table: string) {
    const record: QueryCall = { table, filters: [] };
    calls.push(record);
    const result = results[table] ?? { data: null, error: null };
    const query = {
      select(...args: unknown[]) {
        record.filters.push({ method: "select", args });
        return query;
      },
      eq(...args: unknown[]) {
        record.filters.push({ method: "eq", args });
        return query;
      },
      in(...args: unknown[]) {
        record.filters.push({ method: "in", args });
        return query;
      },
      order() {
        return query;
      },
      limit() {
        return query;
      },
      maybeSingle: async () => result,
      then(
        resolve: (value: { data: unknown; error: unknown }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) {
        return Promise.resolve(result).then(resolve, reject);
      },
    };
    return query;
  }

  return {
    calls,
    from: vi.fn((table: string) => chain(table)),
  };
}

describe("listPreliminaryCheckpoints", () => {
  it("carrega o acompanhamento por cycle_id, sem listas de IDs no filtro", async () => {
    const client = makeClient({
      fami_preliminary_processings: { data: [], error: null },
      fami_results: { data: { created_at: "2026-08-07T12:00:00.000Z" }, error: null },
      action_plans: { data: { created_at: "2026-08-10T15:00:00.000Z" }, error: null },
    });

    const payload = await listPreliminaryCheckpoints(
      client as unknown as TypedSupabaseClient,
      CYCLE_ID,
      2026,
    );

    expect(payload.tracking).toEqual({
      officialAvailableAt: "2026-08-07T12:00:00.000Z",
      earliestActionCreatedAt: "2026-08-10T15:00:00.000Z",
    });

    const trackingCalls = client.calls.filter((call) =>
      call.table === "fami_results" || call.table === "action_plans",
    );
    expect(trackingCalls).toHaveLength(2);
    for (const call of trackingCalls) {
      expect(call.filters.some((filter) => filter.method === "in")).toBe(false);
    }

    const official = trackingCalls.find((call) => call.table === "fami_results");
    expect(official?.filters).toContainEqual({ method: "eq", args: ["cycle_id", CYCLE_ID] });
    expect(official?.filters).toContainEqual({
      method: "eq",
      args: ["cycle_processings.status", "completed"],
    });

    const actions = trackingCalls.find((call) => call.table === "action_plans");
    expect(actions?.filters).toContainEqual({
      method: "eq",
      args: ["recommendations.cycle_id", CYCLE_ID],
    });
    expect(actions?.filters).toContainEqual({
      method: "eq",
      args: ["recommendations.cycle_processings.status", "completed"],
    });
  });
});
