-- ============================================================================
-- Verificação de integração: ciclo integralmente dispensado gera FAMI N/A e
-- pode ser concluído sem snapshots de resposta.
--
-- Pré: _seed_minimal.sql.
-- Saída esperada: "FAMI ALL NOT APPLICABLE: OK".
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
delete from public.responses
where id = '00000000-0000-0000-0000-000000000dd1';

insert into public.question_organization_waivers(
  id, organization_id, question_id, reason, waived_by
) values (
  '00000000-0000-0000-0000-000000000ff2',
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000e1',
  'critério fora do escopo do órgão',
  '00000000-0000-0000-0000-0000000000a1'
)
on conflict (organization_id, question_id) do update set
  reason = excluded.reason,
  waived_by = excluded.waived_by,
  waived_at = statement_timestamp();

reset session_replication_role;

do $$
declare
  v_state public.cycle_state;
  v_processing_status public.cycle_processing_status;
  v_global record;
  v_response_snapshot_count integer;
  v_waiver_snapshot_count integer;
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

  select * into v_global
  from public.fami_results
  where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1'
    and scope_type = 'global'
    and scope_id is null;

  select count(*) into v_response_snapshot_count
  from public.response_snapshots
  where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1';

  select count(*) into v_waiver_snapshot_count
  from public.processing_waiver_snapshots
  where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1';

  if v_state <> 'validated' or v_processing_status <> 'completed' then
    raise exception 'FALHOU(finalização N/A): state=%, processing=%',
      v_state, v_processing_status;
  end if;

  if v_global.points_obtained <> 0
     or v_global.points_possible <> 0
     or v_global.percentage <> 0
     or v_global.maturity_level is not null then
    raise exception 'FALHOU(FAMI N/A): %', row_to_json(v_global);
  end if;

  if v_response_snapshot_count <> 0 then
    raise exception 'FALHOU(snapshot): esperado zero response_snapshot, encontrado %',
      v_response_snapshot_count;
  end if;

  if v_waiver_snapshot_count <> 1 then
    raise exception 'FALHOU(snapshot): esperada uma dispensa congelada, encontrada %',
      v_waiver_snapshot_count;
  end if;

  if exists (
    select 1
    from public.recommendations
    where cycle_processing_id = '00000000-0000-0000-0000-000000000ee1'
      and source = 'engine'
  ) then
    raise exception 'FALHOU(recomendação): critério dispensado gerou recomendação';
  end if;

  raise notice 'FAMI ALL NOT APPLICABLE: OK';
end $$;

rollback;
