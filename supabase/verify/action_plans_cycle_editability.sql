-- ============================================================================
-- Verificação de integração: autorização, integridade e auditoria de planos.
-- Pré: _seed_minimal.sql. Saída: "ACTION PLANS CYCLE EDITABILITY: OK".
-- ============================================================================

grant usage on schema public to authenticated;
grant select on public.action_plans, public.recommendations, public.cycles to authenticated;

set session_replication_role = replica;

insert into auth.users(id, email)
values ('00000000-0000-0000-0000-0000000000a2', 'respondent-action-plans@orienta.test')
on conflict do nothing;

insert into public.profiles(user_id, role, organization_id)
values (
  '00000000-0000-0000-0000-0000000000a2',
  'respondent',
  '00000000-0000-0000-0000-0000000000b1'
)
on conflict (user_id) do update
  set role = excluded.role, organization_id = excluded.organization_id;

insert into public.organizations(id, name, acronym)
values ('00000000-0000-0000-0000-0000000000b2', 'Outra organização', 'OUTRA')
on conflict (id) do nothing;

insert into auth.users(id, email)
values ('00000000-0000-0000-0000-0000000000a3', 'respondent-other-org@orienta.test')
on conflict do nothing;

insert into public.profiles(user_id, role, organization_id)
values (
  '00000000-0000-0000-0000-0000000000a3',
  'respondent',
  '00000000-0000-0000-0000-0000000000b2'
)
on conflict (user_id) do update
  set role = excluded.role, organization_id = excluded.organization_id;

insert into public.cycles(id, form_version_id, organization_id, period_id, period_label, state)
values
  (
    '00000000-0000-0000-0000-00000000c231',
    '00000000-0000-0000-0000-000000000bb1',
    '00000000-0000-0000-0000-0000000000b1',
    (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','AP-validated','AP-validated')).id,
    'AP-validated',
    'validated'
  ),
  (
    '00000000-0000-0000-0000-00000000c232',
    '00000000-0000-0000-0000-000000000bb1',
    '00000000-0000-0000-0000-0000000000b1',
    (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','AP-in-validation','AP-in-validation')).id,
    'AP-in-validation',
    'in_validation'
  )
on conflict (id) do update set state = excluded.state, period_id = excluded.period_id;

-- Recomendação oficial exige processamento completed + ciclo validated/completed.
insert into public.cycle_processings(id, cycle_id, processing_version, status, completed_at)
values
  ('00000000-0000-0000-0000-00000000a241', '00000000-0000-0000-0000-00000000c231', 1, 'completed', now()),
  ('00000000-0000-0000-0000-00000000a242', '00000000-0000-0000-0000-00000000c232', 1, 'working', null)
on conflict (id) do update
  set status = excluded.status,
      completed_at = excluded.completed_at;

insert into public.recommendations(id, cycle_id, cycle_processing_id, question_version_id, tipo, text)
values
  ('00000000-0000-0000-0000-00000000b241', '00000000-0000-0000-0000-00000000c231', '00000000-0000-0000-0000-00000000a241', '00000000-0000-0000-0000-0000000000f1', 'nao_implementacao', 'Ação permitida'),
  ('00000000-0000-0000-0000-00000000b242', '00000000-0000-0000-0000-00000000c232', '00000000-0000-0000-0000-00000000a242', '00000000-0000-0000-0000-0000000000f1', 'nao_implementacao', 'Ação bloqueada')
on conflict (id) do nothing;

reset session_replication_role;

-- O verify.mjs envia o arquivo numa única query: no protocolo simple query
-- isso é uma transação implícita. Sem COMMIT, o ROLLBACK abaixo desfaz a
-- fixture (perfil a2/b1) e a lista de responsáveis volta vazia.
commit;

-- A Data API é somente leitura para action_plans. Nem respondente nem admin
-- podem contornar a RPC e suas validações.
begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
do $$
begin
  begin
    insert into public.action_plans(
      recommendation_id, axis_id, action_text, due_date, responsible_label, status
    )
    select
      '00000000-0000-0000-0000-00000000b241',
      qv.axis_id,
      'Contorno indevido do respondente', current_date + 30,
      'TI — Responsável', 'todo'
    from public.question_versions qv
    where qv.id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FALHOU(data-api): respondente escreveu diretamente em action_plans';
  exception when insufficient_privilege then
    null;
  end;
end $$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
do $$
begin
  begin
    insert into public.action_plans(
      recommendation_id, axis_id, action_text, due_date, responsible_label, status
    )
    select
      '00000000-0000-0000-0000-00000000b241',
      qv.axis_id,
      'Contorno indevido do administrador', current_date + 30,
      'TI — Administrador', 'todo'
    from public.question_versions qv
    where qv.id = '00000000-0000-0000-0000-0000000000f1';
    raise exception 'FALHOU(data-api): administrador escreveu diretamente em action_plans';
  exception when insufficient_privilege then
    null;
  end;
end $$;
rollback;

do $$
declare
  v_plan_id uuid;
  v_mode text;
  v_revision bigint;
  v_stale_revision bigint;
  v_actor uuid;
  v_action_text text;
  v_member_count integer;
begin
  select count(*) into v_member_count
  from public.list_organization_respondents('00000000-0000-0000-0000-0000000000b1');
  if v_member_count <> 1 then
    raise exception 'FALHOU(responsáveis): leitura retornou % membros; esperado 1', v_member_count;
  end if;

  if exists (
    select 1
    from public.list_organization_respondents('00000000-0000-0000-0000-0000000000b1')
    where user_id = '00000000-0000-0000-0000-0000000000a3'::uuid
  ) then
    raise exception 'FALHOU(responsáveis): leitura expôs respondente de outro órgão';
  end if;

  -- Mesmo uma escrita interna precisa respeitar a projeção do eixo.
  begin
    insert into public.action_plans(
      recommendation_id, axis_id, action_text, due_date, responsible_label, status
    )
    select
      '00000000-0000-0000-0000-00000000b241',
      axes.id,
      'Ação com eixo inconsistente', current_date + 30,
      'TI — Responsável', 'todo'
    from public.axes
    where axes.name = 'Ambiental';
    raise exception 'FALHOU(axis): plano aceitou eixo divergente da recomendação';
  exception when check_violation then
    null;
  end;

  select result.plan_id, result.mode, result.revision
    into v_plan_id, v_mode, v_revision
  from public.save_respondent_action_plan(
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-0000000000b1',
    null,
    '00000000-0000-0000-0000-00000000b241',
    'Implantar controle institucional',
    current_date + 30,
    current_date,
    'Tecnologia da Informação',
    '00000000-0000-0000-0000-0000000000a2',
    0,
    false,
    null,
    'Observação operacional'
  ) result;

  if v_plan_id is null or v_mode <> 'created' then
    raise exception 'FALHOU(rpc): criação não retornou plano/modo válidos';
  end if;
  v_stale_revision := v_revision;

  select actor_user_id into v_actor
  from public.audit_logs
  where entity_type = 'action_plans' and record_id = v_plan_id
  order by created_at desc limit 1;

  if v_actor is distinct from '00000000-0000-0000-0000-0000000000a2'::uuid then
    raise exception 'FALHOU(audit): ator = %, esperado respondente', v_actor;
  end if;

  select result.mode, result.revision into v_mode, v_revision
  from public.save_respondent_action_plan(
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-0000000000b1',
    v_plan_id,
    '00000000-0000-0000-0000-00000000b241',
    'Implantar e monitorar controle institucional',
    current_date + 30,
    current_date,
    'Tecnologia da Informação',
    '00000000-0000-0000-0000-0000000000a2',
    40,
    false,
    v_revision,
    'Execução iniciada'
  ) result;

  select action_text into v_action_text
  from public.action_plans where id = v_plan_id;
  if v_mode <> 'updated' or v_action_text <> 'Implantar e monitorar controle institucional' then
    raise exception 'FALHOU(rpc): atualização não foi persistida';
  end if;

  begin
    perform public.save_respondent_action_plan(
      '00000000-0000-0000-0000-0000000000a2',
      '00000000-0000-0000-0000-0000000000b1',
      v_plan_id,
      '00000000-0000-0000-0000-00000000b241',
      'Sobrescrita concorrente indevida',
      current_date + 30,
      current_date,
      'Tecnologia da Informação',
      '00000000-0000-0000-0000-0000000000a2',
      40,
      false,
      v_stale_revision,
      'Esta alteração deve ser rejeitada.'
    );
    raise exception 'FALHOU(concorrência): revisão antiga foi aceita';
  exception when sqlstate '40001' then
    null;
  end;

  select action_text into v_action_text
  from public.action_plans where id = v_plan_id;
  if v_action_text <> 'Implantar e monitorar controle institucional' then
    raise exception 'FALHOU(concorrência): revisão antiga sobrescreveu a ação';
  end if;

  -- O administrador global não pode usar a RPC operacional do respondente.
  begin
    perform public.save_respondent_action_plan(
      '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-0000000000b1',
      null,
      '00000000-0000-0000-0000-00000000b241',
      'Ação administrativa indevida',
      current_date + 30,
      current_date,
      'Administração',
      '00000000-0000-0000-0000-0000000000a2',
      0,
      false,
      null,
      null
    );
    raise exception 'FALHOU(admin): RPC permitiu escrita administrativa';
  exception when insufficient_privilege then
    null;
  end;

  -- Recomendação fora do processamento oficial editável não aceita plano.
  begin
    perform public.save_respondent_action_plan(
      '00000000-0000-0000-0000-0000000000a2',
      '00000000-0000-0000-0000-0000000000b1',
      null,
      '00000000-0000-0000-0000-00000000b242',
      'Ação antes da consolidação',
      current_date + 30,
      current_date,
      'Tecnologia da Informação',
      '00000000-0000-0000-0000-0000000000a2',
      0,
      false,
      null,
      null
    );
    raise exception 'FALHOU(estado): RPC aceitou recomendação não editável';
  exception
    when insufficient_privilege then
      null;
    when sqlstate 'P0001' then
      null;
  end;

  -- O responsável precisa ser um respondente real da mesma organização.
  begin
    perform public.save_respondent_action_plan(
      '00000000-0000-0000-0000-0000000000a2',
      '00000000-0000-0000-0000-0000000000b1',
      null,
      '00000000-0000-0000-0000-00000000b241',
      'Ação com responsável externo',
      current_date + 30,
      current_date,
      'Tecnologia da Informação',
      '00000000-0000-0000-0000-0000000000a3',
      0,
      false,
      null,
      null
    );
    raise exception 'FALHOU(responsável): RPC aceitou usuário de outro órgão';
  exception when invalid_parameter_value then
    null;
  end;

  -- A RPC também rejeita conteúdo que passaria por uma chamada direta malformada.
  begin
    perform public.save_respondent_action_plan(
      '00000000-0000-0000-0000-0000000000a2',
      '00000000-0000-0000-0000-0000000000b1',
      null,
      '00000000-0000-0000-0000-00000000b241',
      '     ',
      current_date + 30,
      current_date,
      'TI',
      '00000000-0000-0000-0000-0000000000a2',
      0,
      false,
      null,
      null
    );
    raise exception 'FALHOU(validation): RPC aceitou ação vazia';
  exception when invalid_parameter_value then
    null;
  end;

  set session_replication_role = replica;
  delete from public.audit_logs where record_id = v_plan_id;
  delete from public.action_plans where id = v_plan_id;
  set session_replication_role = default;
end $$;

set session_replication_role = replica;
delete from public.recommendations where id in (
  '00000000-0000-0000-0000-00000000b241',
  '00000000-0000-0000-0000-00000000b242'
);
delete from public.cycle_processings where id in (
  '00000000-0000-0000-0000-00000000a241',
  '00000000-0000-0000-0000-00000000a242'
);
delete from public.cycles where id in (
  '00000000-0000-0000-0000-00000000c231',
  '00000000-0000-0000-0000-00000000c232'
);
reset session_replication_role;

do $$ begin
  raise notice 'ACTION PLANS CYCLE EDITABILITY: OK';
end $$;
