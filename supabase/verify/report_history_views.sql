-- ============================================================================
-- Verificação de integração: projeções do histórico de relatórios.
--
-- Confirma que a emissão "Atual" depende simultaneamente do estado do ciclo,
-- processamento FAMI mais recente, última versão documental, revisão do plano
-- e integridade criptográfica; o ano filtrável vem da referência institucional.
-- Pré: _seed_minimal.sql.
-- Saída esperada: "REPORT HISTORY VIEWS: OK".
-- ============================================================================
set session_replication_role = replica;

insert into public.cycles(
  id, form_version_id, organization_id, period_id, period_label,
  reference_start_year, reference_end_year, action_plan_revision,
  state, closed_at
) values (
  '00000000-0000-0000-0000-00000000c0e8',
  '00000000-0000-0000-0000-000000000bb1',
  '00000000-0000-0000-0000-0000000000b1',
  (public.ensure_form_period(
    '00000000-0000-0000-0000-000000000bb1',
    'report-history-views',
    'Ciclo institucional'
  )).id,
  'Ciclo institucional',
  2025, 2026, 0,
  'completed', now()
);
insert into public.cycle_processings(id, cycle_id, processing_version, status, completed_at)
values ('00000000-0000-0000-0000-00000000e0e8','00000000-0000-0000-0000-00000000c0e8',1,'completed',now());
insert into public.fami_results(
  id, cycle_id, cycle_processing_id, scope_type, scope_id,
  points_obtained, points_possible, percentage, maturity_level
) values (
  '00000000-0000-0000-0000-00000000f0e8',
  '00000000-0000-0000-0000-00000000c0e8',
  '00000000-0000-0000-0000-00000000e0e8',
  'global', null, 1.5, 1.5, 100, 5
);
reset session_replication_role;

do $$
declare
  v_cycle uuid := '00000000-0000-0000-0000-00000000c0e8';
  v_processing uuid := '00000000-0000-0000-0000-00000000e0e8';
  v_actor uuid := '00000000-0000-0000-0000-0000000000a1';
  v_first jsonb;
  v_second jsonb;
  v_first_path text;
  v_second_path text;
  v_count integer;
  v_latest integer;
  v_current boolean;
  v_name text;
begin
  v_first := public.reserve_report_emission(v_cycle, v_processing, v_actor, 0, now(), null);
  v_first_path := v_first ->> 'file_path';
  insert into storage.objects(bucket_id, name, metadata)
  values ('relatorios', v_first_path, '{"mimetype":"application/pdf","size":128}'::jsonb);
  perform public.finalize_report_emission(
    (v_first ->> 'id')::uuid, repeat('a', 64), repeat('b', 64), 128
  );

  v_second := public.reserve_report_emission(
    v_cycle, v_processing, v_actor, 0, now(), 'Reemissão de conferência.'
  );
  v_second_path := v_second ->> 'file_path';
  insert into storage.objects(bucket_id, name, metadata)
  values ('relatorios', v_second_path, '{"mimetype":"application/pdf","size":256}'::jsonb);
  perform public.finalize_report_emission(
    (v_second ->> 'id')::uuid, repeat('c', 64), repeat('d', 64), 256
  );

  select emission_count, latest_emission_version into v_count, v_latest
  from public.report_emission_summaries where cycle_processing_id = v_processing;
  if v_count <> 2 or v_latest <> 2 then
    raise exception 'FALHOU(resumo): count=%, latest=%', v_count, v_latest;
  end if;

  select is_current, generated_by_name into v_current, v_name
  from public.report_history_entries
  where cycle_processing_id = v_processing and emission_version = 2;
  if v_current is not true then
    raise exception 'FALHOU(atualidade): última emissão não foi marcada como atual';
  end if;
  if nullif(btrim(v_name), '') is null then
    raise exception 'FALHOU(autoria): nome do emissor não foi projetado';
  end if;

  if not exists (
    select 1 from public.report_history_years
    where organization_id = '00000000-0000-0000-0000-0000000000b1'
      and calendar_year in (2025, 2026)
    group by organization_id
    having count(distinct calendar_year) = 2
  ) then
    raise exception 'FALHOU(referência): intervalo institucional não foi projetado';
  end if;

  begin
    update public.cycles
    set reference_start_year = 2024, reference_end_year = 2026
    where id = v_cycle;
    raise exception 'FALHOU(referência): permitiu alterar período após emissão';
  exception when sqlstate '55000' then null;
  end;

  -- Mesmo sob uma alteração administrativa forçada, a view não pode marcar
  -- o documento como atual quando a referência diverge do PDF congelado.
  set session_replication_role = replica;
  update public.cycles set reference_start_year = 2024, reference_end_year = 2026 where id = v_cycle;
  set session_replication_role = default;
  select is_current into v_current from public.report_history_entries
  where cycle_processing_id = v_processing and emission_version = 2;
  if v_current is not false then
    raise exception 'FALHOU(referência): emissão permaneceu atual após divergência forçada';
  end if;
  set session_replication_role = replica;
  update public.cycles set reference_start_year = 2025, reference_end_year = 2026 where id = v_cycle;
  set session_replication_role = default;

  update public.cycles set action_plan_revision = 1 where id = v_cycle;
  select is_current into v_current from public.report_history_entries
  where cycle_processing_id = v_processing and emission_version = 2;
  if v_current is not false then
    raise exception 'FALHOU(plano): emissão permaneceu atual após alteração do plano';
  end if;

  set session_replication_role = replica;
  update public.cycles set action_plan_revision = 0, state = 'in_response' where id = v_cycle;
  set session_replication_role = default;
  select is_current into v_current from public.report_history_entries
  where cycle_processing_id = v_processing and emission_version = 2;
  if v_current is not false then
    raise exception 'FALHOU(reabertura): emissão permaneceu atual após reabrir ciclo';
  end if;

  set session_replication_role = replica;
  delete from public.reports where cycle_id = v_cycle;
  delete from storage.objects where bucket_id = 'relatorios' and name in (v_first_path, v_second_path);
  delete from public.fami_results where cycle_id = v_cycle;
  delete from public.cycle_processings where id = v_processing;
  delete from public.cycles where id = v_cycle;
  set session_replication_role = default;
end $$;

do $$ begin
  raise notice 'REPORT HISTORY VIEWS: OK';
end $$;
