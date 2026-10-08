-- ============================================================================
-- Verificação de integração: alteração do início da ação exige solicitação
-- formal e decisão administrativa. O início vigente não pode ser editado
-- diretamente pelo respondente nem por SQL fora da RPC de decisão.
-- Pré: _seed_minimal.sql. Saída esperada: "ACTION PLAN START DATE CHANGE: OK".
-- ============================================================================
begin;

set local session_replication_role = replica;
insert into auth.users(id, email)
values ('00000000-0000-0000-0000-0000000000a8','respondent-start@orienta.test')
on conflict do nothing;
insert into public.profiles(user_id, role, organization_id, full_name)
values ('00000000-0000-0000-0000-0000000000a8','respondent','00000000-0000-0000-0000-0000000000b1','Respondente Início')
on conflict (user_id) do update set role=excluded.role, organization_id=excluded.organization_id;
insert into public.cycles(id, form_version_id, organization_id, period_id, period_label, state)
values (
  '00000000-0000-0000-0000-000000000cc8',
  '00000000-0000-0000-0000-000000000bb1',
  '00000000-0000-0000-0000-0000000000b1',
  (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','start-change','start-change')).id,
  'start-change',
  'validated'
)
on conflict (id) do update set state='validated', period_id=excluded.period_id;
insert into public.cycle_processings(id, cycle_id, processing_version, status, fami_policy_version, completed_at)
values ('00000000-0000-0000-0000-000000000ee8','00000000-0000-0000-0000-000000000cc8',1,'completed','v7',now())
on conflict (id) do update set status='completed', completed_at=now();
insert into public.recommendations(id, cycle_id, cycle_processing_id, question_version_id, tipo, text)
values ('00000000-0000-0000-0000-000000000b98','00000000-0000-0000-0000-000000000cc8','00000000-0000-0000-0000-000000000ee8','00000000-0000-0000-0000-0000000000f1','nao_implementacao','Recomendação para teste de início')
on conflict (id) do nothing;
insert into public.action_plans(
  id, recommendation_id, axis_id, action_text, start_date, due_date,
  responsible_user_id, responsible_label, progress_percentage, status, revision
)
select
  '00000000-0000-0000-0000-000000000a98',
  '00000000-0000-0000-0000-000000000b98',
  qv.axis_id,
  'Executar ação usada para validar alteração formal do início',
  current_date,
  current_date + 40,
  '00000000-0000-0000-0000-0000000000a8',
  'Integridade — Respondente Início',
  0,
  'todo',
  1
from public.question_versions qv
where qv.id = '00000000-0000-0000-0000-0000000000f1'
on conflict (id) do nothing;
set local session_replication_role = origin;

do $$
declare
  v_plan_id constant uuid := '00000000-0000-0000-0000-000000000a98';
  v_recommendation_id constant uuid := '00000000-0000-0000-0000-000000000b98';
  v_org constant uuid := '00000000-0000-0000-0000-0000000000b1';
  v_respondent constant uuid := '00000000-0000-0000-0000-0000000000a8';
  v_admin constant uuid := '00000000-0000-0000-0000-0000000000a1';
  v_request public.action_plan_deadline_change_requests%rowtype;
  v_due_request public.action_plan_deadline_change_requests%rowtype;
  v_start date;
  v_revision bigint;
begin
  begin
    update public.action_plans set start_date = current_date - 5 where id = v_plan_id;
    raise exception 'FALHOU(direct): start_date foi alterado sem solicitação aprovada';
  exception when insufficient_privilege then
    null;
  end;

  select * into v_request
  from public.request_action_plan_start_date_change(
    v_respondent,
    v_org,
    v_plan_id,
    v_recommendation_id,
    current_date - 5,
    'O planejamento institucional começou antes da data cadastrada.',
    1
  );

  if v_request.change_target <> 'start_date'::public.action_plan_deadline_change_target
     or v_request.previous_start_date <> current_date
     or v_request.requested_start_date <> current_date - 5 then
    raise exception 'FALHOU(request): metadados do início não foram gravados';
  end if;

  select start_date, revision into v_start, v_revision
  from public.action_plans where id = v_plan_id;
  if v_start <> current_date or v_revision <> 1 then
    raise exception 'FALHOU(request): solicitação alterou início/revisão vigente antes da decisão';
  end if;

  select * into v_due_request
  from public.request_action_plan_deadline_change(
    v_respondent,
    v_org,
    v_plan_id,
    v_recommendation_id,
    current_date + 50,
    'Solicitação de final independente da solicitação de início.',
    1
  );
  if v_due_request.status <> 'pending'::public.action_plan_deadline_change_status then
    raise exception 'FALHOU(parallel): solicitação de final foi bloqueada por pedido de início pendente';
  end if;

  begin
    perform public.request_action_plan_start_date_change(
      v_respondent, v_org, v_plan_id, v_recommendation_id,
      current_date - 2,
      'Segunda solicitação indevida enquanto a primeira segue pendente.',
      1
    );
    raise exception 'FALHOU(unique): segunda solicitação de início pendente foi aceita';
  exception when unique_violation then
    null;
  end;

  perform public.decide_action_plan_deadline_change(
    v_admin,
    v_request.id,
    'rejected'::public.action_plan_deadline_change_status,
    'O cronograma apresentado ainda não justifica a antecipação.'
  );

  select start_date, revision into v_start, v_revision
  from public.action_plans where id = v_plan_id;
  if v_start <> current_date or v_revision <> 1 then
    raise exception 'FALHOU(reject): rejeição modificou o início vigente';
  end if;

  select * into v_request
  from public.request_action_plan_start_date_change(
    v_respondent,
    v_org,
    v_plan_id,
    v_recommendation_id,
    current_date - 3,
    'Novo início fundamentado após ajuste do planejamento institucional.',
    1
  );

  select * into v_request
  from public.decide_action_plan_deadline_change(
    v_admin,
    v_request.id,
    'approved'::public.action_plan_deadline_change_status,
    'Antecipação aprovada com base no planejamento e na justificativa apresentados.'
  );

  select start_date, revision into v_start, v_revision
  from public.action_plans where id = v_plan_id;
  if v_start <> current_date - 3 or v_revision <> 2 then
    raise exception 'FALHOU(approve): início/revisão após aprovação = % / %, esperado % / 2',
      v_start, v_revision, current_date - 3;
  end if;
  if v_request.status <> 'approved'::public.action_plan_deadline_change_status
     or v_request.applied_action_revision <> v_revision
     or v_request.decision_reason is null then
    raise exception 'FALHOU(history): decisão aprovada não preservou metadados/revisão';
  end if;

  raise notice 'ACTION PLAN START DATE CHANGE: OK';
end $$;

rollback;
