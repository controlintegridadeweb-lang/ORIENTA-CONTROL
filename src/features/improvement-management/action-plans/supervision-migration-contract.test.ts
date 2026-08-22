import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const read = (name: string) => readFileSync(join(migrationsDir, name), "utf8");
const compactSql = (value: string) => value.replace(/\s+/g, "").toLowerCase();
const schema = compactSql(read("20260812000200_schema.sql"));
const functions = compactSql(read("20260812000500_functions.sql"));
const triggers = compactSql(read("20260812000600_triggers.sql"));

describe("contrato canônico da supervisão do plano de ação", () => {
  it("versiona alterações materiais e preserva rastreabilidade", () => {
    expect(schema).toContain("revisionbigintnotnulldefault1");
    expect(functions).toContain("new.revision:=old.revision+1");
  });

  it("vincula o parecer à ação e preserva a revisão analisada", () => {
    expect(schema).toContain("action_plan_iduuidreferencespublic.action_plans(id)ondeleterestrict");
    expect(functions).toContain("functionpublic.lock_supervision_cycle");
    expect(functions).toContain("functionpublic.create_action_plan_supervision_note");
  });

  it("exige ação concluída, sem solicitação aberta e com aceite vigente", () => {
    expect(functions).toContain("supervision_approval_requires_completed_action");
    expect(functions).toContain("supervision_approval_requires_execution_evidence");
    expect(functions).toContain("missing_execution_evidence");
    expect(functions).toContain("close_requires_completed_and_approved_action_plans");
    expect(functions).toContain("functionpublic.cycle_action_plan_supervision_blockers");
  });

  it("promove uploads diretos por RPC atômica, idempotente e com limpeza durável", () => {
    expect(schema).toContain("pending_action_plan_document_uploads");
    expect(functions).toContain("functionpublic.initialize_action_plan_document_upload");
    expect(functions).toContain("functionpublic.commit_action_plan_document_upload");
    expect(functions).toContain("functionpublic.discard_pending_action_plan_document_upload");
    expect(functions).toContain("insertintopublic.action_plan_storage_cleanup_queue");
  });

  it("remove comprovações por desativação auditável e outbox transacional", () => {
    expect(schema).toContain("action_plan_storage_cleanup_queue");
    expect(functions).toContain("functionpublic.deactivate_action_plan_document");
    expect(functions).toContain("action_plan_document_approval_effective");
  });

  it("direciona notificações ao responsável e mantém triggers de supervisão", () => {
    expect(functions).toContain("action_plan_supervision_acknowledged");
    expect(functions).toContain("action_plan_supervision_decided");
    expect(triggers).toContain("action_plan_supervision_notes_notify_respondents");
  });
});
