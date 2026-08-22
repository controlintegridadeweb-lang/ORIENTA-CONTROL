-- ============================================================================
-- Verificação: cada evidência devolvida exige uma substituição própria.
-- Pré: _seed_minimal.sql.
-- Saída esperada: "EVIDENCE ADJUSTMENT ROUNDTRIP: OK".
-- ============================================================================
set session_replication_role = replica;
update public.cycles
set state = 'awaiting_adjustment'
where id = '00000000-0000-0000-0000-000000000cc1';

insert into public.evidences(
  id, response_id, kind, storage_path, validation_status,
  validation_justification, validated_at, submitted_at, submitted_by
) values
  (
    '00000000-0000-0000-0000-00000000e011',
    '00000000-0000-0000-0000-000000000dd1',
    'file', 'seed/devolvida-1.pdf', 'adjustment_requested',
    'Envie uma versão atualizada.', now() - interval '10 minutes',
    now() - interval '20 minutes', '00000000-0000-0000-0000-0000000000a1'
  ),
  (
    '00000000-0000-0000-0000-00000000e012',
    '00000000-0000-0000-0000-000000000dd1',
    'file', 'seed/devolvida-2.pdf', 'adjustment_requested',
    'Inclua a página de assinatura.', now() - interval '10 minutes',
    now() - interval '19 minutes', '00000000-0000-0000-0000-0000000000a1'
  ),
  (
    '00000000-0000-0000-0000-00000000e013',
    '00000000-0000-0000-0000-000000000dd1',
    'file', 'seed/corrigida-1.pdf', 'pending',
    null, null, now() - interval '1 minute',
    '00000000-0000-0000-0000-0000000000a1'
  )
on conflict (id) do update
set validation_status = excluded.validation_status,
    validation_justification = excluded.validation_justification,
    validated_at = excluded.validated_at,
    submitted_at = excluded.submitted_at,
    deactivated_at = null;
reset session_replication_role;

do $$
declare
  v_state public.cycle_state;
  v_active_requests integer;
begin
  begin
    perform public.commit_cycle_transition(
      '00000000-0000-0000-0000-000000000cc1',
      '00000000-0000-0000-0000-0000000000a1',
      'in_validation'::public.cycle_state,
      null,
      null,
      'awaiting_adjustment'::public.cycle_state
    );
    raise exception 'FALHOU: uma substituição resolveu duas devolutivas';
  exception when sqlstate '23514' then
    null;
  end;

  select state into v_state
  from public.cycles
  where id = '00000000-0000-0000-0000-000000000cc1';

  select count(*)::integer into v_active_requests
  from public.evidences
  where id in (
    '00000000-0000-0000-0000-00000000e011',
    '00000000-0000-0000-0000-00000000e012'
  )
    and deactivated_at is null;

  if v_state <> 'awaiting_adjustment' then
    raise exception 'FALHOU: tentativa incompleta alterou o ciclo para %', v_state;
  end if;
  if v_active_requests <> 2 then
    raise exception 'FALHOU: tentativa incompleta desativou devolutivas';
  end if;
end $$;

set session_replication_role = replica;
insert into public.evidences(
  id, response_id, kind, storage_path, validation_status,
  submitted_at, submitted_by
) values (
  '00000000-0000-0000-0000-00000000e014',
  '00000000-0000-0000-0000-000000000dd1',
  'file', 'seed/corrigida-2.pdf', 'pending',
  now(), '00000000-0000-0000-0000-0000000000a1'
) on conflict (id) do update
set validation_status = 'pending',
    submitted_at = excluded.submitted_at,
    deactivated_at = null;
reset session_replication_role;

do $$
declare
  v_state public.cycle_state;
  v_active_requests integer;
  v_active_replacements integer;
begin
  perform public.commit_cycle_transition(
    '00000000-0000-0000-0000-000000000cc1',
    '00000000-0000-0000-0000-0000000000a1',
    'in_validation'::public.cycle_state,
    null,
    null,
    'awaiting_adjustment'::public.cycle_state
  );

  select state into v_state
  from public.cycles
  where id = '00000000-0000-0000-0000-000000000cc1';

  select count(*)::integer into v_active_requests
  from public.evidences
  where id in (
    '00000000-0000-0000-0000-00000000e011',
    '00000000-0000-0000-0000-00000000e012'
  )
    and deactivated_at is null;

  select count(*)::integer into v_active_replacements
  from public.evidences
  where id in (
    '00000000-0000-0000-0000-00000000e013',
    '00000000-0000-0000-0000-00000000e014'
  )
    and deactivated_at is null;

  if v_state <> 'in_validation' then
    raise exception 'FALHOU: ciclo=%', v_state;
  end if;
  if v_active_requests <> 0 then
    raise exception 'FALHOU: devolutivas pareadas continuaram ativas';
  end if;
  if v_active_replacements <> 2 then
    raise exception 'FALHOU: novas evidências foram desativadas';
  end if;

  set session_replication_role = replica;
  delete from public.evidences
  where id in (
    '00000000-0000-0000-0000-00000000e011',
    '00000000-0000-0000-0000-00000000e012',
    '00000000-0000-0000-0000-00000000e013',
    '00000000-0000-0000-0000-00000000e014'
  );
  update public.cycles
  set state = 'validated'
  where id = '00000000-0000-0000-0000-000000000cc1';
  set session_replication_role = default;

  raise notice 'EVIDENCE ADJUSTMENT ROUNDTRIP: OK';
end $$;
