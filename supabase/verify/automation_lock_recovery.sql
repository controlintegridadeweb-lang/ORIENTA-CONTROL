-- ============================================================================
-- Verificação de integração: recuperação de locks vencidos na tentativa final.
-- Pré: _seed_minimal.sql.
-- Saída esperada: "AUTOMATION LOCK RECOVERY: OK".
-- ============================================================================
begin;

insert into public.automation_jobs(
  id, kind, status, requested_by, attempts, max_attempts,
  scheduled_for, locked_at, locked_by
) values (
  '00000000-0000-0000-0000-00000000a801',
  'cycle_open', 'processing',
  '00000000-0000-0000-0000-0000000000a1',
  5, 5, now() - interval '100 years', now() - interval '1 hour', 'worker-antigo'
);

insert into public.notification_outbox(
  id, recipient_user_id, kind, payload, dedupe_key, status,
  attempts, max_attempts, scheduled_for, locked_at, locked_by
) values (
  '00000000-0000-0000-0000-00000000a802',
  '00000000-0000-0000-0000-0000000000a1',
  'test', '{}'::jsonb, 'verify-lock-recovery', 'processing',
  5, 5, now() - interval '100 years', now() - interval '1 hour', 'worker-antigo'
);

do $$
declare
  v_jobs integer;
  v_notifications integer;
  v_attempts integer;
  v_worker text;
begin
  select count(*) into v_jobs
  from public.claim_automation_jobs(
    'worker-recuperado', array['cycle_open'], 1, interval '15 minutes'
  );
  if v_jobs <> 1 then
    raise exception 'FALHOU(lock jobs): última tentativa vencida não foi recuperada';
  end if;

  select attempts, locked_by into v_attempts, v_worker
  from public.automation_jobs
  where id = '00000000-0000-0000-0000-00000000a801';
  if v_attempts <> 5 or v_worker <> 'worker-recuperado' then
    raise exception 'FALHOU(lock jobs): attempts=%, worker=%', v_attempts, v_worker;
  end if;

  select count(*) into v_notifications
  from public.claim_notification_outbox(
    'notification-recuperada', 1, interval '10 minutes'
  );
  if v_notifications <> 1 then
    raise exception 'FALHOU(lock notifications): última tentativa vencida não foi recuperada';
  end if;

  select attempts, locked_by into v_attempts, v_worker
  from public.notification_outbox
  where id = '00000000-0000-0000-0000-00000000a802';
  if v_attempts <> 5 or v_worker <> 'notification-recuperada' then
    raise exception 'FALHOU(lock notifications): attempts=%, worker=%', v_attempts, v_worker;
  end if;
end $$;

rollback;

do $$ begin
  raise notice 'AUTOMATION LOCK RECOVERY: OK';
end $$;
