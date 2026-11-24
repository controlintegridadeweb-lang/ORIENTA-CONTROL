-- A confirmação devolve colunas com o mesmo nome das variáveis OUT.
-- No PL/pgSQL isso torna referências como id ambíguas (SQLSTATE 42702) e o
-- arquivo permanece no Storage sem virar comprovação.
-- (registro).coluna elimina o conflito sem mudar o contrato da função.

create or replace function public.commit_action_plan_document_upload(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid,
  p_pending_upload_id uuid,
  p_expected_revision bigint,
  p_verified_mime_type text
)
returns table(
  id uuid,
  action_plan_id uuid,
  action_revision bigint,
  kind text,
  title text,
  storage_path text,
  external_link text,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  file_validation_status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
#variable_conflict use_column
declare
  v_pending public.pending_action_plan_document_uploads%rowtype;
  v_plan public.action_plans%rowtype;
  v_cycle_state public.cycle_state;
  v_recommendation_id uuid;
  v_document public.action_plan_documents%rowtype;
begin
  if not exists (
    select 1
    from public.profiles profile
    where profile.user_id = p_actor_user_id
      and profile.role = 'respondent'::public.app_user_role
      and profile.organization_id = p_organization_id
  ) then
    raise exception 'action_plan_document_actor_not_authorized' using errcode = '42501';
  end if;

  -- A confirmação é idempotente: o UUID temporário também é o UUID definitivo.
  -- Se a transação anterior confirmou e apenas a resposta HTTP se perdeu, a
  -- repetição devolve o mesmo documento em vez de exigir novo upload.
  select document.*
    into v_document
  from public.action_plan_documents document
  join public.action_plans existing_plan on (existing_plan).id = (document).action_plan_id
  join public.recommendations existing_recommendation
    on (existing_recommendation).id = existing_plan.recommendation_id
  join public.cycles existing_cycle on (existing_cycle).id = existing_recommendation.cycle_id
  where (document).id = p_pending_upload_id
    and (document).action_plan_id = p_plan_id
    and (document).organization_id = p_organization_id
    and (document).uploaded_by = p_actor_user_id
    and (document).action_revision = p_expected_revision
    and (document).deactivated_at is null
    and (existing_cycle).organization_id = p_organization_id
    and app_private.is_current_official_recommendation((existing_recommendation).id)
  for share of document, existing_plan, existing_cycle;

  if found then
    return query select
      (v_document).id,
      (v_document).action_plan_id,
      (v_document).action_revision,
      (v_document).kind,
      (v_document).title,
      (v_document).storage_path,
      (v_document).external_link,
      (v_document).original_filename,
      (v_document).mime_type,
      (v_document).size_bytes,
      (v_document).file_validation_status,
      (v_document).created_at;
    return;
  end if;

  -- PostgreSQL não permite misturar %rowtype com escalares no mesmo INTO.
  select c.state, (r).id
    into v_cycle_state, v_recommendation_id
  from public.pending_action_plan_document_uploads pdu
  join public.action_plans ap on (ap).id = (pdu).action_plan_id
  join public.recommendations r on (r).id = ap.recommendation_id
  join public.cycles c on (c).id = r.cycle_id
  where (pdu).id = p_pending_upload_id
    and (pdu).action_plan_id = p_plan_id
    and (pdu).organization_id = p_organization_id
    and (pdu).uploaded_by = p_actor_user_id
    and (c).organization_id = p_organization_id
  for update of pdu, ap, c;

  if not found then
    raise exception 'pending_action_plan_document_not_found' using errcode = 'P0002';
  end if;

  select * into v_pending
  from public.pending_action_plan_document_uploads pending_row
  where (pending_row).id = p_pending_upload_id;

  select * into v_plan
  from public.action_plans plan_row
  where (plan_row).id = p_plan_id;
  if (v_pending).expires_at <= now() then
    raise exception 'pending_action_plan_document_expired' using errcode = 'P0002';
  end if;
  if v_cycle_state <> 'validated'::public.cycle_state then
    raise exception 'action_plan_document_cycle_not_editable' using errcode = 'P0001';
  end if;
  if not app_private.is_current_official_recommendation(v_recommendation_id) then
    raise exception 'action_plan_document_action_not_found' using errcode = 'P0002';
  end if;
  if (v_plan).status = 'cancelled'::public.action_plan_status then
    raise exception 'action_plan_document_action_cancelled' using errcode = '23514';
  end if;
  if p_expected_revision is null
     or p_expected_revision <> (v_plan).revision
     or p_expected_revision <> (v_pending).action_revision then
    raise exception 'action_plan_document_revision_conflict' using errcode = '40001';
  end if;
  if p_verified_mime_type is null or btrim(p_verified_mime_type) not in (
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp'
  ) then
    raise exception 'action_plan_document_verified_mime_required' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.action_plan_supervision_notes approval
    where (approval).action_plan_id = (v_plan).id
      and (approval).action_revision = (v_plan).revision
      and approval.note_type = 'approval'
      and approval.lifecycle_status = 'effective'
  ) then
    raise exception 'action_plan_document_approval_effective' using errcode = '23514';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  insert into public.action_plan_documents (
    id,
    action_plan_id,
    organization_id,
    action_revision,
    kind,
    title,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    file_validation_status,
    validated_at,
    uploaded_by
  ) values (
    (v_pending).id,
    (v_plan).id,
    p_organization_id,
    (v_plan).revision,
    'file',
    (v_pending).title,
    (v_pending).storage_path,
    (v_pending).original_filename,
    btrim(p_verified_mime_type),
    (v_pending).size_bytes,
    'valid',
    now(),
    p_actor_user_id
  )
  returning * into v_document;

  delete from public.pending_action_plan_document_uploads
  where pending_action_plan_document_uploads.id = (v_pending).id;

  return query select
    (v_document).id,
    (v_document).action_plan_id,
    (v_document).action_revision,
    (v_document).kind,
    (v_document).title,
    (v_document).storage_path,
    (v_document).external_link,
    (v_document).original_filename,
    (v_document).mime_type,
    (v_document).size_bytes,
    (v_document).file_validation_status,
    (v_document).created_at;
end;
$$;
