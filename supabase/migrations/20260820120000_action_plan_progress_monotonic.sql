-- ORIENTA — o percentual persistido da ação é piso. Andamento só avança;
-- redução exigiria reescrever o histórico de atualizações já registrado.

create or replace function public.guard_action_plan_progress_monotonic()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.progress_percentage < old.progress_percentage then
    raise exception 'action_plan_progress_cannot_decrease' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger action_plans_guard_progress_monotonic
before update of progress_percentage on public.action_plans
for each row execute function public.guard_action_plan_progress_monotonic();

revoke all on function public.guard_action_plan_progress_monotonic() from public, anon, authenticated;
grant execute on function public.guard_action_plan_progress_monotonic() to service_role;

comment on function public.guard_action_plan_progress_monotonic() is
  'Impede redução de action_plans.progress_percentage. O andamento da ação só avança.';

notify pgrst, 'reload schema';
