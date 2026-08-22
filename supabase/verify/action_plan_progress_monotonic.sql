-- ============================================================================
-- Verificação de integração: o percentual da ação não pode retroceder.
-- Pré: _seed_minimal.sql. Saída esperada: "ACTION PLAN PROGRESS MONOTONIC: OK".
-- ============================================================================
begin;

set local session_replication_role = replica;
insert into auth.users(id, email)
values ('00000000-0000-0000-0000-0000000000aa','respondent-progress@orienta.test')
on conflict do nothing;
insert into public.profiles(user_id, role, organization_id, full_name)
values ('00000000-0000-0000-0000-0000000000aa','respondent','00000000-0000-0000-0000-0000000000b1','Respondente Progresso')
on conflict (user_id) do update set role=excluded.role, organization_id=excluded.organization_id;
insert into public.cycles(id, form_version_id, organization_id, period_id, period_label, state)
values (
  '00000000-0000-0000-0000-000000000cca',
  '00000000-0000-0000-0000-000000000bb1',
  '00000000-0000-0000-0000-0000000000b1',
  (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','progress-monotonic','progress-monotonic')).id,
  'progress-monotonic',
  'validated'
)
on conflict (id) do update set state='validated', period_id=excluded.period_id;
insert into public.cycle_processings(id, cycle_id, processing_version, status, fami_policy_version, completed_at)
values ('00000000-0000-0000-0000-000000000eea','00000000-0000-0000-0000-000000000cca',1,'completed','v7',now())
on conflict (id) do update set status='completed', completed_at=now();
insert into public.recommendations(id, cycle_id, cycle_processing_id, question_version_id, tipo, text)
values ('00000000-0000-0000-0000-000000000b9a','00000000-0000-0000-0000-000000000cca','00000000-0000-0000-0000-000000000eea','00000000-0000-0000-0000-0000000000f1','nao_implementacao','Recomendação para teste de progresso monotônico')
on conflict (id) do nothing;
insert into public.action_plans(
  id, recommendation_id, axis_id, action_text, start_date, due_date,
  responsible_user_id, responsible_label, progress_percentage, status, revision
)
select
  '00000000-0000-0000-0000-000000000a9a',
  '00000000-0000-0000-0000-000000000b9a',
  qv.axis_id,
  'Executar ação usada para validar progresso que só avança',
  current_date,
  current_date + 30,
  '00000000-0000-0000-0000-0000000000aa',
  'Integridade — Respondente Progresso',
  40,
  'doing',
  1
from public.question_versions qv
where qv.id = '00000000-0000-0000-0000-0000000000f1'
on conflict (id) do update
  set progress_percentage = 40,
      status = 'doing';
set local session_replication_role = origin;

do $$
declare
  v_plan_id constant uuid := '00000000-0000-0000-0000-000000000a9a';
  v_progress integer;
begin
  begin
    update public.action_plans
      set progress_percentage = 10
    where id = v_plan_id;
    raise exception 'FALHOU(decrease): progress_percentage foi reduzido';
  exception when raise_exception then
    if sqlerrm not like '%action_plan_progress_cannot_decrease%' then
      raise;
    end if;
  end;

  update public.action_plans
    set progress_percentage = 40
  where id = v_plan_id;

  update public.action_plans
    set progress_percentage = 55
  where id = v_plan_id;

  select progress_percentage into v_progress
  from public.action_plans
  where id = v_plan_id;

  if v_progress is distinct from 55 then
    raise exception 'FALHOU(increase): progresso esperado 55, obtido %', v_progress;
  end if;
end $$;

set local session_replication_role = replica;
delete from public.action_plans where id = '00000000-0000-0000-0000-000000000a9a';
delete from public.recommendations where id = '00000000-0000-0000-0000-000000000b9a';
delete from public.cycle_processings where id = '00000000-0000-0000-0000-000000000eea';
delete from public.cycles where id = '00000000-0000-0000-0000-000000000cca';
delete from public.profiles where user_id = '00000000-0000-0000-0000-0000000000aa';
delete from auth.users where id = '00000000-0000-0000-0000-0000000000aa';
set local session_replication_role = origin;

do $$ begin raise notice 'ACTION PLAN PROGRESS MONOTONIC: OK'; end $$;

commit;
