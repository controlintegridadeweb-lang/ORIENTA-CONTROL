-- ============================================================================
-- Verificação de integração: histórico visível só com a emissão mais recente.
--
-- Confirma que várias emissões do mesmo formulário + ano + bimestre (e do
-- anual do mesmo formulário/período) continuam nas tabelas de origem, mas a
-- view do catálogo devolve um único card por grupo.
-- Pré: _seed_minimal.sql.
-- Saída esperada: "REPORT HISTORY LATEST CATALOG: OK".
-- ============================================================================
set session_replication_role = replica;

insert into public.cycles(
  id, form_version_id, organization_id, period_id, period_label,
  reference_start_year, reference_end_year, action_plan_revision,
  state, closed_at
) values (
  '00000000-0000-0000-0000-00000000c0e9',
  '00000000-0000-0000-0000-000000000bb1',
  '00000000-0000-0000-0000-0000000000b1',
  (public.ensure_form_period(
    '00000000-0000-0000-0000-000000000bb1',
    'report-history-latest',
    'Diagnóstico de Integridade 2026'
  )).id,
  'Diagnóstico de Integridade 2026',
  2026, 2026, 0,
  'completed', now()
);
insert into public.cycle_processings(id, cycle_id, processing_version, status, completed_at)
values ('00000000-0000-0000-0000-00000000e0e9','00000000-0000-0000-0000-00000000c0e9',1,'completed',now());
insert into public.fami_results(
  id, cycle_id, cycle_processing_id, scope_type, scope_id,
  points_obtained, points_possible, percentage, maturity_level
) values (
  '00000000-0000-0000-0000-00000000f0e9',
  '00000000-0000-0000-0000-00000000c0e9',
  '00000000-0000-0000-0000-00000000e0e9',
  'global', null, 1.5, 1.5, 100, 5
);
reset session_replication_role;

do $$
declare
  v_cycle uuid := '00000000-0000-0000-0000-00000000c0e9';
  v_processing uuid := '00000000-0000-0000-0000-00000000e0e9';
  v_actor uuid := '00000000-0000-0000-0000-0000000000a1';
  v_org uuid := '00000000-0000-0000-0000-0000000000b1';
  v_first jsonb;
  v_second jsonb;
  v_first_path text;
  v_second_path text;
  v_visible_bimester integer;
  v_visible_annual integer;
  v_stored_bimester integer;
  v_stored_annual integer;
  v_bimester4_version integer;
  v_annual_version integer;
  v_bimester3_count integer;
begin
  v_first := public.reserve_report_emission(v_cycle, v_processing, v_actor, 0, now() - interval '20 minutes', null);
  v_first_path := v_first ->> 'file_path';
  insert into storage.objects(bucket_id, name, metadata)
  values ('relatorios', v_first_path, '{"mimetype":"application/pdf","size":128}'::jsonb);
  perform public.finalize_report_emission(
    (v_first ->> 'id')::uuid, repeat('a', 64), repeat('b', 64), 128
  );

  v_second := public.reserve_report_emission(
    v_cycle, v_processing, v_actor, 0, now() - interval '10 minutes', 'Reemissão de conferência.'
  );
  v_second_path := v_second ->> 'file_path';
  insert into storage.objects(bucket_id, name, metadata)
  values ('relatorios', v_second_path, '{"mimetype":"application/pdf","size":256}'::jsonb);
  perform public.finalize_report_emission(
    (v_second ->> 'id')::uuid, repeat('c', 64), repeat('d', 64), 256
  );

  insert into public.action_plan_bimonthly_reports (
    id, cycle_id, source_cycle_processing_id, reference_year, bimester, report_version,
    period_start, period_end, generated_by, generation_kind, generated_at
  ) values
    (
      '00000000-0000-0000-0000-00000000b029',
      v_cycle, v_processing, 2026, 4, 2,
      '2026-07-01', '2026-08-31', v_actor, 'manual', now() - interval '15 minutes'
    ),
    (
      '00000000-0000-0000-0000-00000000b039',
      v_cycle, v_processing, 2026, 4, 3,
      '2026-07-01', '2026-08-31', v_actor, 'manual', now() - interval '4 minutes'
    ),
    (
      '00000000-0000-0000-0000-00000000b049',
      v_cycle, v_processing, 2026, 4, 4,
      '2026-07-01', '2026-08-31', v_actor, 'manual', now() - interval '8 minutes'
    ),
    (
      '00000000-0000-0000-0000-00000000b019',
      v_cycle, v_processing, 2026, 3, 1,
      '2026-05-01', '2026-06-30', v_actor, 'manual', now() - interval '40 days'
    );

  select count(*) into v_stored_bimester
  from public.action_plan_bimonthly_reports
  where cycle_id = v_cycle and reference_year = 2026 and bimester = 4;
  if v_stored_bimester <> 3 then
    raise exception 'FALHOU(auditoria bimestral): stored=%', v_stored_bimester;
  end if;

  select count(*) into v_stored_annual
  from public.reports
  where cycle_id = v_cycle and status in ('completed', 'legacy');
  if v_stored_annual <> 2 then
    raise exception 'FALHOU(auditoria anual): stored=%', v_stored_annual;
  end if;

  select count(*) into v_visible_bimester
  from public.report_history_entries
  where organization_id = v_org
    and cycle_id = v_cycle
    and report_kind = 'bimonthly'
    and bimester = 4;
  if v_visible_bimester <> 1 then
    raise exception 'FALHOU(catálogo bimestral): visible=%', v_visible_bimester;
  end if;

  select emission_version into v_bimester4_version
  from public.report_history_entries
  where organization_id = v_org
    and cycle_id = v_cycle
    and report_kind = 'bimonthly'
    and bimester = 4;
  if v_bimester4_version <> 4 then
    raise exception 'FALHOU(versão bimestral): emission=%', v_bimester4_version;
  end if;

  select count(*) into v_bimester3_count
  from public.report_history_entries
  where organization_id = v_org
    and cycle_id = v_cycle
    and report_kind = 'bimonthly'
    and bimester = 3;
  if v_bimester3_count <> 1 then
    raise exception 'FALHOU(bimestre distinto): count=%', v_bimester3_count;
  end if;

  select count(*) into v_visible_annual
  from public.report_history_entries
  where organization_id = v_org
    and cycle_id = v_cycle
    and report_kind = 'annual';
  if v_visible_annual <> 1 then
    raise exception 'FALHOU(catálogo anual): visible=%', v_visible_annual;
  end if;

  select emission_version into v_annual_version
  from public.report_history_entries
  where organization_id = v_org
    and cycle_id = v_cycle
    and report_kind = 'annual';
  if v_annual_version <> 2 then
    raise exception 'FALHOU(versão anual): emission=%', v_annual_version;
  end if;

  set session_replication_role = replica;
  delete from public.action_plan_bimonthly_reports where cycle_id = v_cycle;
  delete from public.reports where cycle_id = v_cycle;
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where bucket_id = 'relatorios' and name in (v_first_path, v_second_path);
  perform set_config('storage.allow_delete_query', 'false', true);
  delete from public.fami_results where cycle_id = v_cycle;
  delete from public.cycle_processings where id = v_processing;
  delete from public.cycles where id = v_cycle;
  set session_replication_role = default;
end $$;

do $$ begin
  raise notice 'REPORT HISTORY LATEST CATALOG: OK';
end $$;
