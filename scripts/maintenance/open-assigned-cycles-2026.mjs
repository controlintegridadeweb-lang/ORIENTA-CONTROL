import { createServiceRoleSupabaseClient } from "../shared/create-service-role-supabase-client.mjs";

const FORM_NAME = "Diagnóstico de Integridade 2026";
const PERIOD_CODE = "2026.1";
const REFERENCE_START_YEAR = 2026;
const REFERENCE_END_YEAR = 2026;

const supabase = createServiceRoleSupabaseClient();

function fail(message) {
  throw new Error(message);
}

async function fetchAll(table, select, apply) {
  const pageSize = 1000;
  const rows = [];
  for (let from = 0; ; from += pageSize) {
    let q = supabase.from(table).select(select).range(from, from + pageSize - 1);
    q = apply ? apply(q) : q;
    const { data, error } = await q;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

const { data: admin, error: adminError } = await supabase
  .from("profiles")
  .select("user_id, full_name")
  .eq("role", "admin")
  .is("organization_id", null)
  .maybeSingle();
if (adminError) throw adminError;
if (!admin?.user_id) fail("Administrador global não encontrado.");

const { data: form, error: formError } = await supabase
  .from("forms")
  .select("id, name")
  .eq("name", FORM_NAME)
  .maybeSingle();
if (formError) throw formError;
if (!form?.id) fail(`Formulário não encontrado: ${FORM_NAME}`);

const { data: period, error: periodError } = await supabase
  .from("form_periods")
  .select("id, period_code, label, starts_at, response_deadline_at")
  .eq("period_code", PERIOD_CODE)
  .maybeSingle();
if (periodError) throw periodError;
if (!period?.id) fail(`Período não encontrado: ${PERIOD_CODE}`);
if (!period.starts_at || !period.response_deadline_at) {
  fail("O período 2026.1 não tem abertura e prazo oficiais.");
}

const [orgs, assignments, cycles] = await Promise.all([
  fetchAll("organizations", "id, acronym, name"),
  fetchAll("form_assignments", "organization_id", (q) => q.eq("form_id", form.id)),
  fetchAll("cycles", "id, organization_id, period_id, state", (q) =>
    q.eq("period_id", period.id),
  ),
]);

const orgById = new Map(orgs.map((org) => [org.id, org]));
const assignedIds = new Set(assignments.map((row) => row.organization_id));
const cycleOrgIds = new Set(cycles.map((row) => row.organization_id));
const missing = orgs.filter((org) => assignedIds.has(org.id) && !cycleOrgIds.has(org.id));

if (missing.length === 0) {
  console.log(
    JSON.stringify(
      {
        status: "already_open",
        message: "Todos os órgãos atribuídos já têm diagnóstico neste período.",
        assigned: assignedIds.size,
        cycles: cycles.length,
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const { data, error } = await supabase.rpc("process_cycles_batch_with_reference", {
  p_mode: "open",
  p_form_id: form.id,
  p_organization_ids: missing.map((org) => org.id),
  p_period_label: period.label,
  p_reference_start_year: REFERENCE_START_YEAR,
  p_reference_end_year: REFERENCE_END_YEAR,
  p_actor_user_id: admin.user_id,
  p_starts_at: period.starts_at,
  p_response_deadline_at: period.response_deadline_at,
  p_reminder_offsets_days: [],
  p_validation_deadline_at: null,
  p_cycle_close_at: null,
});
if (error) throw error;

const resultItems = Array.isArray(data?.result) ? data.result : [];
const opened = resultItems.map((item) => {
  const org = orgById.get(item.cycle?.organization_id) ?? orgById.get(item.organization_id);
  return {
    status: item.status,
    acronym: org?.acronym ?? item.organization_id,
    state: item.cycle?.state ?? null,
    responseDeadlineAt: item.cycle?.response_deadline_at ?? null,
    message: item.message ?? null,
  };
});

const after = await fetchAll("cycles", "organization_id, state, response_deadline_at", (q) =>
  q.eq("period_id", period.id),
);
const stateCounts = {};
for (const cycle of after) {
  stateCounts[cycle.state] = (stateCounts[cycle.state] ?? 0) + 1;
}

console.log(
  JSON.stringify(
    {
      actor: admin.full_name,
      form: form.name,
      period: period.label,
      startsAt: period.starts_at,
      responseDeadlineAt: period.response_deadline_at,
      requested: missing.map((org) => org.acronym).sort(),
      opened,
      failed: opened.filter((item) => item.status === "failed"),
      assigned: assignedIds.size,
      cyclesAfter: after.length,
      stateCounts,
      schedules: data?.schedules ?? null,
    },
    null,
    2,
  ),
);

if (opened.some((item) => item.status === "failed")) {
  process.exit(1);
}
if (after.length !== assignedIds.size) {
  fail(
    `Esperado ${assignedIds.size} diagnósticos (um por órgão atribuído); há ${after.length}.`,
  );
}
