import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { logError, logInfo } from "@/infrastructure/observability/logger";
import type { LibraryCatalogEntity, LibraryItemType } from "./types";

type LibraryAuditAction =
  | "created"
  | "submitted_to_review"
  | "review_returned"
  | "review_approved"
  | "published"
  | "deprecated"
  | "archived"
  | "binding_updated"
  | "snapshot_captured"
  | "exception_requested"
  | "exception_decided"
;

export type LibraryAuditEvent = {
  action: LibraryAuditAction;
  entity: LibraryCatalogEntity | "binding" | "snapshot" | "exception";
  itemType?: LibraryItemType | null;
  itemId?: string | null;
  actorUserId?: string | null;
  organizationId?: string | null;
  fromStatus?: string | null;
  toStatus?: string | null;
  fromVersion?: string | null;
  toVersion?: string | null;
  justification?: string | null;
  diff?: Record<string, unknown> | null;
  hash?: string | null;
  requestId?: string | null;
  extra?: Record<string, unknown> | null;
};

type AuditPersistenceRow = {
  action: string;
  entity: string;
  item_type: string | null;
  item_id: string | null;
  actor_user_id: string | null;
  organization_id: string | null;
  from_status: string | null;
  to_status: string | null;
  from_version: string | null;
  to_version: string | null;
  justification: string | null;
  diff: Record<string, unknown> | null;
  hash: string | null;
  request_id: string | null;
  extra: Record<string, unknown> | null;
};

class LibraryAuditRecorder {
  private supabase: SupabaseClient | null;

  constructor(client?: SupabaseClient) {
    try {
      this.supabase = client ?? createSupabaseServiceRoleClient();
    } catch {
      this.supabase = null;
    }
  }

  async record(event: LibraryAuditEvent): Promise<void> {
    const logPayload: Record<string, unknown> = {
      action: event.action,
      entity: event.entity,
      itemType: event.itemType ?? null,
      itemId: event.itemId ?? null,
      actorUserId: event.actorUserId ?? null,
      organizationId: event.organizationId ?? null,
      fromStatus: event.fromStatus ?? null,
      toStatus: event.toStatus ?? null,
      fromVersion: event.fromVersion ?? null,
      toVersion: event.toVersion ?? null,
      justification: event.justification ?? null,
      hash: event.hash ?? null,
      requestId: event.requestId ?? null,
    };
    logInfo(`library.audit.${event.action}`, logPayload);

    if (!this.supabase) return;

    const row: AuditPersistenceRow = {
      action: event.action,
      entity: event.entity,
      item_type: event.itemType ?? null,
      item_id: event.itemId ?? null,
      actor_user_id: event.actorUserId ?? null,
      organization_id: event.organizationId ?? null,
      from_status: event.fromStatus ?? null,
      to_status: event.toStatus ?? null,
      from_version: event.fromVersion ?? null,
      to_version: event.toVersion ?? null,
      justification: event.justification ?? null,
      diff: event.diff ?? null,
      hash: event.hash ?? null,
      request_id: event.requestId ?? null,
      extra: event.extra ?? null,
    };

    try {
      const { error } = await this.supabase.from("library_audit_events").insert(row);
      if (error) {
        logError("library.audit.persist_failed", error, {
          action: event.action,
          entity: event.entity,
          itemId: event.itemId ?? null,
        });
      }
    } catch (error) {
      logError("library.audit.persist_threw", error, {
        action: event.action,
        entity: event.entity,
      });
    }
  }
}

let sharedRecorder: LibraryAuditRecorder | null = null;

export function getLibraryAudit(): LibraryAuditRecorder {
  if (!sharedRecorder) sharedRecorder = new LibraryAuditRecorder();
  return sharedRecorder;
}
