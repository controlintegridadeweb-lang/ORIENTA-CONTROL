-- ============================================================================
-- Verificação de integração: alteração do prazo de ação exige solicitação
-- formal e decisão administrativa. O prazo vigente não pode ser editado
-- diretamente pelo respondente nem por SQL fora da RPC de decisão.
-- Pré: _seed_minimal.sql. Saída esperada: "ACTION PLAN DEADLINE CHANGE: OK".
-- ============================================================================
begin;

set local session_replication_role = replica;
insert into auth.users(id, email)
values ('00000000-0000-0000-0000-0000000000a9','respondent-deadline@orienta.test')
on conflict do nothing;
insert into public.profiles(user_id, role, organization_id, full_name)
values ('00000000-0000-0000-0000-0000000000a9','respondent','00000000-0000-0000-0000-0000000000b1','Respondente Prazo')
on conflict (user_id) do update set role=excluded.role, organization_id=excluded.organization_id;
insert into public.cycles(id, form_version_id, organization_id, period_id, period_label, state)
values (
  '00000000-0000-0000-0000-000000000cc9',
  '00000000-0000-0000-0000-000000000bb1',
  '00000000-0000-0000-0000-0000000000b1',
  (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','deadline-change','deadline-change')).id,
  'deadline-change',
  'validated'
)
on conflict (id) do update set state='validated', period_id=excluded.period_id;
insert into public.cycle_processings(id, cycle_id, processing_version, status, fami_policy_version, completed_at)
values ('00000000-0000-0000-0000-000000000ee9','00000000-0000-0000-0000-000000000cc9',1,'completed','v7',now())
on conflict (id) do update set status='completed', completed_at=now();
insert into public.recommendations(id, cycle_id, cycle_processing_id, question_version_id, tipo, text)
values ('00000000-0000-0000-0000-000000000b99','00000000-0000-0000-0000-000000000cc9','00000000-0000-0000-0000-000000000ee9','00000000-0000-0000-0000-0000000000f1','nao_implementacao','Recomendação para teste de prazo')
on conflict (id) do nothing;
insert into public.action_plans(
  id, recommendation_id, axis_id, action_text, start_date, due_date,
  responsible_user_id, responsible_label, progress_percentage, status, revision
)
select
  '00000000-0000-0000-0000-000000000a99',
  '00000000-0000-0000-0000-000000000b99',
  qv.axis_id,
  'Executar ação usada para validar alteração formal de prazo',
  current_date,
  current_date + 30,
  '00000000-0000-0000-0000-0000000000a9',
  'Integridade — Respondente Prazo',
  0,
  'todo',
  1
from public.question_versions qv
where qv.id = '00000000-0000-0000-0000-0000000000f1'
on conflict (id) do nothing;
set local session_replication_role = origin;

do $$
declare
  v_plan_id constant uuid := '00000000-0000-0000-0000-000000000a99';
  v_recommendation_id constant uuid := '00000000-0000-0000-0000-000000000b99';
  v_org constant uuid := '00000000-0000-0000-0000-0000000000b1';
  v_respondent constant uuid := '00000000-0000-0000-0000-0000000000a9';
  v_admin constant uuid := '00000000-0000-0000-0000-0000000000a1';
  v_request public.action_plan_deadline_change_requests%rowtype;
  v_due date;
  v_revision bigint;
begin
  begin
    update public.action_plans set due_date = current_date + 45 where id = v_plan_id;
    raise exception 'FALHOU(direct): due_date foi alterado sem solicitação aprovada';
  exception when insufficient_privilege then
    null;
  end;

  select * into v_request
  from public.request_action_plan_deadline_change(
    v_respondent,
    v_org,
    v_plan_id,
    v_recommendation_id,
    current_date + 45,
    'A execução depende de contratação que exige prazo adicional.',
    1
  );

  select due_date, revision into v_due, v_revision
  from public.action_plans where id = v_plan_id;
  if v_due <> current_date + 30 or v_revision <> 1 then
    raise exception 'FALHOU(request): solicitação alterou prazo/revisão vigente antes da decisão';
  end if;

  begin
    perform public.request_action_plan_deadline_change(
      v_respondent, v_org, v_plan_id, v_recommendation_id,
      current_date + 60,
      'Segunda solicitação indevida enquanto a primeira segue pendente.',
      1
    );
    raise exception 'FALHOU(unique): segunda solicitação pendente foi aceita';
  exception when unique_violation then
    null;
  end;

  perform public.decide_action_plan_deadline_change(
    v_admin,
    v_request.id,
    'rejected'::public.action_plan_deadline_change_status,
    'O cronograma apresentado ainda não justifica a prorrogação.'
  );

  select due_date, revision into v_due, v_revision
  from public.action_plans where id = v_plan_id;
  if v_due <> current_date + 30 or v_revision <> 1 then
    raise exception 'FALHOU(reject): rejeição modificou o prazo vigente';
  end if;

  select * into v_request
  from public.request_action_plan_deadline_change(
    v_respondent,
    v_org,
    v_plan_id,
    v_recommendation_id,
    current_date + 60,
    'Novo cronograma fundamentado após ajuste da contratação institucional.',
    1
  );

  select * into v_request
  from public.decide_action_plan_deadline_change(
    v_admin,
    v_request.id,
    'approved'::public.action_plan_deadline_change_status,
    'Prorrogação aprovada com base no cronograma e na justificativa apresentados.'
  );

  select due_date, revision into v_due, v_revision
  from public.action_plans where id = v_plan_id;
  if v_due <> current_date + 60 or v_revision <> 2 then
    raise exception 'FALHOU(approve): prazo/revisão após aprovação = % / %, esperado % / 2',
      v_due, v_revision, current_date + 60;
  end if;
  if v_request.status <> 'approved'::public.action_plan_deadline_change_status
     or v_request.applied_action_revision <> v_revision
     or v_request.decision_reason is null then
    raise exception 'FALHOU(history): decisão aprovada não preservou metadados/revisão';
  end if;

  raise notice 'ACTION PLAN DEADLINE CHANGE: OK';
end $$;

rollback;
