-- ============================================================================
-- Verificação de integração: FAMI calculado e materializado na conclusão.
--
-- Prova no PostgreSQL real que:
--   • "Sim" em pergunta com evidência obrigatória pode ser finalizado, recebe
--     0 ponto sem comprovação aprovada (peso possível 1,5) e gera recomendação
--     por ausência dela;
--   • o banco calcula FAMI, recomendações e snapshots pelo mesmo estado vivo;
--   • o encerramento posterior não aceita payload FAMI nem recalcula;
--   • `validated -> completed` encerra somente o acompanhamento.
-- Pré: _seed_minimal.sql.
-- Saída esperada: "FAMI VALIDATION FINALIZATION: OK".
-- ============================================================================

begin;

set local session_replication_role = replica;
update public.cycles
set state = 'in_validation', validated_at = null, closed_at = null
where id = '00000000-0000-0000-0000-000000000cc1';

update public.cycle_processings
set status = 'working', completed_at = null
where id = '00000000-0000-0000-0000-000000000ee1';

delete from public.action_plans
where recommendation_id in (
  select id from public.recommendations
  where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1'
);
delete from public.recommendations
where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1';
delete from public.fami_results
where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1';
delete from public.processing_waiver_snapshots
where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1';
delete from public.evidence_snapshots
where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1';
delete from public.response_snapshots
where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1';
delete from public.evidences
where response_id = '00000000-0000-0000-0000-000000000dd1';
reset session_replication_role;

do $$
declare
  v_state public.cycle_state;
  v_processing_status public.cycle_processing_status;
  v_fami_count integer;
  v_global record;
  v_recommendation_id uuid;
  v_dummy_fami jsonb := '[{"scope_type":"global","scope_id":null,"points_obtained":2,"points_possible":2,"percentage":100,"maturity_level":5}]'::jsonb;
begin
  perform public.finalize_validation_cycle(
    '00000000-0000-0000-0000-000000000cc1',
    '00000000-0000-0000-0000-0000000000a1'
  );

  select state into v_state
  from public.cycles
  where id = '00000000-0000-0000-0000-000000000cc1';

  select status into v_processing_status
  from public.cycle_processings
  where id = '00000000-0000-0000-0000-000000000ee1';

  select count(*) into v_fami_count
  from public.fami_results
  where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1';

  select * into v_global
  from public.fami_results
  where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1'
    and scope_type = 'global'
    and scope_id is null;

  if v_state <> 'validated' or v_processing_status <> 'completed' then
    raise exception 'FALHOU(finalização): state=%, processing=%', v_state, v_processing_status;
  end if;
  if v_fami_count <> 3 then
    raise exception 'FALHOU(FAMI): esperadas 3 linhas, encontradas %', v_fami_count;
  end if;
  if v_global.points_obtained <> 1
     or v_global.points_possible <> 2
     or v_global.percentage <> 50
     or v_global.maturity_level <> 3 then
    raise exception 'FALHOU(cálculo sem evidência): %', row_to_json(v_global);
  end if;
  if not exists (
    select 1 from public.response_snapshots
    where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1'
  ) then
    raise exception 'FALHOU(snapshot): resposta não foi congelada';
  end if;
  if exists (
    select 1 from public.evidence_snapshots
    where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1'
  ) then
    raise exception 'FALHOU(snapshot): criou evidência inexistente';
  end if;

  select id into v_recommendation_id
  from public.recommendations
  where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1'
    and tipo = 'ausencia_evidencia'::public.recommendation_type;

  if v_recommendation_id is null then
    raise exception 'FALHOU(recomendação): ausência de evidência não foi materializada';
  end if;

  insert into public.action_plans(
    recommendation_id, axis_id, action_text, due_date, responsible_label, status
  )
  select
    v_recommendation_id,
    qv.axis_id,
    'Apresentar evidência válida para o critério diagnosticado.',
    current_date + 30,
    'Responsável institucional',
    'todo'::public.action_plan_status
  from public.recommendations r
  join public.question_versions qv on qv.id = r.question_version_id
  where r.id = v_recommendation_id;

  begin
    perform public.commit_cycle_transition(
      '00000000-0000-0000-0000-000000000cc1',
      '00000000-0000-0000-0000-0000000000a1',
      'completed',
      v_dummy_fami,
      '{}'::jsonb,
      'validated'
    );
    raise exception 'FALHOU(recálculo): encerramento aceitou payload FAMI';
  exception when raise_exception then
    if sqlerrm <> 'fami_materialization_only_at_validation' then
      raise;
    end if;
  end;

  perform public.commit_cycle_transition(
    '00000000-0000-0000-0000-000000000cc1',
    '00000000-0000-0000-0000-0000000000a1',
    'completed',
    null,
    null,
    'validated'
  );

  select state into v_state
  from public.cycles
  where id = '00000000-0000-0000-0000-000000000cc1';

  select count(*) into v_fami_count
  from public.fami_results
  where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1';

  if v_state <> 'completed' then
    raise exception 'FALHOU(encerramento): estado final %', v_state;
  end if;
  if v_fami_count <> 3 then
    raise exception 'FALHOU(encerramento): FAMI foi reescrito';
  end if;
end $$;

rollback;

do $$ begin
  raise notice 'FAMI VALIDATION FINALIZATION: OK';
end $$;
