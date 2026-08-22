import { describe, expect, it } from "vitest";
import { recordAudit } from "./record-audit";

function fakeClient(captured: unknown[], error: unknown = null) {
  return {
    from: (table: string) => {
      expect(table).toBe("audit_logs");
      return {
        insert: async (row: unknown) => {
          captured.push(row);
          return { error };
        },
      };
    },
  } as unknown as Parameters<typeof recordAudit>[0];
}

describe("recordAudit — formato canônico de audit_logs", () => {
  it("insere com as colunas reais (actor_user_id/event_type/entity_type/*_json)", async () => {
    const captured: unknown[] = [];
    await recordAudit(fakeClient(captured), {
      actorUserId: "user-1",
      eventType: "organization.created",
      entityType: "organizations",
      recordId: "org-1",
      after: { name: "Org" },
    });
    expect(captured[0]).toEqual({
      actor_user_id: "user-1",
      event_type: "organization.created",
      entity_type: "organizations",
      record_id: "org-1",
      before_json: null,
      after_json: { name: "Org" },
    });
  });

  it("lança quando o insert falha (não engole o erro)", async () => {
    const captured: unknown[] = [];
    await expect(
      recordAudit(fakeClient(captured, { message: "boom" }), {
        actorUserId: null,
        eventType: "x",
        entityType: "y",
        recordId: "z",
      }),
    ).rejects.toThrow(/audit_log_insert_failed/);
  });
});
