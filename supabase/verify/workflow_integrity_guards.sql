-- ============================================================================
-- Verificação de integração: guardas finais de integridade do workflow.
-- Pré: _seed_minimal.sql. Saída: "WORKFLOW INTEGRITY GUARDS: OK".
-- ============================================================================

set session_replication_role = replica;

-- Ciclo usado para provar que a submissão é revalidada dentro da RPC, depois
-- da aquisição do lock, e não apenas na camada HTTP.
insert into public.cycles(
  id, form_version_id, organization_id, period_id, period_label, state,
  starts_at, response_deadline_at
) values (
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000bb1',
  '00000000-0000-0000-0000-0000000000b1',
  (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','GUARD-SUBMISSION','GUARD-SUBMISSION')).id,
  'GUARD-SUBMISSION', 'in_response', now(), now() + interval '30 days'
);

insert into public.cycle_processings(id, cycle_id, processing_version, status)
values (
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000001', 1, 'working'
);

-- Ciclos artificiais para tentar contornar diretamente a máquina de estados.
insert into public.cycles(id, form_version_id, organization_id, period_id, period_label, state)
values
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000bb1',
    '00000000-0000-0000-0000-0000000000b1',
    (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','GUARD-SCHEDULE','GUARD-SCHEDULE')).id,
    'GUARD-SCHEDULE', 'draft'
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000bb1',
    '00000000-0000-0000-0000-0000000000b1',
    (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','GUARD-INVALID-EDGE','GUARD-INVALID-EDGE')).id,
    'GUARD-INVALID-EDGE', 'draft'
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000bb1',
    '00000000-0000-0000-0000-0000000000b1',
    (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','GUARD-REOPEN','GUARD-REOPEN')).id,
    'GUARD-REOPEN', 'completed'
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000bb1',
    '00000000-0000-0000-0000-0000000000b1',
    (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','GUARD-ACTION-PLAN','GUARD-ACTION-PLAN')).id,
    'GUARD-ACTION-PLAN', 'completed'
  );

insert into public.cycle_processings(id, cycle_id, processing_version, status)
values (
  '10000000-0000-0000-0000-000000000007',
  '10000000-0000-0000-0000-000000000006', 1, 'completed'
);

insert into public.recommendations(
  id, cycle_id, cycle_processing_id, question_version_id, tipo, text
) values (
  '10000000-0000-0000-0000-000000000008',
  '10000000-0000-0000-0000-000000000006',
  '10000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-0000000000f1',
  'nao_implementacao', 'Recomendação coberta por plano ativo'
);

insert into public.action_plans(
  id, recommendation_id, axis_id, action_text, start_date, due_date,
  responsible_label, status
)
select
  '10000000-0000-0000-0000-000000000009',
  '10000000-0000-0000-0000-000000000008',
  qv.axis_id,
  'Manter a cobertura institucional', current_date, current_date + 30,
  'Responsável institucional', 'todo'
from public.question_versions qv
where qv.id = '00000000-0000-0000-0000-0000000000f1';

reset session_replication_role;

do $$
declare
  v_state public.cycle_state;
begin
  -- Sem resposta obrigatória, a transição precisa falhar dentro da RPC.
  begin
    perform public.commit_cycle_transition(
      '10000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-0000000000a1',
      'submitted', null, null, 'in_response'
    );
    raise exception 'FALHOU(submission): RPC aceitou formulário incompleto';
  exception when check_violation then
    null;
  end;

  select state into v_state
  from public.cycles where id = '10000000-0000-0000-0000-000000000001';
  if v_state <> 'in_response' then
    raise exception 'FALHOU(submission): falha parcial alterou o estado para %', v_state;
  end if;

  insert into public.responses(
    id, cycle_id, question_version_id, answer, is_not_applicable, created_by
  ) values (
    '10000000-0000-0000-0000-000000000010',
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-0000000000f1',
    'no', false, '00000000-0000-0000-0000-0000000000a1'
  );

  perform public.commit_cycle_transition(
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-0000000000a1',
    'submitted', null, null, 'in_response'
  );

  select state into v_state
  from public.cycles where id = '10000000-0000-0000-0000-000000000001';
  if v_state <> 'submitted' then
    raise exception 'FALHOU(submission): formulário completo não foi submetido';
  end if;

  -- A abertura precisa de calendário mesmo em UPDATE direto.
  begin
    update public.cycles set state = 'in_response'
    where id = '10000000-0000-0000-0000-000000000003';
    raise exception 'FALHOU(schedule): ciclo abriu sem calendário';
  exception when check_violation then
    null;
  end;

  -- Arestas que não pertencem ao workflow são rejeitadas no banco.
  begin
    update public.cycles set state = 'validated'
    where id = '10000000-0000-0000-0000-000000000004';
    raise exception 'FALHOU(edge): banco aceitou draft -> validated'
      using errcode = '23514';
  exception when raise_exception then
    null;
  end;

  -- Reabertura direta não substitui a RPC oficial e seus efeitos colaterais.
  begin
    update public.cycles set state = 'in_response'
    where id = '10000000-0000-0000-0000-000000000005';
    raise exception 'FALHOU(reopen): banco aceitou reabertura incompleta';
  exception when check_violation then
    null;
  end;

  -- Um diagnóstico concluído não pode perder o último plano que o cobria.
  begin
    update public.action_plans
    set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Teste'
    where id = '10000000-0000-0000-0000-000000000009';
    raise exception 'FALHOU(action-plan): último plano ativo foi cancelado';
  exception when check_violation then
    null;
  end;
end $$;

-- Um formulário publicado não pode perder sua última organização de destino.
insert into public.forms(id, name, created_by)
values (
  '10000000-0000-0000-0000-000000000011',
  'Formulário das guardas de integridade',
  '00000000-0000-0000-0000-0000000000a1'
);

insert into public.form_assignments(id, form_id, organization_id, assigned_by)
values (
  '10000000-0000-0000-0000-000000000012',
  '10000000-0000-0000-0000-000000000011',
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000a1'
);

insert into public.form_versions(id, form_id, version, state, published_by)
values (
  '10000000-0000-0000-0000-000000000013',
  '10000000-0000-0000-0000-000000000011', 1, 'published',
  '00000000-0000-0000-0000-0000000000a1'
);

update public.forms
set current_form_version_id = '10000000-0000-0000-0000-000000000013'
where id = '10000000-0000-0000-0000-000000000011';

do $$
begin
  begin
    delete from public.form_assignments
    where id = '10000000-0000-0000-0000-000000000012';
    raise exception 'FALHOU(assignment): formulário publicado ficou sem destino';
  exception when check_violation then
    null;
  end;
end $$;

set session_replication_role = replica;
delete from public.forms
where id = '10000000-0000-0000-0000-000000000011';
delete from public.action_plans
where id = '10000000-0000-0000-0000-000000000009';
delete from public.recommendations
where id = '10000000-0000-0000-0000-000000000008';
delete from public.responses
where id = '10000000-0000-0000-0000-000000000010';
delete from public.cycle_processings
where id in (
  '10000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000007'
);
delete from public.cycles
where id in (
  '10000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000006'
);
reset session_replication_role;

do $$ begin
  raise notice 'WORKFLOW INTEGRITY GUARDS: OK';
end $$;
