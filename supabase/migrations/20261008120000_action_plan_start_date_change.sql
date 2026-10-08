-- ORIENTA — solicitação formal de alteração do prazo inicial da ação.
-- O início vigente passa a mudar somente após decisão administrativa, no mesmo
-- modelo já usado para o prazo de conclusão.

create type public.action_plan_deadline_change_target as enum (
  'due_date',
  'start_date'
);

alter table public.action_plan_deadline_change_requests
  add column change_target public.action_plan_deadline_change_target not null default 'due_date',
  add column previous_start_date date,
  add column requested_start_date date;

alter table public.action_plan_deadline_change_requests
  alter column previous_due_date drop not null,
  alter column requested_due_date drop not null;

alter table public.action_plan_deadline_change_requests
  drop constraint action_plan_deadline_change_requests_dates_check;

alter table public.action_plan_deadline_change_requests
  add constraint action_plan_deadline_change_requests_dates_check
  check (
    (
      change_target = 'due_date'::public.action_plan_deadline_change_target
      and previous_due_date is not null
      and requested_due_date is not null
      and requested_due_date <> previous_due_date
      and previous_start_date is null
      and requested_start_date is null
    )
    or
    (
      change_target = 'start_date'::public.action_plan_deadline_change_target
      and previous_start_date is not null
      and requested_start_date is not null
      and requested_start_date <> previous_start_date
      and previous_due_date is null
      and requested_due_date is null
    )
  );

drop index public.action_plan_deadline_change_requests_pending_unique_idx;

create unique index action_plan_deadline_change_requests_pending_unique_idx
  on public.action_plan_deadline_change_requests(action_plan_id, change_target)
  where status = 'pending';

create or replace function public.guard_action_plan_due_date_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request_id uuid;
  v_request_token text;
begin
  if new.due_date is not distinct from old.due_date then
    return new;
  end if;

  v_request_token := nullif(current_setting('app.action_plan_deadline_change_request_id', true), '');
  if v_request_token is null then
    raise exception 'action_plan_due_date_change_requires_approval' using errcode = '42501';
  end if;

  begin
    v_request_id := v_request_token::uuid;
  exception
    when invalid_text_representation then
      raise exception 'action_plan_due_date_change_requires_approval' using errcode = '42501';
  end;

  if not exists (
    select 1
    from public.action_plan_deadline_change_requests request
    where request.id = v_request_id
      and request.action_plan_id = old.id
      and request.status = 'pending'::public.action_plan_deadline_change_status
      and request.change_target = 'due_date'::public.action_plan_deadline_change_target
      and request.previous_due_date = old.due_date
      and request.requested_due_date = new.due_date
  ) then
    raise exception 'action_plan_due_date_change_request_mismatch' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.guard_action_plan_start_date_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request_id uuid;
  v_request_token text;
begin
  if new.start_date is not distinct from old.start_date then
    return new;
  end if;

  v_request_token := nullif(current_setting('app.action_plan_deadline_change_request_id', true), '');
  if v_request_token is null then
    raise exception 'action_plan_start_date_change_requires_approval' using errcode = '42501';
  end if;

  begin
    v_request_id := v_request_token::uuid;
  exception
    when invalid_text_representation then
      raise exception 'action_plan_start_date_change_requires_approval' using errcode = '42501';
  end;

  if not exists (
    select 1
    from public.action_plan_deadline_change_requests request
    where request.id = v_request_id
      and request.action_plan_id = old.id
      and request.status = 'pending'::public.action_plan_deadline_change_status
      and request.change_target = 'start_date'::public.action_plan_deadline_change_target
      and request.previous_start_date = old.start_date
      and request.requested_start_date = new.start_date
  ) then
    raise exception 'action_plan_start_date_change_request_mismatch' using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.request_action_plan_date_change(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid,
  p_recommendation_id uuid,
  p_change_target public.action_plan_deadline_change_target,
  p_requested_date date,
  p_reason text,
  p_expected_revision bigint
)
returns public.action_plan_deadline_change_requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_action public.action_plans%rowtype;
  v_recommendation_id uuid;
  v_cycle_state public.cycle_state;
  v_request public.action_plan_deadline_change_requests%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_subject text;
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.user_id = p_actor_user_id
      and profile.role = 'respondent'::public.app_user_role
      and profile.organization_id = p_organization_id
  ) then
    raise exception 'action_plan_deadline_change_actor_not_authorized' using errcode = '42501';
  end if;

  if p_plan_id is null
     or p_recommendation_id is null
     or p_requested_date is null
     or p_change_target is null then
    raise exception 'action_plan_deadline_change_invalid_request' using errcode = '22023';
  end if;
  if v_reason is null or char_length(v_reason) < 10 or char_length(v_reason) > 4000 then
    raise exception 'action_plan_deadline_change_reason_required' using errcode = '22023';
  end if;

  select c.state
    into v_cycle_state
  from public.action_plans ap
  join public.recommendations r on r.id = ap.recommendation_id
  join public.cycles c on c.id = r.cycle_id
  where ap.id = p_plan_id
    and ap.recommendation_id = p_recommendation_id
    and c.organization_id = p_organization_id
    and app_private.is_current_official_recommendation(r.id)
  for update of c;

  if not found then
    raise exception 'action_plan_deadline_change_action_not_found' using errcode = 'P0002';
  end if;

  select * into v_action
  from public.action_plans ap
  where ap.id = p_plan_id
  for update;

  v_recommendation_id := p_recommendation_id;
  if v_cycle_state <> 'validated'::public.cycle_state then
    raise exception 'action_plan_deadline_change_cycle_not_editable' using errcode = '23514';
  end if;
  if v_action.status in ('done'::public.action_plan_status, 'cancelled'::public.action_plan_status) then
    raise exception 'action_plan_deadline_change_action_closed' using errcode = '23514';
  end if;
  if p_expected_revision is null or p_expected_revision <> v_action.revision then
    raise exception 'action_plan_deadline_change_revision_conflict' using errcode = '40001';
  end if;

  if p_change_target = 'due_date'::public.action_plan_deadline_change_target then
    if p_requested_date = v_action.due_date then
      raise exception 'action_plan_deadline_change_same_date' using errcode = '22023';
    end if;
    if p_requested_date < v_action.start_date then
      raise exception 'action_plan_deadline_change_before_start' using errcode = '22023';
    end if;
  else
    if p_requested_date = v_action.start_date then
      raise exception 'action_plan_start_date_change_same_date' using errcode = '22023';
    end if;
    if p_requested_date > v_action.due_date then
      raise exception 'action_plan_start_date_change_after_due' using errcode = '22023';
    end if;
  end if;

  if exists (
    select 1
    from public.action_plan_deadline_change_requests request
    where request.action_plan_id = v_action.id
      and request.change_target = p_change_target
      and request.status = 'pending'::public.action_plan_deadline_change_status
  ) then
    if p_change_target = 'start_date'::public.action_plan_deadline_change_target then
      raise exception 'action_plan_start_date_change_pending_exists' using errcode = '23505';
    end if;
    raise exception 'action_plan_deadline_change_pending_exists' using errcode = '23505';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  insert into public.action_plan_deadline_change_requests (
    action_plan_id,
    recommendation_id,
    organization_id,
    action_revision,
    change_target,
    previous_due_date,
    requested_due_date,
    previous_start_date,
    requested_start_date,
    reason,
    requested_by
  ) values (
    v_action.id,
    v_recommendation_id,
    p_organization_id,
    v_action.revision,
    p_change_target,
    case
      when p_change_target = 'due_date'::public.action_plan_deadline_change_target
        then v_action.due_date
      else null
    end,
    case
      when p_change_target = 'due_date'::public.action_plan_deadline_change_target
        then p_requested_date
      else null
    end,
    case
      when p_change_target = 'start_date'::public.action_plan_deadline_change_target
        then v_action.start_date
      else null
    end,
    case
      when p_change_target = 'start_date'::public.action_plan_deadline_change_target
        then p_requested_date
      else null
    end,
    v_reason,
    p_actor_user_id
  )
  returning * into v_request;

  v_subject := case
    when p_change_target = 'start_date'::public.action_plan_deadline_change_target
      then 'início'
    else 'conclusão'
  end;

  insert into public.user_notifications (
    user_id,
    kind,
    title,
    message,
    action_path,
    dedupe_key
  )
  select
    profile.user_id,
    'action_plan_deadline_change_requested',
    'Alteração de prazo solicitada',
    'Uma organização solicitou alteração do prazo de ' || v_subject || ' de uma ação do plano.',
    '/admin/plano-acao/' || v_recommendation_id::text || '/monitoramento?action=' || v_action.id::text,
    'action-plan-deadline-request:' || v_request.id::text || ':admin:' || profile.user_id::text
  from public.profiles profile
  where profile.role = 'admin'::public.app_user_role
    and profile.organization_id is null
  on conflict do nothing;

  return v_request;
end;
$$;

create or replace function public.request_action_plan_deadline_change(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid,
  p_recommendation_id uuid,
  p_requested_due_date date,
  p_reason text,
  p_expected_revision bigint
)
returns public.action_plan_deadline_change_requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return public.request_action_plan_date_change(
    p_actor_user_id,
    p_organization_id,
    p_plan_id,
    p_recommendation_id,
    'due_date'::public.action_plan_deadline_change_target,
    p_requested_due_date,
    p_reason,
    p_expected_revision
  );
end;
$$;

create or replace function public.request_action_plan_start_date_change(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid,
  p_recommendation_id uuid,
  p_requested_start_date date,
  p_reason text,
  p_expected_revision bigint
)
returns public.action_plan_deadline_change_requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return public.request_action_plan_date_change(
    p_actor_user_id,
    p_organization_id,
    p_plan_id,
    p_recommendation_id,
    'start_date'::public.action_plan_deadline_change_target,
    p_requested_start_date,
    p_reason,
    p_expected_revision
  );
end;
$$;

create or replace function public.decide_action_plan_deadline_change(
  p_actor_user_id uuid,
  p_request_id uuid,
  p_decision public.action_plan_deadline_change_status,
  p_decision_reason text
)
returns public.action_plan_deadline_change_requests
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_request public.action_plan_deadline_change_requests%rowtype;
  v_action public.action_plans%rowtype;
  v_cycle_state public.cycle_state;
  v_reason text := nullif(btrim(coalesce(p_decision_reason, '')), '');
  v_applied_revision bigint;
  v_is_start boolean;
  v_subject text;
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.user_id = p_actor_user_id
      and profile.role = 'admin'::public.app_user_role
      and profile.organization_id is null
  ) then
    raise exception 'action_plan_deadline_change_admin_required' using errcode = '42501';
  end if;
  if p_request_id is null or p_decision not in (
    'approved'::public.action_plan_deadline_change_status,
    'rejected'::public.action_plan_deadline_change_status
  ) then
    raise exception 'action_plan_deadline_change_invalid_decision' using errcode = '22023';
  end if;
  if v_reason is null or char_length(v_reason) < 5 or char_length(v_reason) > 4000 then
    raise exception 'action_plan_deadline_change_decision_reason_required' using errcode = '22023';
  end if;

  select * into v_request
  from public.action_plan_deadline_change_requests request
  where request.id = p_request_id
  for update;

  if not found then
    raise exception 'action_plan_deadline_change_request_not_found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'pending'::public.action_plan_deadline_change_status then
    raise exception 'action_plan_deadline_change_already_decided' using errcode = '23514';
  end if;

  select c.state
    into v_cycle_state
  from public.action_plans ap
  join public.recommendations recommendation on recommendation.id = ap.recommendation_id
  join public.cycles c on c.id = recommendation.cycle_id
  where ap.id = v_request.action_plan_id
    and ap.recommendation_id = v_request.recommendation_id
    and c.organization_id = v_request.organization_id
  for update of c;

  if not found then
    raise exception 'action_plan_deadline_change_action_not_found' using errcode = 'P0002';
  end if;

  select * into v_action
  from public.action_plans ap
  where ap.id = v_request.action_plan_id
  for update;

  perform public.set_audit_actor(p_actor_user_id);

  v_is_start := v_request.change_target = 'start_date'::public.action_plan_deadline_change_target;

  if p_decision = 'approved'::public.action_plan_deadline_change_status then
    if v_cycle_state <> 'validated'::public.cycle_state then
      raise exception 'action_plan_deadline_change_cycle_not_editable' using errcode = '23514';
    end if;
    if v_action.status in ('done'::public.action_plan_status, 'cancelled'::public.action_plan_status) then
      raise exception 'action_plan_deadline_change_action_closed' using errcode = '23514';
    end if;

    perform set_config(
      'app.action_plan_deadline_change_request_id',
      v_request.id::text,
      true
    );

    if v_is_start then
      if v_action.start_date is distinct from v_request.previous_start_date then
        raise exception 'action_plan_start_date_change_stale_request' using errcode = '40001';
      end if;
      if v_request.requested_start_date > v_action.due_date then
        raise exception 'action_plan_start_date_change_after_due' using errcode = '22023';
      end if;

      update public.action_plans
      set start_date = v_request.requested_start_date
      where id = v_action.id
      returning revision into v_applied_revision;
    else
      if v_action.due_date is distinct from v_request.previous_due_date then
        raise exception 'action_plan_deadline_change_stale_request' using errcode = '40001';
      end if;
      if v_request.requested_due_date < v_action.start_date then
        raise exception 'action_plan_deadline_change_before_start' using errcode = '22023';
      end if;

      update public.action_plans
      set due_date = v_request.requested_due_date
      where id = v_action.id
      returning revision into v_applied_revision;
    end if;
  end if;

  update public.action_plan_deadline_change_requests
  set status = p_decision,
      decided_by = p_actor_user_id,
      decided_at = now(),
      decision_reason = v_reason,
      applied_action_revision = case
        when p_decision = 'approved'::public.action_plan_deadline_change_status
          then v_applied_revision
        else null
      end
  where id = v_request.id
  returning * into v_request;

  v_subject := case when v_is_start then 'início' else 'prazo' end;

  insert into public.user_notifications (
    user_id,
    kind,
    title,
    message,
    action_path,
    dedupe_key
  ) values (
    v_request.requested_by,
    case
      when p_decision = 'approved'::public.action_plan_deadline_change_status
        then 'action_plan_deadline_change_approved'
      else 'action_plan_deadline_change_rejected'
    end,
    case
      when p_decision = 'approved'::public.action_plan_deadline_change_status
        then 'Alteração de ' || v_subject || ' aprovada'
      else 'Alteração de ' || v_subject || ' não aprovada'
    end,
    case
      when p_decision = 'approved'::public.action_plan_deadline_change_status
        then 'O novo ' || v_subject || ' solicitado para a ação foi aprovado pela supervisão.'
      else 'A solicitação de alteração de ' || v_subject || ' da ação foi rejeitada pela supervisão.'
    end,
    '/respondente/plano-acao/' || v_request.recommendation_id::text || '/monitoramento?action=' || v_request.action_plan_id::text,
    'action-plan-deadline-request:' || v_request.id::text || ':respondent'
  )
  on conflict do nothing;

  return v_request;
end;
$$;

create trigger action_plans_guard_start_date_change
before update of start_date on public.action_plans
for each row execute function public.guard_action_plan_start_date_change();

revoke all on function public.guard_action_plan_start_date_change() from public, anon, authenticated;
grant execute on function public.guard_action_plan_start_date_change() to service_role;

revoke all on function public.request_action_plan_date_change(
  uuid, uuid, uuid, uuid, public.action_plan_deadline_change_target, date, text, bigint
) from public, anon, authenticated;
grant execute on function public.request_action_plan_date_change(
  uuid, uuid, uuid, uuid, public.action_plan_deadline_change_target, date, text, bigint
) to service_role;

revoke all on function public.request_action_plan_start_date_change(uuid, uuid, uuid, uuid, date, text, bigint)
  from public, anon, authenticated;
grant execute on function public.request_action_plan_start_date_change(uuid, uuid, uuid, uuid, date, text, bigint)
  to service_role;

comment on type public.action_plan_deadline_change_target is
  'Alvo da solicitação formal de prazo da ação: conclusão (due_date) ou início (start_date).';
comment on function public.request_action_plan_start_date_change(uuid, uuid, uuid, uuid, date, text, bigint) is
  'Registra solicitação de alteração do início pelo respondente sem modificar o início vigente da ação.';
comment on function public.request_action_plan_date_change(
  uuid, uuid, uuid, uuid, public.action_plan_deadline_change_target, date, text, bigint
) is
  'Registra solicitação formal de alteração do início ou do final, sem modificar a data vigente.';
comment on function public.guard_action_plan_start_date_change() is
  'Impede alteração direta de action_plans.start_date fora de uma solicitação administrativa pendente aprovada pela RPC de decisão.';
comment on function public.decide_action_plan_deadline_change(uuid, uuid, public.action_plan_deadline_change_status, text) is
  'Aprova ou rejeita solicitação de alteração de início ou final; somente a aprovação modifica a data correspondente.';

notify pgrst, 'reload schema';
