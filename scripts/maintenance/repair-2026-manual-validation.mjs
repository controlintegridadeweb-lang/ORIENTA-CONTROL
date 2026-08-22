import { createServiceRoleSupabaseClient } from "../shared/create-service-role-supabase-client.mjs";

const FORM_NAME = "Diagnóstico de Integridade 2026";
const PERIOD_CODE = "2026.1";

const supabase = createServiceRoleSupabaseClient();

function fail(message) {
  throw new Error(message);
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
  .select("id, period_code, label, starts_at, response_deadline_at, form_version_id")
  .eq("period_code", PERIOD_CODE)
  .maybeSingle();
if (periodError) throw periodError;
if (!period?.id) fail(`Período não encontrado: ${PERIOD_CODE}`);

const { data, error } = await supabase.rpc("repair_cycles_for_manual_fami", {
  p_form_id: form.id,
  p_period_id: period.id,
  p_actor_user_id: admin.user_id,
});
if (error) throw error;

const items = Array.isArray(data?.items) ? data.items : [];
const stateCounts = {};
for (const item of items) {
  const key = `${item.fromState}→${item.toState}`;
  stateCounts[key] = (stateCounts[key] ?? 0) + 1;
}

console.log(
  JSON.stringify(
    {
      actor: admin.full_name,
      form: form.name,
      period: period.label,
      periodDeadlineAt: period.response_deadline_at,
      batchId: data?.batchId ?? null,
      repaired: data?.repaired ?? 0,
      stateCounts,
      items,
    },
    null,
    2,
  ),
);
