-- ============================================================================
-- Verificação de integração: dispensa remove a questão do FAMI oficial.
-- Pré: _seed_minimal.sql. Saída: "WAIVER FAMI WIRING: OK".
-- ============================================================================

begin;

set local session_replication_role = replica;
insert into public.question_organization_waivers(
  id, organization_id, question_id, reason, waived_by
) values (
  '00000000-0000-0000-0000-000000000ff1',
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000e1',
  'dispensa de teste',
  '00000000-0000-0000-0000-0000000000a1'
) on conflict do nothing;
reset session_replication_role;

do $$
declare
  v_global record;
  v_scope_count integer;
begin
  select * into v_global
  from public.calculate_live_fami_rows('00000000-0000-0000-0000-000000000cc1')
  where scope_type = 'global' and scope_id is null;

  if not found then
    raise exception 'FALHOU(global): cálculo vivo não retornou o escopo global';
  end if;
  if v_global.points_obtained <> 0
     or v_global.points_possible <> 0
     or v_global.percentage <> 0
     or v_global.maturity_level is not null then
    raise exception 'FALHOU(waiver): dispensa não removeu o critério do denominador: %',
      row_to_json(v_global);
  end if;

  select count(*) into v_scope_count
  from public.calculate_live_fami_rows('00000000-0000-0000-0000-000000000cc1');
  if v_scope_count <> 3 then
    raise exception 'FALHOU(estrutura): seção/eixo N/A desapareceram';
  end if;

  raise notice 'WAIVER FAMI WIRING: OK';
end $$;

rollback;
