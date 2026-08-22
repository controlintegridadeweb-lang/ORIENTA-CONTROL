-- ============================================================================
-- Verificação de integração: o ATOR REAL é registrado na auditoria via RPC.
--
-- Mutações executadas pelo backend sob service_role não possuem auth.uid(). As
-- RPCs auditáveis devem chamar set_audit_actor na mesma transação da alteração.
-- Exercitamos reabertura e atualização de cronograma.
-- Pré: _seed_minimal.sql. Saída esperada: "AUDIT ACTOR: OK".
-- ============================================================================
set session_replication_role = replica;
insert into public.cycles(id, form_version_id, organization_id, period_id, period_label, state, reopen_count, closed_at)
values
  (
    '00000000-0000-0000-0000-00000000ad17',
    '00000000-0000-0000-0000-000000000bb1',
    '00000000-0000-0000-0000-0000000000b1',
    (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','audit-reopen','audit-reopen')).id,
    'audit-reopen','completed',0, now()
  ),
  (
    '00000000-0000-0000-0000-00000000ad19',
    '00000000-0000-0000-0000-000000000bb1',
    '00000000-0000-0000-0000-0000000000b1',
    (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','audit-schedule','audit-schedule')).id,
    'audit-schedule','draft',0, null
  )
on conflict (id) do update
  set state = excluded.state,
      period_id = excluded.period_id,
      reopen_count = excluded.reopen_count,
      closed_at = excluded.closed_at;

insert into public.cycle_processings(id, cycle_id, processing_version, status, completed_at)
values ('00000000-0000-0000-0000-00000000ad18','00000000-0000-0000-0000-00000000ad17',1,'completed', now())
on conflict (id) do nothing;
reset session_replication_role;

do $$
declare
  v_actor uuid := '00000000-0000-0000-0000-0000000000a1';
  v_logged uuid;
begin
  perform public.reopen_cycle(
    '00000000-0000-0000-0000-00000000ad17',
    v_actor,
    'Reabertura de verificação da trilha de auditoria.',
    now() + interval '30 days'
  );

  select actor_user_id into v_logged
  from public.audit_logs
  where entity_type = 'cycles'
    and record_id = '00000000-0000-0000-0000-00000000ad17'
  order by created_at desc
  limit 1;

  if v_logged is distinct from v_actor then
    raise exception 'FALHOU(reopen): ator auditado = %, esperado %', v_logged, v_actor;
  end if;

  perform public.update_cycle_schedule(
    '00000000-0000-0000-0000-00000000ad19',
    now() + interval '1 day',
    now() + interval '31 days',
    now() + interval '45 days',
    now() + interval '60 days',
    v_actor
  );

  select actor_user_id into v_logged
  from public.audit_logs
  where entity_type = 'cycles'
    and record_id = '00000000-0000-0000-0000-00000000ad19'
  order by created_at desc
  limit 1;

  if v_logged is distinct from v_actor then
    raise exception 'FALHOU(schedule): ator auditado = %, esperado %', v_logged, v_actor;
  end if;

  set session_replication_role = replica;
  delete from public.automation_jobs job
  where exists (
    select 1 from public.automation_job_items item
    where item.job_id = job.id
      and item.entity_type = 'cycle'
      and item.entity_id in (
        '00000000-0000-0000-0000-00000000ad17'::uuid,
        '00000000-0000-0000-0000-00000000ad19'::uuid
      )
  );
  delete from public.audit_logs where record_id in (
    '00000000-0000-0000-0000-00000000ad17',
    '00000000-0000-0000-0000-00000000ad19'
  );
  delete from public.cycle_processings where cycle_id='00000000-0000-0000-0000-00000000ad17';
  delete from public.cycles where id in (
    '00000000-0000-0000-0000-00000000ad17',
    '00000000-0000-0000-0000-00000000ad19'
  );
  set session_replication_role = default;

  raise notice 'AUDIT ACTOR: OK';
end $$;
