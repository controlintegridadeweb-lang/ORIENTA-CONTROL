import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Registro manual de auditoria no formato CANÔNICO de `audit_logs`.
 *
 * Fonte única para inserts manuais de auditoria, evitando o erro recorrente de
 * usar nomes de coluna inexistentes (`actor_id`/`table_name`/`old_value`/
 * `new_value`). As colunas reais são: `actor_user_id`, `event_type`,
 * `entity_type`, `record_id`, `before_json`, `after_json`.
 *
 * Para mutações que passam por RPC, o ator já é gravado pelo trigger
 * `audit_row_change` via `set_audit_actor` (migration 0001). Este helper é para
 * eventos de domínio que NÃO disparam o trigger ou que precisam de um
 * `event_type` semântico próprio.
 */
export type AuditEventInput = {
  actorUserId: string | null;
  eventType: string;
  entityType: string;
  recordId: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
};

export async function recordAudit(
  client: SupabaseClient,
  event: AuditEventInput,
): Promise<void> {
  const { error } = await client.from("audit_logs").insert({
    actor_user_id: event.actorUserId,
    event_type: event.eventType,
    entity_type: event.entityType,
    record_id: event.recordId,
    before_json: event.before ?? null,
    after_json: event.after ?? null,
  });
  if (error) {
    throw new Error(`audit_log_insert_failed: ${error.message}`);
  }
}
