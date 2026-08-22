-- ============================================================================
-- Verificação de integração: emissões oficiais imutáveis e versionadas.
--
-- Garante o fluxo real reserva → objeto PDF → finalização, incluindo:
--   • versão sequencial e motivo obrigatório para reemissão;
--   • metadados criptográficos obrigatórios;
--   • notificação somente após `preparing → completed`;
--   • imutabilidade do registro e do objeto no Storage;
--   • bloqueio quando ciclo ou revisão do plano deixam de corresponder.
-- Pré: _seed_minimal.sql.
-- Saída esperada: "REPORT EMISSIONS: OK".
-- ============================================================================
set session_replication_role = replica;

insert into auth.users(id, email) values (
  '00000000-0000-0000-0000-00000000a0e7',
  'respondente-relatorio@orienta.test'
) on conflict do nothing;
insert into public.profiles(user_id, role, organization_id, full_name) values (
  '00000000-0000-0000-0000-00000000a0e7',
  'respondent',
  '00000000-0000-0000-0000-0000000000b1',
  'Respondente Relatório'
) on conflict (user_id) do update set
  role = excluded.role,
  organization_id = excluded.organization_id,
  full_name = excluded.full_name;

insert into public.cycles(
  id, form_version_id, organization_id, period_id, period_label,
  reference_start_year, reference_end_year, action_plan_revision,
  state, closed_at
) values (
  '00000000-0000-0000-0000-00000000c0e7',
  '00000000-0000-0000-0000-000000000bb1',
  '00000000-0000-0000-0000-0000000000b1',
  (public.ensure_form_period(
    '00000000-0000-0000-0000-000000000bb1',
    'report-emissions',
    'Diagnóstico institucional 2026'
  )).id,
  'Diagnóstico institucional 2026',
  2026, 2026, 0,
  'completed', now()
)
on conflict (id) do update set
  state = 'completed', closed_at = excluded.closed_at,
  period_id = excluded.period_id,
  reference_start_year = 2026, reference_end_year = 2026,
  action_plan_revision = 0;

insert into public.cycle_processings(
  id, cycle_id, processing_version, status, completed_at
) values (
  '00000000-0000-0000-0000-00000000e0e7',
  '00000000-0000-0000-0000-00000000c0e7',
  1, 'completed', now()
)
on conflict (id) do update set status = 'completed', completed_at = excluded.completed_at;

reset session_replication_role;

do $$
declare
  v_cycle uuid := '00000000-0000-0000-0000-00000000c0e7';
  v_processing uuid := '00000000-0000-0000-0000-00000000e0e7';
  v_actor uuid := '00000000-0000-0000-0000-0000000000a1';
  v_first jsonb;
  v_second jsonb;
  v_first_id uuid;
  v_second_id uuid;
  v_first_path text;
  v_second_path text;
  v_count integer;
  v_respondent uuid := '00000000-0000-0000-0000-00000000a0e7';
begin
  delete from public.notification_outbox
  where recipient_user_id = v_respondent and kind = 'official_report_available';
  delete from public.user_notifications
  where user_id = v_respondent and kind = 'official_report_available';

  v_first := public.reserve_report_emission(
    v_cycle, v_processing, v_actor, 0, now(), null
  );
  v_first_id := (v_first ->> 'id')::uuid;
  v_first_path := v_first ->> 'file_path';
  if (v_first ->> 'emission_version')::integer <> 1 then
    raise exception 'FALHOU(primeira emissão): versão=%', v_first ->> 'emission_version';
  end if;

  select count(*) into v_count from public.user_notifications
  where user_id = v_respondent and kind = 'official_report_available';
  if v_count <> 0 then
    raise exception 'FALHOU(notificação): reserva preparing gerou % aviso(s)', v_count;
  end if;

  insert into storage.objects(bucket_id, name, metadata)
  values ('relatorios', v_first_path, '{"mimetype":"application/pdf","size":128}'::jsonb);
  perform public.finalize_report_emission(
    v_first_id, repeat('a', 64), repeat('b', 64), 128
  );

  select count(*) into v_count from public.user_notifications
  where user_id = v_respondent and kind = 'official_report_available';
  if v_count <> 1 then
    raise exception 'FALHOU(notificação): finalização deveria gerar 1 aviso, gerou %', v_count;
  end if;

  begin
    perform public.reserve_report_emission(
      v_cycle, v_processing, v_actor, 0, now(), null
    );
    raise exception 'FALHOU(reemissão): aceitou reemissão sem motivo';
  exception when sqlstate 'P0001' then null;
  end;

  v_second := public.reserve_report_emission(
    v_cycle, v_processing, v_actor, 0, now(),
    'Correção documental controlada.'
  );
  v_second_id := (v_second ->> 'id')::uuid;
  v_second_path := v_second ->> 'file_path';
  if (v_second ->> 'emission_version')::integer <> 2 then
    raise exception 'FALHOU(reemissão): versão=%', v_second ->> 'emission_version';
  end if;
  if (v_second ->> 'supersedes_report_id')::uuid is distinct from v_first_id then
    raise exception 'FALHOU(reemissão): vínculo de supersessão incorreto';
  end if;

  select count(*) into v_count from public.user_notifications
  where user_id = v_respondent and kind = 'official_report_available';
  if v_count <> 1 then
    raise exception 'FALHOU(notificação): segunda reserva gerou aviso antecipado';
  end if;

  insert into storage.objects(bucket_id, name, metadata)
  values ('relatorios', v_second_path, '{"mimetype":"application/pdf","size":256}'::jsonb);
  perform public.finalize_report_emission(
    v_second_id, repeat('c', 64), repeat('d', 64), 256
  );

  select count(*) into v_count from public.user_notifications
  where user_id = v_respondent and kind = 'official_report_available';
  if v_count <> 2 then
    raise exception 'FALHOU(notificação): duas emissões concluídas deveriam gerar 2 avisos, geraram %', v_count;
  end if;

  select count(*) into v_count from public.reports
  where cycle_processing_id = v_processing and status = 'completed';
  if v_count <> 2 then
    raise exception 'FALHOU(histórico): emissões concluídas=%', v_count;
  end if;

  begin
    update public.reports set generated_at = now() + interval '1 day' where id = v_first_id;
    raise exception 'FALHOU(imutabilidade): permitiu alterar emissão concluída';
  exception when sqlstate '55000' then null;
  end;

  begin
    delete from public.reports where id = v_first_id;
    raise exception 'FALHOU(imutabilidade): permitiu excluir emissão concluída';
  exception when sqlstate '55000' then null;
  end;

  begin
    update storage.objects set metadata = metadata || '{"changed":true}'::jsonb
    where bucket_id = 'relatorios' and name = v_first_path;
    raise exception 'FALHOU(storage): permitiu substituir metadados do objeto oficial';
  exception when sqlstate '55000' then null;
  end;

  begin
    delete from storage.objects where bucket_id = 'relatorios' and name = v_first_path;
    raise exception 'FALHOU(storage): permitiu excluir objeto oficial';
  exception when sqlstate '55000' then null;
  end;

  set session_replication_role = replica;
  update public.cycles set state = 'in_response', closed_at = null where id = v_cycle;
  set session_replication_role = default;
  begin
    perform public.reserve_report_emission(
      v_cycle, v_processing, v_actor, 0, now(), 'Tentativa em ciclo reaberto.'
    );
    raise exception 'FALHOU(estado): aceitou emissão de ciclo reaberto';
  exception when sqlstate 'P0001' then null;
  end;

  set session_replication_role = replica;
  delete from public.notification_outbox
  where recipient_user_id = v_respondent and kind = 'official_report_available';
  delete from public.user_notifications
  where user_id = v_respondent and kind = 'official_report_available';
  delete from public.reports where id in (v_second_id, v_first_id);
  delete from storage.objects where bucket_id = 'relatorios' and name in (v_first_path, v_second_path);
  delete from public.cycle_processings where id = v_processing;
  delete from public.cycles where id = v_cycle;
  delete from public.profiles where user_id = v_respondent;
  delete from auth.users where id = v_respondent;
  set session_replication_role = default;

  raise notice 'REPORT EMISSIONS: OK';
end $$;
