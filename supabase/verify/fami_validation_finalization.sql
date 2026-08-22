-- ============================================================================
-- Verificação de integração: FAMI calculado e materializado na conclusão.
--
-- Prova no PostgreSQL real que:
--   • "Sim" sem documento exige decide_response_without_proof antes de
--     finalize_validation_cycle (validation_unresolved_absent_proof);
--   • validar sem comprovação desbloqueia a consolidação, pontua 0 de 2 na
--     política v7 e materializa recomendação por ausência de evidência;
--   • o banco calcula FAMI, recomendações e snapshots pelo mesmo estado vivo;
--   • o encerramento posterior não aceita payload FAMI nem recalcula;
--   • plano incompleto bloqueia validated → completed
--     (close_requires_completed_and_approved_action_plans);
--   • com execução, comprovação e aceite da supervisão, o encerramento
--     só fecha o acompanhamento e preserva o FAMI.
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

insert into auth.users(id, email)
values ('00000000-0000-0000-0000-00000000aa01', 'fami-close@orienta.test')
on conflict do nothing;

insert into public.profiles(user_id, role, organization_id, full_name)
values (
  '00000000-0000-0000-0000-00000000aa01',
  'respondent',
  '00000000-0000-0000-0000-0000000000b1',
  'Respondente FAMI'
)
on conflict (user_id) do nothing;

do $$
declare
  v_state public.cycle_state;
  v_processing_status public.cycle_processing_status;
  v_fami_count integer;
  v_global record;
  v_recommendation_id uuid;
  v_plan_id uuid;
  v_revision bigint;
  v_dummy_fami jsonb := '[{"scope_type":"global","scope_id":null,"points_obtained":2,"points_possible":2,"percentage":100,"maturity_level":5}]'::jsonb;
begin
  begin
    perform public.finalize_validation_cycle(
      '00000000-0000-0000-0000-000000000cc1',
      '00000000-0000-0000-0000-0000000000a1'
    );
    raise exception 'FALHOU(ausência): aceitou Sim sem decisão administrativa';
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'validation_unresolved_absent_proof:%' then
      raise;
    end if;
  end;

  perform public.decide_response_without_proof(
    '00000000-0000-0000-0000-000000000dd1',
    '00000000-0000-0000-0000-000000000cc1',
    '00000000-0000-0000-0000-0000000000a1',
    'validate_without_proof',
    'Critério sem documento: validar sem comprovação nesta verificação.'
  );

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
  if v_global.points_obtained <> 0
     or v_global.points_possible <> 2
     or v_global.percentage <> 0
     or v_global.maturity_level <> 1 then
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

  select result.plan_id, result.revision
    into v_plan_id, v_revision
  from public.save_respondent_action_plan(
    '00000000-0000-0000-0000-00000000aa01',
    '00000000-0000-0000-0000-0000000000b1',
    null,
    v_recommendation_id,
    'Apresentar evidência válida para o critério diagnosticado.',
    current_date + 30,
    current_date,
    'Integridade',
    '00000000-0000-0000-0000-00000000aa01',
    0,
    false,
    null,
    null
  ) result;

  begin
    perform public.commit_cycle_transition(
      '00000000-0000-0000-0000-000000000cc1',
      '00000000-0000-0000-0000-0000000000a1',
      'completed',
      null,
      null,
      'validated'
    );
    raise exception 'FALHOU(supervisão): aceitou plano incompleto';
  exception when sqlstate '23514' then
    if sqlerrm <> 'close_requires_completed_and_approved_action_plans' then
      raise;
    end if;
  end;

  select result.revision
    into v_revision
  from public.save_respondent_action_plan(
    '00000000-0000-0000-0000-00000000aa01',
    '00000000-0000-0000-0000-0000000000b1',
    v_plan_id,
    v_recommendation_id,
    'Apresentar evidência válida para o critério diagnosticado.',
    current_date + 30,
    current_date,
    'Integridade',
    '00000000-0000-0000-0000-00000000aa01',
    100,
    false,
    v_revision,
    'Execução concluída nesta verificação.',
    'Conclusão integral da ação.'
  ) result;

  insert into public.action_plan_documents (
    action_plan_id,
    organization_id,
    action_revision,
    kind,
    title,
    external_link,
    file_validation_status,
    uploaded_by
  ) values (
    v_plan_id,
    '00000000-0000-0000-0000-0000000000b1',
    v_revision,
    'link',
    'Comprovação da execução do plano',
    'https://example.org/comprovacao-fami',
    'not_applicable',
    '00000000-0000-0000-0000-00000000aa01'
  );

  perform public.create_action_plan_supervision_note(
    v_recommendation_id,
    v_plan_id,
    '00000000-0000-0000-0000-0000000000a1',
    'approval',
    'Execução conferida e aceita nesta verificação.'
  );

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
