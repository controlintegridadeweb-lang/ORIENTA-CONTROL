-- Encerramento institucional e emissão oficial do relatório.
-- Mantém o fechamento no PostgreSQL e a persistência do PDF no Storage como
-- operações explicitamente coordenadas: falhas de emissão ficam auditáveis e
-- a reabertura permanece bloqueada até existir um documento oficial preservado.

create table public.report_emission_failures (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete restrict,
  cycle_processing_id uuid not null,
  action_plan_revision bigint not null,
  attempted_by uuid references auth.users(id) on delete set null,
  attempted_at timestamptz not null default now(),
  error_code text not null check (btrim(error_code) <> ''),
  error_message text not null check (btrim(error_message) <> ''),
  resolved_at timestamptz,
  resolved_report_id uuid references public.reports(id) on delete set null,
  constraint report_emission_failures_processing_fkey
    foreign key (cycle_processing_id, cycle_id)
    references public.cycle_processings(id, cycle_id) on delete restrict,
  constraint report_emission_failures_resolution_check check (
    (resolved_at is null and resolved_report_id is null)
    or (resolved_at is not null and resolved_report_id is not null)
  )
);

create index report_emission_failures_cycle_attempted_idx
  on public.report_emission_failures(cycle_id, attempted_at desc);

create index report_emission_failures_unresolved_idx
  on public.report_emission_failures(cycle_processing_id, action_plan_revision)
  where resolved_at is null;

alter table public.report_emission_failures enable row level security;
revoke all on table public.report_emission_failures from anon, authenticated;
grant select, insert, update, delete on table public.report_emission_failures to service_role;

create or replace function public.cycle_has_current_official_report(p_cycle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with cycle_context as (
    select c.id, c.action_plan_revision, c.reference_start_year, c.reference_end_year
    from public.cycles c
    where c.id = p_cycle_id
  ), latest_processing as (
    select cp.id
    from public.cycle_processings cp
    where cp.cycle_id = p_cycle_id
      and cp.status = 'completed'::public.cycle_processing_status
      and exists (
        select 1
        from public.fami_results fr
        where fr.cycle_processing_id = cp.id
          and fr.scope_type = 'global'
          and fr.scope_id is null
      )
    order by cp.processing_version desc
    limit 1
  )
  select exists (
    select 1
    from cycle_context c
    cross join latest_processing cp
    join public.reports r on r.cycle_processing_id = cp.id
    where r.cycle_id = c.id
      and r.status in ('completed', 'legacy')
      and (
        r.status = 'legacy'
        or (
          r.action_plan_revision = c.action_plan_revision
          and r.reference_start_year = c.reference_start_year
          and r.reference_end_year = c.reference_end_year
        )
      )
  );
$$;

revoke all on function public.cycle_has_current_official_report(uuid) from public;
grant execute on function public.cycle_has_current_official_report(uuid) to service_role;

create or replace function public.cycle_report_lifecycle_status(p_cycle_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_processing_id uuid;
begin
  select * into v_cycle from public.cycles where id = p_cycle_id;
  if not found then
    return 'not_ready';
  end if;

  select cp.id into v_processing_id
  from public.cycle_processings cp
  where cp.cycle_id = p_cycle_id
    and cp.status = 'completed'::public.cycle_processing_status
    and exists (
      select 1 from public.fami_results fr
      where fr.cycle_processing_id = cp.id
        and fr.scope_type = 'global'
        and fr.scope_id is null
    )
  order by cp.processing_version desc
  limit 1;

  if v_cycle.state <> 'completed'::public.cycle_state then
    if exists (
      select 1 from public.reports r
      where r.cycle_id = p_cycle_id and r.status in ('completed', 'legacy')
    ) then
      return 'outdated';
    end if;
    return 'not_ready';
  end if;

  if v_processing_id is null then
    return 'not_ready';
  end if;

  if public.cycle_has_current_official_report(p_cycle_id) then
    return 'available';
  end if;

  if exists (
    select 1 from public.reports r
    where r.cycle_id = p_cycle_id
      and r.cycle_processing_id = v_processing_id
      and r.status = 'preparing'
      and r.action_plan_revision = v_cycle.action_plan_revision
  ) then
    return 'emitting';
  end if;

  if exists (
    select 1
    from public.report_emission_failures f
    where f.cycle_id = p_cycle_id
      and f.cycle_processing_id = v_processing_id
      and f.action_plan_revision = v_cycle.action_plan_revision
      and f.resolved_at is null
  ) then
    return 'emission_failed';
  end if;

  return 'ready_to_emit';
end;
$$;

revoke all on function public.cycle_report_lifecycle_status(uuid) from public;
grant execute on function public.cycle_report_lifecycle_status(uuid) to service_role;

create or replace function public.record_report_emission_failure(
  p_cycle_id uuid,
  p_cycle_processing_id uuid,
  p_action_plan_revision bigint,
  p_attempted_by uuid,
  p_error_code text,
  p_error_message text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if nullif(btrim(coalesce(p_error_code, '')), '') is null
     or nullif(btrim(coalesce(p_error_message, '')), '') is null then
    raise exception 'report_emission_failure_metadata_required' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.cycles c
    join public.cycle_processings cp
      on cp.id = p_cycle_processing_id and cp.cycle_id = c.id
    where c.id = p_cycle_id
      and c.state = 'completed'::public.cycle_state
      and cp.status = 'completed'::public.cycle_processing_status
      and c.action_plan_revision = p_action_plan_revision
  ) then
    raise exception 'report_emission_failure_context_invalid' using errcode = 'P0001';
  end if;

  insert into public.report_emission_failures (
    cycle_id,
    cycle_processing_id,
    action_plan_revision,
    attempted_by,
    error_code,
    error_message
  ) values (
    p_cycle_id,
    p_cycle_processing_id,
    p_action_plan_revision,
    p_attempted_by,
    left(btrim(p_error_code), 120),
    left(btrim(p_error_message), 2000)
  ) returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.record_report_emission_failure(uuid, uuid, bigint, uuid, text, text) from public;
grant execute on function public.record_report_emission_failure(uuid, uuid, bigint, uuid, text, text) to service_role;

create or replace function public.enforce_cycle_report_closure_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.state = 'validated'::public.cycle_state
     and new.state = 'completed'::public.cycle_state
     and (new.reference_start_year is null or new.reference_end_year is null) then
    raise exception 'close_requires_reference_period' using errcode = '23514';
  end if;

  if old.state = 'completed'::public.cycle_state
     and new.state = 'in_response'::public.cycle_state
     and not public.cycle_has_current_official_report(old.id) then
    raise exception 'reopen_requires_official_report' using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_cycle_report_closure_integrity() from public;

create trigger cycles_report_closure_integrity
before update of state on public.cycles
for each row execute function public.enforce_cycle_report_closure_integrity();

-- Ao finalizar uma emissão válida, qualquer falha anterior do mesmo snapshot
-- deixa de estar pendente, mas permanece no histórico de auditoria.
create or replace function public.finalize_report_emission(
  p_report_id uuid,
  p_file_sha256 text,
  p_content_sha256 text,
  p_file_size_bytes bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports%rowtype;
  v_cycle public.cycles%rowtype;
  v_processing public.cycle_processings%rowtype;
  v_storage_size bigint;
begin
  select * into v_report from public.reports where id = p_report_id for update;
  if not found then raise exception 'report_reservation_not_found' using errcode = 'P0002'; end if;
  if v_report.status <> 'preparing' then raise exception 'report_reservation_not_open' using errcode = 'P0001'; end if;

  select * into v_cycle from public.cycles where id = v_report.cycle_id for update;
  select * into v_processing from public.cycle_processings
  where id = v_report.cycle_processing_id and cycle_id = v_report.cycle_id for update;

  if v_cycle.state <> 'completed'::public.cycle_state then
    raise exception 'cycle_not_completed' using errcode = 'P0001';
  end if;
  if v_processing.status <> 'completed'::public.cycle_processing_status then
    raise exception 'cycle_processing_not_completed' using errcode = 'P0001';
  end if;
  if v_cycle.action_plan_revision <> v_report.action_plan_revision then
    raise exception 'report_action_plan_changed' using errcode = '40001';
  end if;
  if lower(coalesce(p_file_sha256, '')) !~ '^[0-9a-f]{64}$'
     or lower(coalesce(p_content_sha256, '')) !~ '^[0-9a-f]{64}$'
     or coalesce(p_file_size_bytes, 0) <= 0 then
    raise exception 'report_integrity_metadata_invalid' using errcode = '22023';
  end if;

  select coalesce(nullif(so.metadata ->> 'size', '')::bigint, 0)
  into v_storage_size
  from storage.objects so
  where so.bucket_id = 'relatorios'
    and so.name = v_report.file_path
    and lower(coalesce(so.metadata ->> 'mimetype', '')) = 'application/pdf'
  for key share;

  if not found or v_storage_size <> p_file_size_bytes then
    raise exception 'report_storage_object_invalid' using errcode = 'P0001';
  end if;

  perform set_config('app.report_mutation_mode', 'finalize', true);
  update public.reports
  set status = 'completed',
      file_sha256 = lower(p_file_sha256),
      content_sha256 = lower(p_content_sha256),
      file_size_bytes = p_file_size_bytes
  where id = p_report_id
  returning * into v_report;
  perform set_config('app.report_mutation_mode', '', true);

  update public.report_emission_failures
  set resolved_at = now(), resolved_report_id = v_report.id
  where cycle_id = v_report.cycle_id
    and cycle_processing_id = v_report.cycle_processing_id
    and action_plan_revision = v_report.action_plan_revision
    and resolved_at is null;

  return to_jsonb(v_report);
end;
$$;

revoke all on function public.finalize_report_emission(uuid, text, text, bigint) from public;
grant execute on function public.finalize_report_emission(uuid, text, text, bigint) to service_role;

-- A listagem administrativa inclui a referência institucional e o estado
-- derivado do relatório para que a UI não infira disponibilidade por `completed`.
drop function if exists public.list_report_options_page(uuid, uuid, uuid[], text, integer, integer);

create function public.list_report_options_page(
  p_organization_id uuid,
  p_cycle_id uuid default null,
  p_form_ids uuid[] default null,
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  cycle_id uuid,
  processing_id uuid,
  processing_version integer,
  policy_version text,
  cycle_state public.cycle_state,
  form_id uuid,
  form_name text,
  form_version integer,
  period_label text,
  reference_start_year integer,
  reference_end_year integer,
  processed_at timestamptz,
  emission_count bigint,
  latest_emission_version integer,
  report_status text,
  total_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with ranked as (
    select
      c.id as cycle_id,
      cp.id as processing_id,
      cp.processing_version,
      cp.fami_policy_version as policy_version,
      c.state as cycle_state,
      f.id as form_id,
      f.name as form_name,
      fv.version as form_version,
      c.period_label,
      c.reference_start_year,
      c.reference_end_year,
      cp.completed_at as processed_at,
      count(r.id)::bigint as emission_count,
      max(r.emission_version) as latest_emission_version,
      row_number() over (
        partition by c.id order by cp.processing_version desc, cp.id desc
      ) as processing_rank
    from public.cycle_processings cp
    join public.cycles c on c.id = cp.cycle_id
    join public.form_versions fv on fv.id = c.form_version_id
    join public.forms f on f.id = fv.form_id
    left join public.reports r
      on r.cycle_processing_id = cp.id and r.status in ('completed', 'legacy')
    where c.organization_id = p_organization_id
      and (p_cycle_id is null or c.id = p_cycle_id)
      and cp.status = 'completed'
      and (p_form_ids is null or f.id = any(p_form_ids))
      and (
        nullif(btrim(p_search), '') is null
        or lower(f.name) like '%' || lower(btrim(p_search)) || '%'
        or lower(c.period_label) like '%' || lower(btrim(p_search)) || '%'
      )
      and exists (
        select 1 from public.fami_results fr
        where fr.cycle_processing_id = cp.id and fr.scope_type = 'global'
      )
    group by c.id, cp.id, f.id, fv.id
  ), latest as (
    select * from ranked where processing_rank = 1
  )
  select
    l.cycle_id, l.processing_id, l.processing_version, l.policy_version,
    l.cycle_state, l.form_id, l.form_name, l.form_version, l.period_label,
    l.reference_start_year, l.reference_end_year,
    l.processed_at, l.emission_count, l.latest_emission_version,
    public.cycle_report_lifecycle_status(l.cycle_id),
    count(*) over()::bigint
  from latest l
  order by l.processed_at desc, l.cycle_id desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

revoke all on function public.list_report_options_page(uuid, uuid, uuid[], text, integer, integer) from public;
grant execute on function public.list_report_options_page(uuid, uuid, uuid[], text, integer, integer) to service_role;

-- A tela de ciclo recebe o período de referência sem uma segunda consulta.
drop function if exists public.list_cycles_page(text, uuid, uuid, public.cycle_state[], text, text, integer, integer);

create function public.list_cycles_page(
  p_search text default null,
  p_organization_id uuid default null,
  p_form_id uuid default null,
  p_states public.cycle_state[] default null,
  p_period_label text default null,
  p_due_filter text default 'all',
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  state public.cycle_state,
  period_label text,
  organization_id uuid,
  organization_name text,
  organization_acronym text,
  form_id uuid,
  form_name text,
  form_version_id uuid,
  form_version integer,
  reopen_count integer,
  starts_at timestamptz,
  response_deadline_at timestamptz,
  validation_deadline_at timestamptz,
  cycle_close_at timestamptz,
  submitted_late_at timestamptz,
  submission_delay_seconds bigint,
  closed_at timestamptz,
  reference_start_year integer,
  reference_end_year integer,
  working_processing_id uuid,
  working_processing_version integer,
  total_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    c.id,
    c.state,
    c.period_label,
    c.organization_id,
    o.name as organization_name,
    o.acronym as organization_acronym,
    fv.form_id,
    f.name as form_name,
    fv.id as form_version_id,
    fv.version as form_version,
    c.reopen_count,
    c.starts_at,
    c.response_deadline_at,
    c.validation_deadline_at,
    c.cycle_close_at,
    c.submitted_late_at,
    c.submission_delay_seconds,
    c.closed_at,
    c.reference_start_year,
    c.reference_end_year,
    wp.id as working_processing_id,
    wp.processing_version as working_processing_version,
    count(*) over() as total_count
  from public.cycles c
  join public.organizations o on o.id = c.organization_id
  join public.form_versions fv on fv.id = c.form_version_id
  join public.forms f on f.id = fv.form_id
  left join lateral (
    select cp.id, cp.processing_version
    from public.cycle_processings cp
    where cp.cycle_id = c.id and cp.status = 'working'
    order by cp.processing_version desc
    limit 1
  ) wp on true
  where (p_organization_id is null or c.organization_id = p_organization_id)
    and (p_form_id is null or fv.form_id = p_form_id)
    and (p_states is null or cardinality(p_states) = 0 or c.state = any(p_states))
    and (nullif(btrim(p_period_label), '') is null or c.period_label = btrim(p_period_label))
    and (
      coalesce(p_due_filter, 'all') = 'all'
      or (
        p_due_filter = 'overdue'
        and c.state in ('in_response', 'awaiting_adjustment')
        and c.response_deadline_at is not null
        and c.response_deadline_at < now()
      )
      or (
        p_due_filter = 'in_response'
        and c.state in ('in_response', 'awaiting_adjustment')
      )
    )
    and (
      nullif(btrim(p_search), '') is null
      or concat_ws(' ', f.name, o.name, o.acronym, c.period_label)
        ilike '%' || btrim(p_search) || '%'
    )
  order by c.period_label desc, c.created_at desc, c.id desc
  limit greatest(1, least(coalesce(p_limit, 25), 200))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_cycles_page(text, uuid, uuid, public.cycle_state[], text, text, integer, integer) from public;
grant execute on function public.list_cycles_page(text, uuid, uuid, public.cycle_state[], text, text, integer, integer) to service_role;

-- O encerramento não envia o respondente para uma lista de relatórios vazia.


-- Encerramento programado: período institucional ausente é condição de prontidão,
-- não falha técnica. A proteção transacional do trigger continua sendo a última
-- linha de defesa para qualquer outra forma de transição.
create or replace function public.execute_scheduled_cycle_action(
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_expected_schedule_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_from_state public.cycle_state;
begin
  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;

  if not found then
    return jsonb_build_object(
      'status', 'failed',
      'fromState', null,
      'toState', null,
      'message', 'Diagnóstico não encontrado.'
    );
  end if;

  if v_cycle.schedule_revision <> p_expected_schedule_revision then
    return jsonb_build_object(
      'status', 'skipped',
      'fromState', v_cycle.state,
      'toState', v_cycle.state,
      'message', format(
        'Programação obsoleta: revisão %s; revisão atual %s.',
        p_expected_schedule_revision,
        v_cycle.schedule_revision
      )
    );
  end if;

  v_from_state := v_cycle.state;

  if p_action = 'open_cycle' then
    if v_cycle.state <> 'draft'::public.cycle_state then
      return jsonb_build_object(
        'status', 'skipped', 'fromState', v_cycle.state, 'toState', v_cycle.state,
        'message', 'O diagnóstico já saiu do rascunho e não precisa de nova abertura.'
      );
    end if;

    perform public.commit_cycle_transition(
      p_cycle_id, p_actor_user_id, 'in_response'::public.cycle_state,
      null, null, 'draft'::public.cycle_state
    );

  elsif p_action = 'finalize_validation' then
    if v_cycle.state in ('validated'::public.cycle_state, 'completed'::public.cycle_state) then
      return jsonb_build_object(
        'status', 'skipped', 'fromState', v_cycle.state, 'toState', v_cycle.state,
        'message', 'A validação deste diagnóstico já foi concluída.'
      );
    end if;
    if v_cycle.state <> 'in_validation'::public.cycle_state then
      return jsonb_build_object(
        'status', 'skipped', 'fromState', v_cycle.state, 'toState', v_cycle.state,
        'message', 'O diagnóstico ainda não está pronto para concluir a validação.'
      );
    end if;

    perform public.finalize_validation_cycle(p_cycle_id, p_actor_user_id);

  elsif p_action = 'close_cycle' then
    if v_cycle.state = 'completed'::public.cycle_state then
      return jsonb_build_object(
        'status', 'skipped', 'fromState', v_cycle.state, 'toState', v_cycle.state,
        'message', 'A avaliação já estava encerrada.'
      );
    end if;
    if v_cycle.state <> 'validated'::public.cycle_state then
      return jsonb_build_object(
        'status', 'skipped', 'fromState', v_cycle.state, 'toState', v_cycle.state,
        'message', 'O ciclo precisa ter o diagnóstico validado antes do encerramento.'
      );
    end if;
    if v_cycle.reference_start_year is null or v_cycle.reference_end_year is null then
      return jsonb_build_object(
        'status', 'skipped', 'fromState', v_cycle.state, 'toState', v_cycle.state,
        'message', 'Defina o período de referência institucional antes do encerramento programado.'
      );
    end if;

    perform public.commit_cycle_transition(
      p_cycle_id, p_actor_user_id, 'completed'::public.cycle_state,
      null, null, 'validated'::public.cycle_state
    );
  else
    raise exception 'unknown_scheduled_cycle_action' using errcode = '22023';
  end if;

  select * into v_cycle from public.cycles where id = p_cycle_id;
  return jsonb_build_object(
    'status', 'succeeded',
    'fromState', v_from_state,
    'toState', v_cycle.state,
    'message', case p_action
      when 'open_cycle' then 'Diagnóstico aberto para resposta.'
      when 'finalize_validation' then 'Validação concluída e FAMI calculado.'
      else 'Ciclo de acompanhamento encerrado sem recalcular o FAMI.'
    end
  );
end;
$$;

create or replace function public.notify_cycle_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period text;
  v_path text;
  v_dedupe text;
  v_adjustment_count integer;
  v_proof_request_count integer;
  v_total_count integer;
  v_title text;
  v_message text;
begin
  if coalesce(current_setting('app.suppress_cycle_notifications', true), '') = 'on' then
    return new;
  end if;

  if new.state is not distinct from old.state then
    return new;
  end if;

  v_period := coalesce(nullif(btrim(new.period_label), ''), 'atual');

  -- Encerra o pedido administrativo de "iniciar validação" assim que o ciclo
  -- deixa submitted (tipicamente submitted → in_validation).
  if old.state = 'submitted'::public.cycle_state
     and new.state is distinct from 'submitted'::public.cycle_state then
    update public.user_notifications un
    set read_at = coalesce(un.read_at, now())
    where un.kind = 'validation_pending'
      and un.read_at is null
      and un.action_path = format('/admin/ciclos/%s', new.id);
  end if;

  if new.state = 'in_response'::public.cycle_state
     and old.state in ('draft'::public.cycle_state, 'completed'::public.cycle_state) then
    v_path := format('/respondente/ciclos/%s', new.id);
    v_dedupe := format('diagnostic-opened:%s:reopen:%s', new.id, new.reopen_count);
    perform public.notify_organization_respondents(
      new.organization_id,
      'diagnostic_opened',
      case when old.state = 'completed'::public.cycle_state
        then 'Diagnóstico reaberto para resposta'
        else 'Diagnóstico aberto para resposta'
      end,
      case when old.state = 'completed'::public.cycle_state
        then format('O diagnóstico %s foi reaberto e está disponível para atualização.', v_period)
        else format('O diagnóstico %s está disponível para preenchimento.', v_period)
      end,
      v_path,
      v_dedupe,
      jsonb_build_object(
        'cycle_id', new.id,
        'period_label', new.period_label,
        'from_state', old.state,
        'to_state', new.state
      )
    );
  end if;

  if new.state = 'in_validation'::public.cycle_state
     and old.state = 'submitted'::public.cycle_state then
    perform public.notify_organization_respondents(
      new.organization_id,
      'diagnostic_validation_started',
      'Validação iniciada',
      format(
        'A administração iniciou a validação do diagnóstico %s. As respostas e evidências permanecem disponíveis para consulta.',
        v_period
      ),
      format('/respondente/ciclos/%s', new.id),
      format('diagnostic-validation-started:%s:at:%s', new.id, new.updated_at),
      jsonb_build_object(
        'cycle_id', new.id,
        'period_label', new.period_label,
        'from_state', old.state,
        'to_state', new.state
      )
    );
  end if;

  if new.state = 'awaiting_adjustment'::public.cycle_state
     and old.state = 'in_validation'::public.cycle_state then
    select count(*)::integer into v_adjustment_count
    from public.evidences e
    join public.responses r on r.id = e.response_id
    where r.cycle_id = new.id
      and e.deactivated_at is null
      and e.validation_status = 'adjustment_requested'::public.evidence_validation_status;

    select count(*)::integer into v_proof_request_count
    from public.responses r
    where r.cycle_id = new.id
      and r.admin_proof_status = 'proof_requested'
      and coalesce(r.admin_applicability_status, '') <> 'not_applicable';

    v_total_count := coalesce(v_adjustment_count, 0) + coalesce(v_proof_request_count, 0);

    if v_total_count = 1 then
      if v_proof_request_count = 1 then
        v_title := 'Comprovação solicitada';
        v_message :=
          'A administração concluiu a análise e solicitou a comprovação de um critério. '
          || 'Consulte a orientação e envie a evidência antes de reenviar.';
      else
        v_title := 'Correção solicitada em uma evidência';
        v_message :=
          'A administração concluiu a análise e solicitou a correção de uma evidência. '
          || 'Consulte a orientação e envie a nova versão.';
      end if;
    elsif v_adjustment_count > 0 and v_proof_request_count = 0 then
      v_title := format('Correções solicitadas em %s evidências', v_total_count);
      v_message := format(
        'A administração concluiu a análise e solicitou correções em %s evidências. '
        || 'Resolva todas as pendências antes de reenviar.',
        v_total_count
      );
    elsif v_adjustment_count = 0 and v_proof_request_count > 0 then
      v_title := format('Comprovação solicitada em %s critérios', v_total_count);
      v_message := format(
        'A administração concluiu a análise e solicitou comprovação em %s critérios. '
        || 'Resolva todas as pendências antes de reenviar.',
        v_total_count
      );
    else
      v_title := format('Correções solicitadas em %s pendências', v_total_count);
      v_message := format(
        'A administração concluiu a análise e solicitou correções em %s pendências. '
        || 'Resolva todas as pendências antes de reenviar.',
        v_total_count
      );
    end if;

    perform public.notify_organization_respondents(
      new.organization_id,
      'evidence_adjustment',
      v_title,
      v_message,
      format('/respondente/ciclos/%s', new.id),
      format('evidence-adjustments-dispatched:%s:at:%s', new.id, new.updated_at),
      jsonb_build_object(
        'cycle_id', new.id,
        'organization_id', new.organization_id,
        'period_label', new.period_label,
        'adjustment_count', v_adjustment_count,
        'proof_request_count', v_proof_request_count,
        'total_count', v_total_count,
        'from_state', old.state,
        'to_state', new.state
      )
    );
  end if;

  if new.state = 'validated'::public.cycle_state
     and old.state = 'in_validation'::public.cycle_state then
    perform public.notify_organization_respondents(
      new.organization_id,
      'diagnostic_validated',
      'Validação concluída',
      format(
        'O diagnóstico %s foi validado. Consulte o resultado FAMI e as recomendações oficiais.',
        v_period
      ),
      format('/respondente/pontuacao-fami?cycleId=%s', new.id),
      format('diagnostic-validated:%s:at:%s', new.id, new.updated_at),
      jsonb_build_object(
        'cycle_id', new.id,
        'period_label', new.period_label,
        'from_state', old.state,
        'to_state', new.state
      )
    );
  end if;

  if new.state = 'completed'::public.cycle_state
     and old.state = 'validated'::public.cycle_state then
    perform public.notify_organization_respondents(
      new.organization_id,
      'diagnostic_completed',
      'Avaliação encerrada',
      format(
        'A avaliação do diagnóstico %s foi encerrada. A emissão do relatório oficial foi iniciada automaticamente; você será avisado quando o PDF estiver disponível.',
        v_period
      ),
      format('/respondente/ciclos/%s', new.id),
      format('diagnostic-completed:%s:at:%s', new.id, new.updated_at),
      jsonb_build_object(
        'cycle_id', new.id,
        'period_label', new.period_label,
        'from_state', old.state,
        'to_state', new.state
      )
    );
  end if;

  -- A primeira submissão ainda precisa da ação administrativa "Iniciar validação".
  if new.state = 'submitted'::public.cycle_state
     and old.state = 'in_response'::public.cycle_state then
    perform public.notify_administrators(
      'validation_pending',
      'Diagnóstico aguardando validação',
      format('O diagnóstico %s foi enviado pela organização e aguarda o início da validação.', v_period),
      format('/admin/ciclos/%s', new.id),
      format('validation-pending:%s:initial:at:%s', new.id, new.updated_at),
      jsonb_build_object(
        'cycle_id', new.id,
        'organization_id', new.organization_id,
        'period_label', new.period_label,
        'from_state', old.state,
        'to_state', new.state
      )
    );
  elsif new.state = 'in_validation'::public.cycle_state
        and old.state = 'awaiting_adjustment'::public.cycle_state then
    perform public.notify_administrators(
      'validation_resubmitted',
      'Correções reenviadas para validação',
      format('A organização reenviou as correções do diagnóstico %s.', v_period),
      format('/admin/ciclos/%s/validacao', new.id),
      format('validation-pending:%s:resubmission:at:%s', new.id, new.updated_at),
      jsonb_build_object(
        'cycle_id', new.id,
        'organization_id', new.organization_id,
        'period_label', new.period_label,
        'from_state', old.state,
        'to_state', new.state
      )
    );
  end if;

  return new;
end;
$$;

revoke all on function public.notify_cycle_lifecycle() from public;
