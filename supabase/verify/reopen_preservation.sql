-- ============================================================================
-- Verificação de integração: invariantes de preservação da REABERTURA.
-- (completed → in_response via reopen_cycle), contra o SCHEMA REAL.
--
-- Garante: novo processing criado; histórico v1 imutável; relatório anterior
-- preservado no processing anterior; FAMI anterior não sobrescrito; ciclo volta
-- a in_response com reopen_count++. Pré: _seed_minimal.sql.
-- Saída esperada: "REOPEN PRESERVATION: OK".
-- ============================================================================
set session_replication_role = replica;

-- Cenário próprio (ids dedicados) para não colidir com o seed base.
insert into public.cycles(id, form_version_id, organization_id, period_id, period_label, state, reopen_count, closed_at)
  values (
    '00000000-0000-0000-0000-00000000c0de',
    '00000000-0000-0000-0000-000000000bb1',
    '00000000-0000-0000-0000-0000000000b1',
    (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1','2025','2025')).id,
    '2025',
    'completed',
    0,
    now()
  )
  on conflict (id) do update set state='completed', reopen_count=0, period_id=excluded.period_id;
insert into public.cycle_processings(id, cycle_id, processing_version, status, completed_at)
  values ('00000000-0000-0000-0000-00000000d0c1','00000000-0000-0000-0000-00000000c0de',1,'completed', now())
  on conflict (id) do nothing;
insert into public.fami_results(cycle_id, cycle_processing_id, scope_type, points_obtained, points_possible, percentage, maturity_level)
  values ('00000000-0000-0000-0000-00000000c0de','00000000-0000-0000-0000-00000000d0c1','global',1,2,50,3)
  on conflict do nothing;
insert into public.reports(cycle_id, cycle_processing_id, file_path, generated_by)
  values ('00000000-0000-0000-0000-00000000c0de','00000000-0000-0000-0000-00000000d0c1','00000000-0000-0000-0000-00000000c0de/final-v1.pdf','00000000-0000-0000-0000-0000000000a1')
  on conflict do nothing;

reset session_replication_role;

do $$
declare
  v_cycle uuid := '00000000-0000-0000-0000-00000000c0de';
  v_proc_v1 uuid := '00000000-0000-0000-0000-00000000d0c1';
  v_actor uuid := '00000000-0000-0000-0000-0000000000a1';
  v_reason text := 'Reabertura para verificar a preservação do processamento anterior.';
  v_new_deadline timestamptz := clock_timestamp() + interval '30 days';
  v_state public.cycle_state; v_reopen int; v_closed_at timestamptz; v_deadline timestamptz;
  v_v2 int; v_v1_status text; v_event_count int;
  v_fami_proc uuid; v_report_proc uuid;
begin
  perform public.reopen_cycle(
    v_cycle,
    v_actor,
    v_reason,
    v_new_deadline
  );

  select state, reopen_count, closed_at, response_deadline_at
    into v_state, v_reopen, v_closed_at, v_deadline
  from public.cycles
  where id=v_cycle;
  if v_state <> 'in_response' then raise exception 'FALHOU(5): estado=%', v_state; end if;
  if v_reopen <> 1 then raise exception 'FALHOU(5): reopen_count=%', v_reopen; end if;
  if v_closed_at is not null then raise exception 'FALHOU(5): ciclo reaberto mantém closed_at=%', v_closed_at; end if;
  if v_deadline is distinct from v_new_deadline then
    raise exception 'FALHOU(6): prazo reaberto incorreto: esperado %, obtido %', v_new_deadline, v_deadline;
  end if;

  select count(*) into v_event_count
  from public.cycle_reopen_events event
  where event.cycle_id = v_cycle
    and event.reopen_number = 1
    and event.actor_user_id = v_actor
    and event.reason = v_reason
    and event.new_deadline_at = v_new_deadline;
  if v_event_count <> 1 then
    raise exception 'FALHOU(7): histórico auditável da reabertura ausente ou divergente (%).', v_event_count;
  end if;

  select count(*) into v_v2 from public.cycle_processings
   where cycle_id=v_cycle and processing_version=2 and status='working';
  if v_v2 <> 1 then raise exception 'FALHOU(1): novo processing v2 working ausente (%).', v_v2; end if;

  select status into v_v1_status from public.cycle_processings where id=v_proc_v1;
  if v_v1_status <> 'completed' then raise exception 'FALHOU(2): v1 virou %', v_v1_status; end if;

  select cycle_processing_id into v_fami_proc from public.fami_results where cycle_id=v_cycle;
  if v_fami_proc <> v_proc_v1 then raise exception 'FALHOU(4): FAMI migrou'; end if;

  select cycle_processing_id into v_report_proc from public.reports where cycle_id=v_cycle;
  if v_report_proc <> v_proc_v1 then raise exception 'FALHOU(3): relatório migrou'; end if;

  -- limpeza do cenário dedicado
  set session_replication_role = replica;
  delete from public.automation_jobs job
  where exists (
    select 1 from public.automation_job_items item
    where item.job_id = job.id
      and item.entity_type = 'cycle'
      and item.entity_id = v_cycle::text
  );
  delete from public.reports where cycle_id=v_cycle;
  delete from public.fami_results where cycle_id=v_cycle;
  delete from public.cycle_processings where cycle_id=v_cycle;
  delete from public.cycles where id=v_cycle;
  set session_replication_role = default;

  raise notice 'REOPEN PRESERVATION: OK';
end $$;
