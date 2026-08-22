-- ORIENTA — solicitação formal de alteração do prazo de conclusão da ação.
-- Evolução pós-baseline: o prazo vigente só muda após decisão administrativa explícita.

create type public.action_plan_deadline_change_status as enum (
  'pending',
  'approved',
  'rejected'
);

create table public.action_plan_deadline_change_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  action_plan_id uuid not null references public.action_plans(id) on delete restrict,
  recommendation_id uuid not null references public.recommendations(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete restrict,
  action_revision bigint not null check (action_revision > 0),
  previous_due_date date not null,
  requested_due_date date not null,
  reason text not null check (char_length(btrim(reason)) between 10 and 4000),
  status public.action_plan_deadline_change_status not null default 'pending',
  requested_by uuid not null references public.profiles(user_id) on delete restrict,
  requested_at timestamptz not null default now(),
  decided_by uuid references public.profiles(user_id) on delete restrict,
  decided_at timestamptz,
  decision_reason text,
  applied_action_revision bigint check (applied_action_revision is null or applied_action_revision > 0),
  constraint action_plan_deadline_change_requests_dates_check
    check (requested_due_date <> previous_due_date),
  constraint action_plan_deadline_change_requests_decision_reason_check
    check (
      decision_reason is null
      or char_length(btrim(decision_reason)) between 5 and 4000
    ),
  constraint action_plan_deadline_change_requests_decision_state_check
    check (
      (
        status = 'pending'
        and decided_by is null
        and decided_at is null
        and decision_reason is null
        and applied_action_revision is null
      )
      or
      (
        status = 'approved'
        and decided_by is not null
        and decided_at is not null
        and decision_reason is not null
        and applied_action_revision is not null
      )
      or
      (
        status = 'rejected'
        and decided_by is not null
        and decided_at is not null
        and decision_reason is not null
        and applied_action_revision is null
      )
    )
);

create unique index action_plan_deadline_change_requests_pending_unique_idx
  on public.action_plan_deadline_change_requests(action_plan_id)
  where status = 'pending';

create index action_plan_deadline_change_requests_recommendation_idx
  on public.action_plan_deadline_change_requests(recommendation_id, requested_at desc);

create index action_plan_deadline_change_requests_organization_status_idx
  on public.action_plan_deadline_change_requests(organization_id, status, requested_at desc);

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
      and request.previous_due_date = old.due_date
      and request.requested_due_date = new.due_date
  ) then
    raise exception 'action_plan_due_date_change_request_mismatch' using errcode = '42501';
  end if;

  return new;
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
declare
  v_action public.action_plans%rowtype;
  v_recommendation_id uuid;
  v_cycle_state public.cycle_state;
  v_request public.action_plan_deadline_change_requests%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
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

  if p_plan_id is null or p_recommendation_id is null or p_requested_due_date is null then
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
  if p_requested_due_date = v_action.due_date then
    raise exception 'action_plan_deadline_change_same_date' using errcode = '22023';
  end if;
  if p_requested_due_date < v_action.start_date then
    raise exception 'action_plan_deadline_change_before_start' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.action_plan_deadline_change_requests request
    where request.action_plan_id = v_action.id
      and request.status = 'pending'::public.action_plan_deadline_change_status
  ) then
    raise exception 'action_plan_deadline_change_pending_exists' using errcode = '23505';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  insert into public.action_plan_deadline_change_requests (
    action_plan_id,
    recommendation_id,
    organization_id,
    action_revision,
    previous_due_date,
    requested_due_date,
    reason,
    requested_by
  ) values (
    v_action.id,
    v_recommendation_id,
    p_organization_id,
    v_action.revision,
    v_action.due_date,
    p_requested_due_date,
    v_reason,
    p_actor_user_id
  )
  returning * into v_request;

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
    'Uma organização solicitou alteração do prazo de conclusão de uma ação do plano.',
    '/admin/plano-acao/' || v_recommendation_id::text || '/monitoramento?action=' || v_action.id::text,
    'action-plan-deadline-request:' || v_request.id::text || ':admin:' || profile.user_id::text
  from public.profiles profile
  where profile.role = 'admin'::public.app_user_role
    and profile.organization_id is null
  on conflict do nothing;

  return v_request;
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

  if p_decision = 'approved'::public.action_plan_deadline_change_status then
    if v_cycle_state <> 'validated'::public.cycle_state then
      raise exception 'action_plan_deadline_change_cycle_not_editable' using errcode = '23514';
    end if;
    if v_action.status in ('done'::public.action_plan_status, 'cancelled'::public.action_plan_status) then
      raise exception 'action_plan_deadline_change_action_closed' using errcode = '23514';
    end if;
    if v_action.due_date <> v_request.previous_due_date then
      raise exception 'action_plan_deadline_change_stale_request' using errcode = '40001';
    end if;
    if v_request.requested_due_date < v_action.start_date then
      raise exception 'action_plan_deadline_change_before_start' using errcode = '22023';
    end if;

    perform set_config(
      'app.action_plan_deadline_change_request_id',
      v_request.id::text,
      true
    );

    update public.action_plans
    set due_date = v_request.requested_due_date
    where id = v_action.id
    returning revision into v_applied_revision;
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
        then 'Alteração de prazo aprovada'
      else 'Alteração de prazo não aprovada'
    end,
    case
      when p_decision = 'approved'::public.action_plan_deadline_change_status
        then 'O novo prazo solicitado para a ação foi aprovado pela supervisão.'
      else 'A solicitação de alteração de prazo da ação foi rejeitada pela supervisão.'
    end,
    '/respondente/plano-acao/' || v_request.recommendation_id::text || '/monitoramento?action=' || v_request.action_plan_id::text,
    'action-plan-deadline-request:' || v_request.id::text || ':respondent'
  )
  on conflict do nothing;

  return v_request;
end;
$$;

create trigger action_plans_guard_due_date_change
before update of due_date on public.action_plans
for each row execute function public.guard_action_plan_due_date_change();

create trigger audit_action_plan_deadline_change_requests
after insert or update or delete on public.action_plan_deadline_change_requests
for each row execute function public.audit_row_change();

alter table public.action_plan_deadline_change_requests enable row level security;

create policy action_plan_deadline_change_requests_read_scoped
  on public.action_plan_deadline_change_requests
  for select to authenticated
  using (
    app_private.is_admin()
    or organization_id = app_private.current_organization_id()
  );

revoke all on table public.action_plan_deadline_change_requests from anon, authenticated;
grant select on table public.action_plan_deadline_change_requests to authenticated, service_role;

revoke all on function public.guard_action_plan_due_date_change() from public, anon, authenticated;
grant execute on function public.guard_action_plan_due_date_change() to service_role;

revoke all on function public.request_action_plan_deadline_change(uuid, uuid, uuid, uuid, date, text, bigint)
  from public, anon, authenticated;
grant execute on function public.request_action_plan_deadline_change(uuid, uuid, uuid, uuid, date, text, bigint)
  to service_role;

revoke all on function public.decide_action_plan_deadline_change(
  uuid, uuid, public.action_plan_deadline_change_status, text
) from public, anon, authenticated;
grant execute on function public.decide_action_plan_deadline_change(
  uuid, uuid, public.action_plan_deadline_change_status, text
) to service_role;

comment on table public.action_plan_deadline_change_requests is
  'Solicitações formais de alteração do prazo de conclusão de ações. O prazo vigente só é alterado por decisão administrativa aprovada.';
comment on function public.request_action_plan_deadline_change(uuid, uuid, uuid, uuid, date, text, bigint) is
  'Registra solicitação de alteração de prazo pelo respondente sem modificar o prazo vigente da ação.';
comment on function public.decide_action_plan_deadline_change(uuid, uuid, public.action_plan_deadline_change_status, text) is
  'Aprova ou rejeita solicitação de alteração de prazo; somente a aprovação modifica action_plans.due_date.';
comment on function public.guard_action_plan_due_date_change() is
  'Impede alteração direta de action_plans.due_date fora de uma solicitação administrativa pendente aprovada pela RPC de decisão.';

notify pgrst, 'reload schema';
