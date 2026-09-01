-- Comprovação da execução do plano de integridade e compliance é opcional.
-- O aceite administrativo e o encerramento do ciclo exigem ação concluída,
-- sem pendência aberta e com aceite vigente; o anexo permanece disponível,
-- sem bloquear o registro.

create or replace function public.enforce_action_plan_supervision_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_action public.action_plans%rowtype;
begin
  if new.author_role <> 'admin'::public.app_user_role then
    raise exception 'supervision_note_requires_admin_author' using errcode = '42501';
  end if;

  -- Ação e ciclo usam a mesma ordem de bloqueio das mutações do plano:
  -- primeiro a ação, depois o ciclo. Isso evita aceite obsoleto e deadlocks
  -- com edição ou encerramento concorrente.
  if new.action_plan_id is not null then
    select ap.* into v_action
    from public.action_plans ap
    where ap.id = new.action_plan_id
    for update;

    if not found then
      raise exception 'supervision_action_not_found' using errcode = 'P0002';
    end if;
    if v_action.recommendation_id <> new.recommendation_id then
      raise exception 'supervision_action_recommendation_mismatch' using errcode = '23514';
    end if;
  end if;

  perform public.lock_supervision_cycle(new.recommendation_id);

  if new.action_plan_id is null then
    if new.note_type in ('adjustment_request', 'approval', 'pending') then
      raise exception 'supervision_note_action_required' using errcode = '23514';
    end if;
    new.action_revision := null;
    new.action_snapshot := '{}'::jsonb;
    new.lifecycle_status := 'recorded'::public.supervision_note_lifecycle_status;
    return new;
  end if;

  if new.note_type in ('adjustment_request', 'approval', 'pending')
     and v_action.status = 'cancelled'::public.action_plan_status then
    raise exception 'supervision_cancelled_action_not_allowed' using errcode = '23514';
  end if;
  if new.note_type = 'approval' and v_action.status <> 'done'::public.action_plan_status then
    raise exception 'supervision_approval_requires_completed_action' using errcode = '23514';
  end if;
  if new.note_type = 'approval' and exists (
    select 1
    from public.action_plan_supervision_notes pending_note
    where pending_note.action_plan_id = v_action.id
      and pending_note.note_type in ('adjustment_request', 'pending')
      and pending_note.lifecycle_status in ('open', 'acknowledged')
  ) then
    raise exception 'supervision_approval_has_open_request' using errcode = '23514';
  end if;

  new.action_revision := v_action.revision;
  new.action_snapshot := jsonb_build_object(
    'id', v_action.id,
    'revision', v_action.revision,
    'actionText', v_action.action_text,
    'dueDate', v_action.due_date,
    'responsibleUserId', v_action.responsible_user_id,
    'responsibleLabel', v_action.responsible_label,
    'status', v_action.status,
    'completedAt', v_action.completed_at,
    'executionNotes', v_action.execution_notes,
    'updatedAt', v_action.updated_at
  );

  if new.note_type in ('adjustment_request', 'pending') then
    new.lifecycle_status := 'open'::public.supervision_note_lifecycle_status;
    update public.action_plan_supervision_notes
    set lifecycle_status = 'superseded'::public.supervision_note_lifecycle_status
    where action_plan_id = v_action.id
      and note_type = 'approval'
      and lifecycle_status = 'effective'::public.supervision_note_lifecycle_status;
  elsif new.note_type = 'approval' then
    new.lifecycle_status := 'effective'::public.supervision_note_lifecycle_status;
    update public.action_plan_supervision_notes
    set lifecycle_status = 'superseded'::public.supervision_note_lifecycle_status
    where action_plan_id = v_action.id
      and note_type = 'approval'
      and lifecycle_status = 'effective'::public.supervision_note_lifecycle_status;
  else
    new.lifecycle_status := 'recorded'::public.supervision_note_lifecycle_status;
  end if;

  return new;
end;
$$;

create or replace function public.cycle_action_plan_supervision_blockers(p_cycle_id uuid)
returns table (
  recommendation_id uuid,
  action_plan_id uuid,
  blocker text
)
language sql
security definer
set search_path = public
stable
as $$
  with latest_processing as (
    select cp.id
    from public.cycle_processings cp
    where cp.cycle_id = p_cycle_id
      and cp.status = 'completed'::public.cycle_processing_status
    order by cp.processing_version desc
    limit 1
  ), applicable_recommendations as (
    select r.id
    from public.recommendations r
    join public.cycles c on c.id = r.cycle_id
    join public.question_versions qv on qv.id = r.question_version_id
    where r.cycle_id = p_cycle_id
      and r.cycle_processing_id = (select id from latest_processing)
      and not exists (
        select 1 from public.processing_waiver_snapshots pws
        where pws.cycle_processing_id = r.cycle_processing_id
          and pws.question_id = qv.question_id
      )
      and not exists (
        select 1 from public.recommendation_exceptions ex
        where ex.recommendation_id = r.id
          and ex.status = 'approved'
      )
  ), active_actions as (
    select ap.*
    from public.action_plans ap
    join applicable_recommendations ar on ar.id = ap.recommendation_id
    where ap.status <> 'cancelled'::public.action_plan_status
  )
  select ar.id, null::uuid, 'exception_pending'::text
  from applicable_recommendations ar
  where exists (
    select 1 from public.recommendation_exceptions ex
    where ex.recommendation_id = ar.id
      and ex.status = 'requested'
      and (ex.prazo is null or ex.prazo >= current_date)
  )
  union all
  select ar.id, null::uuid, 'missing_active_action'::text
  from applicable_recommendations ar
  where not exists (
    select 1 from public.recommendation_exceptions ex
    where ex.recommendation_id = ar.id
      and ex.status = 'requested'
      and (ex.prazo is null or ex.prazo >= current_date)
  )
    and not exists (
      select 1 from active_actions ap where ap.recommendation_id = ar.id
    )
  union all
  select ap.recommendation_id, ap.id, 'action_not_completed'::text
  from active_actions ap
  where ap.status <> 'done'::public.action_plan_status
  union all
  select ap.recommendation_id, ap.id, 'open_supervision_request'::text
  from active_actions ap
  where exists (
    select 1 from public.action_plan_supervision_notes n
    where n.action_plan_id = ap.id
      and n.note_type in ('adjustment_request', 'pending')
      and n.lifecycle_status in ('open', 'acknowledged')
  )
  union all
  select ap.recommendation_id, ap.id, 'action_not_approved'::text
  from active_actions ap
  where ap.status = 'done'::public.action_plan_status
    and not exists (
      select 1 from public.action_plan_supervision_notes pending_note
      where pending_note.action_plan_id = ap.id
        and pending_note.note_type in ('adjustment_request', 'pending')
        and pending_note.lifecycle_status in ('open', 'acknowledged')
    )
    and not exists (
      select 1 from public.action_plan_supervision_notes n
      where n.action_plan_id = ap.id
        and n.note_type = 'approval'
        and n.lifecycle_status = 'effective'::public.supervision_note_lifecycle_status
        and n.action_revision = ap.revision
    );
$$;

comment on function public.enforce_action_plan_supervision_note() is
  'Valida o parecer de supervisão. O aceite exige ação concluída e sem pendência aberta; comprovação da execução é opcional.';

comment on function public.cycle_action_plan_supervision_blockers(uuid) is
  'Bloqueios de encerramento do ciclo no plano de integridade e compliance. Comprovação da execução não é pré-requisito.';

notify pgrst, 'reload schema';
