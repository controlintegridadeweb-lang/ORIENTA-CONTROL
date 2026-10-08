import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase/migrations/20260812001100_action_plan_deadline_change_requests.sql",
  ),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("contrato de alteração formal do prazo da ação", () => {
  it("mantém solicitação em entidade própria e um único pedido pendente por ação", () => {
    expect(migration).toContain("create table public.action_plan_deadline_change_requests");
    expect(migration).toContain("where status = 'pending'");
    expect(migration).toContain("previous_due_date date not null");
    expect(migration).toContain("requested_due_date date not null");
    expect(migration).toContain("reason text not null");
  });

  it("bloqueia update direto do prazo e só a decisão aprovada usa o token transacional", () => {
    expect(migration).toContain("action_plan_due_date_change_requires_approval");
    expect(migration).toContain("app.action_plan_deadline_change_request_id");
    expect(migration).toContain("before update of due_date on public.action_plans");
    expect(migration).toContain("set due_date = v_request.requested_due_date");
  });

  it("separa solicitação respondente de decisão administrativa", () => {
    expect(migration).toContain("function public.request_action_plan_deadline_change");
    expect(migration).toContain("function public.decide_action_plan_deadline_change");
    expect(migration).toContain("profile.role = 'respondent'");
    expect(migration).toContain("profile.role = 'admin'");
  });

  it("preserva auditoria, RLS e notificações com deep link para a ação", () => {
    expect(migration).toContain("audit_action_plan_deadline_change_requests");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("action_plan_deadline_change_requested");
    expect(migration).toContain("action_plan_deadline_change_approved");
    expect(migration).toContain("action_plan_deadline_change_rejected");
    expect(migration).toContain("'/monitoramento?action=' || v_action.id::text");
    expect(migration).toContain("'/monitoramento?action=' || v_request.action_plan_id::text");
  });
});

const startDateMigration = readFileSync(
  join(process.cwd(), "supabase/migrations/20261008120000_action_plan_start_date_change.sql"),
  "utf8",
).replace(/\s+/g, " ").toLowerCase();

describe("contrato de alteração formal do início da ação", () => {
  it("reaproveita a solicitação de prazo e separa um pedido pendente por alvo", () => {
    expect(startDateMigration).toContain("action_plan_deadline_change_target");
    expect(startDateMigration).toContain("previous_start_date");
    expect(startDateMigration).toContain("requested_start_date");
    expect(startDateMigration).toContain("(action_plan_id, change_target)");
  });

  it("bloqueia update direto do início e só a decisão aprovada aplica a nova data", () => {
    expect(startDateMigration).toContain("action_plan_start_date_change_requires_approval");
    expect(startDateMigration).toContain("before update of start_date on public.action_plans");
    expect(startDateMigration).toContain("set start_date = v_request.requested_start_date");
    expect(startDateMigration).toContain("function public.request_action_plan_start_date_change");
  });
});
