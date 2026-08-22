-- ============================================================================
-- Verifica dados cadastrais do respondente e a RPC auditável de dispensa usada
-- pela importação histórica. Pré: _seed_minimal.sql.
-- Saída esperada: "RESPONDENT IMPORT SUPPORT: OK".
-- ============================================================================

begin;

insert into auth.users(id, email)
values ('00000000-0000-0000-0000-0000000000a5', 'respondent-import@orienta.test')
on conflict do nothing;

insert into public.profiles(user_id, role, organization_id, full_name)
values (
  '00000000-0000-0000-0000-0000000000a5',
  'respondent',
  '00000000-0000-0000-0000-0000000000b1',
  'Respondente Importação'
)
on conflict (user_id) do nothing;

update public.forms
set current_form_version_id = '00000000-0000-0000-0000-000000000bb1'
where id = '00000000-0000-0000-0000-000000000aa1';

insert into public.form_assignments(form_id, organization_id, assigned_by)
values (
  '00000000-0000-0000-0000-000000000aa1',
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000a1'
)
on conflict (form_id, organization_id) do nothing;

do $$
declare
  v_result jsonb;
  v_cycle_id uuid;
  v_cycle public.cycles;
begin
  v_result := public.create_or_open_historical_cycle(
    '00000000-0000-0000-0000-000000000aa1',
    '00000000-0000-0000-0000-0000000000b1',
    'Histórico 2026',
    '00000000-0000-0000-0000-0000000000a1'
  );
  v_cycle_id := (v_result -> 'cycle' ->> 'id')::uuid;

  select * into v_cycle from public.cycles where id = v_cycle_id;
  if v_cycle.state <> 'in_response'::public.cycle_state
     or v_cycle.starts_at is not null
     or v_cycle.response_deadline_at is not null then
    raise exception 'FALHOU(import): ciclo histórico inventou cronograma ou não abriu';
  end if;

  perform public.apply_workbench_response(
    v_cycle_id,
    '00000000-0000-0000-0000-0000000000a5',
    '00000000-0000-0000-0000-0000000000f1',
    'yes'::public.answer_value,
    'Resposta histórica',
    null,
    '[]'::jsonb
  );

  perform public.advance_historical_cycle_to_validation(
    v_cycle_id,
    '00000000-0000-0000-0000-0000000000a5',
    '00000000-0000-0000-0000-0000000000a1'
  );

  select * into v_cycle from public.cycles where id = v_cycle_id;
  if v_cycle.state <> 'in_validation'::public.cycle_state then
    raise exception 'FALHOU(import): ciclo histórico não avançou para validação';
  end if;

  if exists (
    select 1
    from public.user_notifications n
    where n.kind in ('diagnostic_opened', 'diagnostic_validation_started', 'validation_pending')
      and n.action_path like '%' || v_cycle_id::text || '%'
  ) or exists (
    select 1
    from public.notification_outbox o
    where o.payload ->> 'cycle_id' = v_cycle_id::text
  ) then
    raise exception 'FALHOU(import): carga histórica disparou notificação operacional';
  end if;
end $$;

select public.upsert_respondent_profile_details(
  '00000000-0000-0000-0000-0000000000a5',
  '123.456-7',
  'Unidade de Integridade',
  'Coordenador',
  '2026-06-01T12:00:00Z'::timestamptz,
  'Declaro estar ciente',
  'Planilha histórica',
  '00000000-0000-0000-0000-0000000000a1'
);

select public.upsert_question_organization_waiver(
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000e1',
  'Dispensa histórica explicitamente validada para o órgão.',
  '00000000-0000-0000-0000-0000000000a1'
);

select public.upsert_question_organization_waiver(
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000e1',
  'Dispensa histórica atualizada sem duplicar o registro.',
  '00000000-0000-0000-0000-0000000000a1'
);

do $$
declare
  v_details_count integer;
  v_waiver_count integer;
  v_reason text;
  v_audit_count integer;
begin
  select count(*) into v_details_count
  from public.respondent_profile_details
  where user_id = '00000000-0000-0000-0000-0000000000a5'
    and registration_number = '123.456-7'
    and organizational_unit = 'Unidade de Integridade'
    and position_title = 'Coordenador';

  if v_details_count <> 1 then
    raise exception 'FALHOU(import): dados cadastrais não foram persistidos';
  end if;

  select count(*), max(reason) into v_waiver_count, v_reason
  from public.question_organization_waivers
  where organization_id = '00000000-0000-0000-0000-0000000000b1'
    and question_id = '00000000-0000-0000-0000-0000000000e1';

  if v_waiver_count <> 1
     or v_reason <> 'Dispensa histórica atualizada sem duplicar o registro.' then
    raise exception 'FALHOU(import): dispensa não é idempotente';
  end if;

  select count(*) into v_audit_count
  from public.audit_logs
  where actor_user_id = '00000000-0000-0000-0000-0000000000a1'
    and entity_type in ('respondent_profile_details', 'question_organization_waivers');

  if v_audit_count < 3 then
    raise exception 'FALHOU(import): operações não foram auditadas';
  end if;

  perform public.upsert_respondent_profile_details(
    '00000000-0000-0000-0000-0000000000a5',
    '123.456-7',
    'Unidade de Integridade',
    'Coordenador',
    '2026-06-01T12:00:00Z'::timestamptz,
    'Declaro estar ciente',
    'Planilha histórica',
    '00000000-0000-0000-0000-0000000000a1'
  );
  perform public.upsert_question_organization_waiver(
    '00000000-0000-0000-0000-0000000000b1',
    '00000000-0000-0000-0000-0000000000e1',
    'Dispensa histórica atualizada sem duplicar o registro.',
    '00000000-0000-0000-0000-0000000000a1'
  );

  if (
    select count(*)
    from public.audit_logs
    where actor_user_id = '00000000-0000-0000-0000-0000000000a1'
      and entity_type in ('respondent_profile_details', 'question_organization_waivers')
  ) <> v_audit_count then
    raise exception 'FALHOU(import): reexecução idêntica gerou auditoria redundante';
  end if;
end $$;

rollback;

do $$ begin
  raise notice 'RESPONDENT IMPORT SUPPORT: OK';
end $$;
