-- deactivate_action_plan_document e discard_pending_action_plan_document_upload
-- devolvem a coluna OUT storage_path. No PL/pgSQL isso torna
-- ON CONFLICT (storage_path) ambíguo (SQLSTATE 42702) e a remoção
-- (ou o descarte de um upload) aborta antes de gravar.
-- #variable_conflict use_column e o nome da chave primária eliminam o conflito.

create or replace function public.discard_pending_action_plan_document_upload(
  p_pending_upload_id uuid,
  p_plan_id uuid,
  p_organization_id uuid,
  p_actor_user_id uuid
)
returns table(storage_path text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_storage_path text;
begin
  select pending.storage_path
    into v_storage_path
  from public.pending_action_plan_document_uploads pending
  where pending.id = p_pending_upload_id
    and pending.action_plan_id = p_plan_id
    and pending.organization_id = p_organization_id
    and pending.uploaded_by = p_actor_user_id
  for update;

  if not found then
    raise exception 'pending_action_plan_document_not_found' using errcode = 'P0002';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  delete from public.pending_action_plan_document_uploads
  where pending_action_plan_document_uploads.id = p_pending_upload_id;

  insert into public.action_plan_storage_cleanup_queue(storage_path)
  values (v_storage_path)
  on conflict on constraint action_plan_storage_cleanup_queue_pkey do update
    set scheduled_for = least(
          public.action_plan_storage_cleanup_queue.scheduled_for,
          excluded.scheduled_for
        ),
        last_error = null;

  return query select v_storage_path;
end;
$$;

create or replace function public.deactivate_action_plan_document(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid,
  p_document_id uuid,
  p_expected_revision bigint,
  p_reason text
)
returns table(storage_path text)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_cycle_state public.cycle_state;
  v_plan_revision bigint;
  v_document_revision bigint;
  v_storage_path text;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'respondent'::public.app_user_role
      and p.organization_id = p_organization_id
  ) then
    raise exception 'action_plan_document_actor_not_authorized' using errcode = '42501';
  end if;

  if p_reason is null
     or char_length(btrim(p_reason)) < 5
     or char_length(btrim(p_reason)) > 1000 then
    raise exception 'action_plan_document_invalid_deactivation_reason' using errcode = '22023';
  end if;

  select
    c.state,
    ap.revision,
    d.action_revision,
    d.storage_path
  into
    v_cycle_state,
    v_plan_revision,
    v_document_revision,
    v_storage_path
  from public.action_plan_documents d
  join public.action_plans ap on ap.id = d.action_plan_id
  join public.recommendations r on r.id = ap.recommendation_id
  join public.cycles c on c.id = r.cycle_id
  where d.id = p_document_id
    and d.action_plan_id = p_plan_id
    and d.deactivated_at is null
    and d.organization_id = p_organization_id
    and c.organization_id = p_organization_id
    and app_private.is_current_official_recommendation(r.id)
  for update of c, ap, d;

  if not found then
    raise exception 'action_plan_document_not_found' using errcode = 'P0002';
  end if;
  if v_cycle_state <> 'validated'::public.cycle_state then
    raise exception 'action_plan_document_cycle_not_editable' using errcode = 'P0001';
  end if;
  if p_expected_revision is null
     or p_expected_revision <> v_plan_revision
     or p_expected_revision <> v_document_revision then
    raise exception 'action_plan_document_revision_conflict' using errcode = '40001';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  update public.action_plan_documents
  set deactivated_at = now(),
      deactivated_by = p_actor_user_id,
      deactivation_reason = btrim(p_reason)
  where id = p_document_id;

  if v_storage_path is not null then
    insert into public.action_plan_storage_cleanup_queue(storage_path)
    values (v_storage_path)
    on conflict on constraint action_plan_storage_cleanup_queue_pkey do update
      set scheduled_for = least(
            public.action_plan_storage_cleanup_queue.scheduled_for,
            excluded.scheduled_for
          ),
          last_error = null;
  end if;

  return query select v_storage_path;
end;
$$;
