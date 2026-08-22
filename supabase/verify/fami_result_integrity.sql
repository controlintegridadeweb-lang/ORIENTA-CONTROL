-- ============================================================================
-- Verificação de integração: cálculo vivo, estrutura completa e cenário N/A.
-- Pré: _seed_minimal.sql. Saída: "FAMI RESULT INTEGRITY: OK".
-- Todas as alterações deste arquivo são revertidas ao final.
-- ============================================================================

begin;

-- O seed possui uma pergunta com evidência obrigatória, respondida “Sim”, mas
-- sem evidência aprovada. Na política v7 o critério vale 0 de 2,0 (sem ponto
-- provisório) e os três escopos devem existir (seção, eixo e global).
do $$
declare
  v_global record;
  v_count integer;
begin
  select * into v_global
  from public.calculate_live_fami_rows('00000000-0000-0000-0000-000000000cc1')
  where scope_type = 'global' and scope_id is null;

  if not found then
    raise exception 'FALHOU(global): linha global não foi calculada';
  end if;
  if v_global.points_obtained <> 0
     or v_global.points_possible <> 2
     or v_global.percentage <> 0
     or v_global.maturity_level <> 1 then
    raise exception 'FALHOU(pontuação): resultado inesperado %', row_to_json(v_global);
  end if;

  select count(*) into v_count
  from public.calculate_live_fami_rows('00000000-0000-0000-0000-000000000cc1');
  if v_count <> 3 then
    raise exception 'FALHOU(estrutura): esperadas 3 linhas, recebidas %', v_count;
  end if;
end $$;

-- Simula um diagnóstico integralmente N/A. O resultado continua materializável:
-- pontos possíveis e percentual iguais a zero, com nível nulo em todos os
-- escopos. O modo replica é restrito a esta transação de verificação.
set local session_replication_role = replica;
update public.responses
set answer = 'not_applicable'::public.answer_value,
    is_not_applicable = true,
    na_justification = 'Critério fora do escopo operacional desta verificação.',
    na_validation_status = 'approved'::public.na_validation_status,
    na_rejection_reason = null
where id = '00000000-0000-0000-0000-000000000dd1';
reset session_replication_role;

do $$
declare
  v_row record;
  v_count integer := 0;
begin
  for v_row in
    select *
    from public.calculate_live_fami_rows('00000000-0000-0000-0000-000000000cc1')
  loop
    v_count := v_count + 1;
    if v_row.points_obtained <> 0
       or v_row.points_possible <> 0
       or v_row.percentage <> 0
       or v_row.maturity_level is not null then
      raise exception 'FALHOU(N/A): escopo inesperado %', row_to_json(v_row);
    end if;
  end loop;

  if v_count <> 3 then
    raise exception 'FALHOU(N/A estrutura): esperadas 3 linhas, recebidas %', v_count;
  end if;

  raise notice 'FAMI RESULT INTEGRITY: OK';
end $$;

rollback;
