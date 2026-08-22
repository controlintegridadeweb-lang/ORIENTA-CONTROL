-- ============================================================================
-- Verificação de integração: preparação e envio consolidado de ajustes.
--
-- Prova que:
--   1. marcar uma evidência para ajuste não encerra a rodada administrativa;
--   2. o envio consolidado só ocorre quando a fila não possui pendências;
--   3. a transição in_validation → awaiting_adjustment é atômica;
--   4. ciclos fora de validação não aceitam novos vereditos.
-- Pré: _seed_minimal.sql.
-- Saída esperada: "VALIDATE EVIDENCE CONSOLIDATED: OK".
-- ============================================================================
set session_replication_role = replica;
insert into public.evidences(
  id, response_id, kind, storage_path, validation_status, submitted_by
) values
  (
    '00000000-0000-0000-0000-00000000e001',
    '00000000-0000-0000-0000-000000000dd1',
    'file', 'seed/ev-1.pdf', 'pending',
    '00000000-0000-0000-0000-0000000000a1'
  ),
  (
    '00000000-0000-0000-0000-00000000e002',
    '00000000-0000-0000-0000-000000000dd1',
    'file', 'seed/ev-2.pdf', 'pending',
    '00000000-0000-0000-0000-0000000000a1'
  )
on conflict (id) do update
set validation_status = 'pending',
    validation_justification = null,
    validated_at = null,
    deactivated_at = null;
update public.cycles
set state = 'in_validation'
where id = '00000000-0000-0000-0000-000000000cc1';
reset session_replication_role;

do $$
declare
  v_status public.evidence_validation_status;
  v_state public.cycle_state;
  v_result jsonb;
  v_validated_at timestamptz;
begin
  begin
    perform public.validate_evidence(
      '00000000-0000-0000-0000-00000000e001',
      '00000000-0000-0000-0000-000000000999',
      'approve',
      '00000000-0000-0000-0000-0000000000a1',
      null
    );
    raise exception 'FALHOU(escopo): aceitou evidência de outro diagnóstico';
  exception when sqlstate '23514' then
    null;
  end;

  perform public.validate_evidence(
    '00000000-0000-0000-0000-00000000e001',
    '00000000-0000-0000-0000-000000000cc1',
    'request_adjustment',
    '00000000-0000-0000-0000-0000000000a1',
    'Substitua o arquivo por uma versão atualizada.'
  );

  select validation_status into v_status
  from public.evidences
  where id = '00000000-0000-0000-0000-00000000e001';
  select state into v_state
  from public.cycles
  where id = '00000000-0000-0000-0000-000000000cc1';

  if v_status <> 'adjustment_requested' then
    raise exception 'FALHOU(preparo): evidência=%', v_status;
  end if;
  if v_state <> 'in_validation' then
    raise exception 'FALHOU(preparo): ciclo saiu da fila antes do envio: %', v_state;
  end if;

  select validated_at into v_validated_at
  from public.evidences
  where id = '00000000-0000-0000-0000-00000000e001';

  begin
    perform public.validate_evidence(
      '00000000-0000-0000-0000-00000000e001',
      '00000000-0000-0000-0000-000000000cc1',
      'approve',
      '00000000-0000-0000-0000-0000000000a1',
      null,
      'pending',
      null
    );
    raise exception 'FALHOU(concorrência): parecer antigo sobrescreveu decisão atual';
  exception when sqlstate '40001' then
    null;
  end;

  select validation_status into v_status
  from public.evidences
  where id = '00000000-0000-0000-0000-00000000e001';
  if v_status <> 'adjustment_requested' then
    raise exception 'FALHOU(concorrência): status mudou para %', v_status;
  end if;

  begin
    perform public.dispatch_evidence_adjustments(
      '00000000-0000-0000-0000-000000000cc1',
      '00000000-0000-0000-0000-0000000000a1'
    );
    raise exception 'FALHOU(fila): enviou devolutiva com evidência ainda pendente';
  exception when sqlstate 'P0001' then
    null;
  end;

  select state into v_state
  from public.cycles
  where id = '00000000-0000-0000-0000-000000000cc1';
  if v_state <> 'in_validation' then
    raise exception 'FALHOU(fila): tentativa incompleta alterou o ciclo para %', v_state;
  end if;

  perform public.validate_evidence(
    '00000000-0000-0000-0000-00000000e002',
    '00000000-0000-0000-0000-000000000cc1',
    'request_adjustment',
    '00000000-0000-0000-0000-0000000000a1',
    'Inclua a página de assinatura.'
  );

  v_result := public.dispatch_evidence_adjustments(
    '00000000-0000-0000-0000-000000000cc1',
    '00000000-0000-0000-0000-0000000000a1'
  );
  if (v_result ->> 'adjustmentCount')::integer <> 2 then
    raise exception 'FALHOU(envio): quantidade incorreta %', v_result;
  end if;

  select state into v_state
  from public.cycles
  where id = '00000000-0000-0000-0000-000000000cc1';
  if v_state <> 'awaiting_adjustment' then
    raise exception 'FALHOU(envio): ciclo=%', v_state;
  end if;

  begin
    perform public.dispatch_evidence_adjustments(
      '00000000-0000-0000-0000-000000000cc1',
      '00000000-0000-0000-0000-0000000000a1'
    );
    raise exception 'FALHOU(duplicado): aceitou novo envio fora de in_validation';
  exception when sqlstate 'P0001' then
    null;
  end;

  begin
    perform public.validate_evidence(
      '00000000-0000-0000-0000-00000000e001',
      '00000000-0000-0000-0000-000000000cc1',
      'approve',
      '00000000-0000-0000-0000-0000000000a1',
      null
    );
    raise exception 'FALHOU(estado): aceitou veredito em awaiting_adjustment';
  exception when sqlstate 'P0001' then
    null;
  end;

  select validation_status into v_status
  from public.evidences
  where id = '00000000-0000-0000-0000-00000000e001';
  if v_status <> 'adjustment_requested' then
    raise exception 'FALHOU(rollback): evidência mudou para %', v_status;
  end if;

  set session_replication_role = replica;
  delete from public.evidences
  where id in (
    '00000000-0000-0000-0000-00000000e001',
    '00000000-0000-0000-0000-00000000e002'
  );
  delete from public.audit_logs
  where entity_type in ('evidences','cycles')
    and record_id in (
      '00000000-0000-0000-0000-00000000e001',
      '00000000-0000-0000-0000-00000000e002',
      '00000000-0000-0000-0000-000000000cc1'
    );
  update public.cycles
  set state = 'validated'
  where id = '00000000-0000-0000-0000-000000000cc1';
  set session_replication_role = default;

  raise notice 'VALIDATE EVIDENCE CONSOLIDATED: OK';
end $$;
