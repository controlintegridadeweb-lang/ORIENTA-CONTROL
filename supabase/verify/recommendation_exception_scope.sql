-- Garante que uma exceção institucional não possa apontar para organização ou
-- critério diferentes daqueles congelados na recomendação.
-- A recomendação precisa ser a oficial do processamento concluído
-- (recommendation_exception_not_current).
-- Pré: _seed_minimal.sql. Fixtures locais (ciclo/recomendação) — não depende de
-- outros verifies; action_plans_cycle_editability limpa os próprios ids.

set session_replication_role = replica;

insert into public.cycles(id, form_version_id, organization_id, period_id, period_label, state)
values (
  '00000000-0000-0000-0000-00000000c251',
  '00000000-0000-0000-0000-000000000bb1',
  '00000000-0000-0000-0000-0000000000b1',
  (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','EXC-scope','EXC-scope')).id,
  'EXC-scope',
  'validated'
)
on conflict (id) do update set state = excluded.state, period_id = excluded.period_id;

insert into public.cycle_processings(id, cycle_id, processing_version, status, completed_at)
values (
  '00000000-0000-0000-0000-00000000a251',
  '00000000-0000-0000-0000-00000000c251',
  1,
  'completed',
  now()
)
on conflict (id) do update
set status = excluded.status,
    completed_at = excluded.completed_at;

insert into public.recommendations(
  id, cycle_id, cycle_processing_id, question_version_id, tipo, text
)
values (
  '00000000-0000-0000-0000-00000000b251',
  '00000000-0000-0000-0000-00000000c251',
  '00000000-0000-0000-0000-00000000a251',
  '00000000-0000-0000-0000-0000000000f1',
  'nao_implementacao',
  'Recomendação para escopo de exceção'
)
on conflict (id) do nothing;

reset session_replication_role;

do $$
begin
  begin
    insert into public.recommendation_exceptions(
      organization_id,
      recommendation_id,
      question_id,
      motivo
    ) values (
      '00000000-0000-0000-0000-0000000000b1',
      '00000000-0000-0000-0000-00000000b251',
      '00000000-0000-0000-0000-0000000000e2',
      'Justificativa institucional válida, porém ligada ao critério incorreto.'
    );
    raise exception 'recommendation_exception_question_scope_not_enforced';
  exception
    when check_violation then
      if sqlerrm not like '%recommendation_exception_question_mismatch%' then
        raise;
      end if;
  end;

  insert into public.organizations(id, name, acronym)
  values (
    '00000000-0000-0000-0000-0000000000b2',
    'Outra organização',
    'OUTRA'
  )
  on conflict (id) do nothing;

  begin
    insert into public.recommendation_exceptions(
      organization_id,
      recommendation_id,
      question_id,
      motivo
    ) values (
      '00000000-0000-0000-0000-0000000000b2',
      '00000000-0000-0000-0000-00000000b251',
      '00000000-0000-0000-0000-0000000000e1',
      'Justificativa institucional válida, porém ligada à organização incorreta.'
    );
    raise exception 'recommendation_exception_organization_scope_not_enforced';
  exception
    when check_violation then
      if sqlerrm not like '%recommendation_exception_organization_mismatch%' then
        raise;
      end if;
  end;

  insert into public.recommendation_exceptions(
    id,
    organization_id,
    recommendation_id,
    question_id,
    motivo
  ) values (
    '00000000-0000-0000-0000-00000000ec01',
    '00000000-0000-0000-0000-0000000000b1',
    '00000000-0000-0000-0000-00000000b251',
    '00000000-0000-0000-0000-0000000000e1',
    'Justificativa institucional válida e coerente com a recomendação.'
  )
  on conflict (id) do nothing;

  update public.recommendation_exceptions
  set status = 'approved',
      decided_by = '00000000-0000-0000-0000-0000000000a1',
      decided_at = now()
  where id = '00000000-0000-0000-0000-00000000ec01'
    and status = 'requested';

  begin
    update public.recommendation_exceptions
    set status = 'rejected',
        decided_at = now()
    where id = '00000000-0000-0000-0000-00000000ec01';
    raise exception 'recommendation_exception_terminal_decision_not_enforced';
  exception
    when check_violation then
      if sqlerrm not like '%recommendation_exception_already_decided%' then
        raise;
      end if;
  end;

  raise notice 'recommendation_exception_scope: OK';
end;
$$;

set session_replication_role = replica;
delete from public.recommendation_exceptions
where id = '00000000-0000-0000-0000-00000000ec01';
delete from public.recommendations
where id = '00000000-0000-0000-0000-00000000b251';
delete from public.cycle_processings
where id = '00000000-0000-0000-0000-00000000a251';
delete from public.cycles
where id = '00000000-0000-0000-0000-00000000c251';
reset session_replication_role;
