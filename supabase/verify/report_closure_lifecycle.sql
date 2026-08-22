-- ============================================================================
-- Verificação: encerramento institucional + ciclo de vida do relatório.
-- Garante período obrigatório, falha de emissão explícita, preservação do PDF
-- antes da reabertura e estado histórico após nova versão do diagnóstico.
-- Pré: _seed_minimal.sql.
-- Saída esperada: "REPORT CLOSURE LIFECYCLE: OK".
-- ============================================================================
set session_replication_role = replica;

insert into public.cycles(
  id, form_version_id, organization_id, period_id, period_label,
  state, action_plan_revision
) values (
  '00000000-0000-0000-0000-00000000c1f1',
  '00000000-0000-0000-0000-000000000bb1',
  '00000000-0000-0000-0000-0000000000b1',
  (public.ensure_form_period(
    '00000000-0000-0000-0000-000000000bb1',
    'report-closure-lifecycle',
    'Report closure lifecycle'
  )).id,
  'Report closure lifecycle',
  'validated',
  0
) on conflict (id) do update set
  state = 'validated',
  reference_start_year = null,
  reference_end_year = null,
  action_plan_revision = 0,
  schedule_revision = 0,
  closed_at = null,
  reopen_count = 0;

insert into public.cycle_processings(
  id, cycle_id, processing_version, status, completed_at
) values (
  '00000000-0000-0000-0000-00000000d1f1',
  '00000000-0000-0000-0000-00000000c1f1',
  1, 'completed', now()
) on conflict (id) do update set status = 'completed', completed_at = excluded.completed_at;

insert into public.fami_results(
  cycle_id, cycle_processing_id, scope_type,
  points_obtained, points_possible, percentage, maturity_level
) values (
  '00000000-0000-0000-0000-00000000c1f1',
  '00000000-0000-0000-0000-00000000d1f1',
  'global', 1, 2, 50, 3
) on conflict do nothing;

reset session_replication_role;

do $$
declare
  v_cycle uuid := '00000000-0000-0000-0000-00000000c1f1';
  v_processing uuid := '00000000-0000-0000-0000-00000000d1f1';
  v_actor uuid := '00000000-0000-0000-0000-0000000000a1';
  v_report uuid;
  v_status text;
begin
  -- O worker programado deve tratar ausência de período como condição de
  -- prontidão, sem transformar a regra de negócio em falha técnica.
  declare
    v_scheduled jsonb;
  begin
    v_scheduled := public.execute_scheduled_cycle_action(
      v_cycle, v_actor, 'close_cycle', 0
    );
    if v_scheduled ->> 'status' <> 'skipped'
       or position('período de referência' in lower(v_scheduled ->> 'message')) = 0 then
      raise exception 'FALHOU(encerramento programado sem período): %', v_scheduled;
    end if;
    if (select state from public.cycles where id = v_cycle) <> 'validated'::public.cycle_state then
      raise exception 'FALHOU(encerramento programado): alterou o estado sem período';
    end if;
  end;

  begin
    update public.cycles
    set state = 'completed', closed_at = now()
    where id = v_cycle;
    raise exception 'FALHOU(período): encerrou sem referência institucional';
  exception when check_violation then
    if position('close_requires_reference_period' in sqlerrm) = 0 then
      raise;
    end if;
  end;

  update public.cycles
  set reference_start_year = 2026, reference_end_year = 2026
  where id = v_cycle;

  update public.cycles
  set state = 'completed', closed_at = now()
  where id = v_cycle;

  v_status := public.cycle_report_lifecycle_status(v_cycle);
  if v_status <> 'ready_to_emit' then
    raise exception 'FALHOU(status pronto): %', v_status;
  end if;

  begin
    perform public.reopen_cycle(
      v_cycle,
      v_actor,
      'Tentativa de reabertura antes da preservação do relatório oficial.',
      clock_timestamp() + interval '30 days'
    );
    raise exception 'FALHOU(reabertura): reabriu sem relatório oficial';
  exception when check_violation then
    if position('reopen_requires_official_report' in sqlerrm) = 0 then
      raise;
    end if;
  end;

  perform public.record_report_emission_failure(
    v_cycle,
    v_processing,
    0,
    v_actor,
    'test_failure',
    'Falha controlada para validar o estado derivado.'
  );
  v_status := public.cycle_report_lifecycle_status(v_cycle);
  if v_status <> 'emission_failed' then
    raise exception 'FALHOU(status falha): %', v_status;
  end if;

  set session_replication_role = replica;
  insert into public.reports(
    id, cycle_id, cycle_processing_id, file_path, generated_by,
    status, emission_version
  ) values (
    '00000000-0000-0000-0000-00000000e1f1',
    v_cycle,
    v_processing,
    '00000000-0000-0000-0000-00000000c1f1/legacy-preserved.pdf',
    v_actor,
    'legacy',
    1
  ) returning id into v_report;
  set session_replication_role = default;

  if not public.cycle_has_current_official_report(v_cycle) then
    raise exception 'FALHOU(preservação): relatório oficial vigente não reconhecido';
  end if;
  v_status := public.cycle_report_lifecycle_status(v_cycle);
  if v_status <> 'available' then
    raise exception 'FALHOU(status disponível): %', v_status;
  end if;

  perform public.reopen_cycle(
    v_cycle,
    v_actor,
    'Reabertura permitida após preservação do relatório oficial do encerramento.',
    clock_timestamp() + interval '30 days'
  );
  v_status := public.cycle_report_lifecycle_status(v_cycle);
  if v_status <> 'outdated' then
    raise exception 'FALHOU(status histórico): %', v_status;
  end if;

  set session_replication_role = replica;
  delete from public.automation_jobs job
  where exists (
    select 1 from public.automation_job_items item
    where item.job_id = job.id
      and item.entity_type = 'cycle'
      and item.entity_id = v_cycle::text
  );
  delete from public.report_emission_failures where cycle_id = v_cycle;
  delete from public.reports where cycle_id = v_cycle;
  delete from public.fami_results where cycle_id = v_cycle;
  delete from public.cycle_processings where cycle_id = v_cycle;
  delete from public.cycles where id = v_cycle;
  set session_replication_role = default;

  raise notice 'REPORT CLOSURE LIFECYCLE: OK';
end $$;
