-- ORIENTA greenfield baseline — Funções e RPCs finais; versões substituídas foram eliminadas
-- Gerada a partir do estado final pré-cutover; não contém dados históricos reais.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.block_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'tabela imutável: operação % não permitida', tg_op
    using errcode = 'check_violation';
end;
$$;

create or replace function public.set_audit_actor(p_actor uuid)
returns void
language sql
set search_path = public
as $$
  select set_config('app.actor_user_id', coalesce(p_actor::text, ''), true);
$$;

create or replace function public.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
begin
  v_actor := nullif(current_setting('app.actor_user_id', true), '')::uuid;
  if v_actor is null then
    v_actor := auth.uid();
  end if;

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  )
  values (
    v_actor,
    tg_op,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op = 'INSERT' then null else to_jsonb(old) end,
    case when tg_op = 'DELETE' then null else to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.bootstrap_global_admin(
  p_user_id uuid,
  p_full_name text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_admin uuid;
begin
  select user_id into v_existing_admin
  from public.profiles
  where role = 'admin'
  limit 1;

  if v_existing_admin is not null and v_existing_admin <> p_user_id then
    raise exception 'single_global_admin_required'
      using errcode = 'P0001',
            hint = 'Já existe um administrador global para a plataforma.';
  end if;

  perform set_config('app.profile_identity_override', 'bootstrap_global_admin', true);

  insert into public.profiles (user_id, role, organization_id, full_name)
  values (p_user_id, 'admin', null, p_full_name)
  on conflict (user_id) do update
    set role = 'admin',
        organization_id = null,
        full_name = coalesce(excluded.full_name, public.profiles.full_name);
end;
$$;

create or replace function public.update_respondent_profile(
  p_target_user_id uuid,
  p_full_name text,
  p_organization_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.profiles%rowtype;
  v_after public.profiles%rowtype;
begin
  if not exists (
    select 1
    from public.profiles
    where user_id = p_actor_user_id
      and role = 'admin'
      and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  select * into v_before
  from public.profiles
  where user_id = p_target_user_id
    and role = 'respondent'
  for update;

  if not found then
    raise exception 'respondent_profile_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.organizations where id = p_organization_id
  ) then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  perform public.set_audit_actor(p_actor_user_id);
  perform set_config('app.profile_identity_override', 'update_respondent_profile', true);

  update public.profiles
  set full_name = nullif(btrim(p_full_name), ''),
      organization_id = p_organization_id
  where user_id = p_target_user_id
  returning * into v_after;

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id, 'user.respondent_updated', 'profiles', p_target_user_id,
    to_jsonb(v_before), to_jsonb(v_after)
  );
end;
$$;

create or replace function public.guard_single_global_admin_profile()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if tg_op = 'DELETE' and old.role = 'admin' then
    raise exception 'cannot_remove_global_admin' using errcode = 'P0001';
  end if;

  if tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin' then
    raise exception 'cannot_demote_global_admin' using errcode = 'P0001';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.create_organization_admin(
  p_name text,
  p_acronym text,
  p_actor_user_id uuid
)
returns public.organizations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org public.organizations%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = p_actor_user_id and role = 'admin' and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  insert into public.organizations (name, acronym)
  values (btrim(p_name), upper(btrim(p_acronym)))
  returning * into v_org;

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id, 'organization.created', 'organizations', v_org.id, null, to_jsonb(v_org)
  );

  return v_org;
end;
$$;

create or replace function public.create_respondent_profile(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_organization_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = p_actor_user_id and role = 'admin' and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  perform set_config('app.profile_identity_override', 'create_respondent_profile', true);
  insert into public.profiles (user_id, role, organization_id, full_name)
  values (p_user_id, 'respondent', p_organization_id, nullif(btrim(p_full_name), ''))
  returning * into v_profile;

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id, 'user.respondent_created', 'profiles', p_user_id, null,
    to_jsonb(v_profile) || jsonb_build_object('email', lower(btrim(p_email)))
  );
end;
$$;

create or replace function public.prevent_published_form_rename()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.current_form_version_id is not null and new.name is distinct from old.name then
    raise exception 'published_form_name_is_immutable'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_published_form_has_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.state = 'published'::public.form_version_state then
    -- Mesma trava usada pela remoção da última atribuição. Assim, inclusive
    -- uma inserção direta (fora da RPC canônica) não atravessa a checagem em
    -- paralelo com a exclusão do destino.
    perform 1
    from public.forms f
    where f.id = new.form_id
    for update;

    perform fa.id
    from public.form_assignments fa
    where fa.form_id = new.form_id
    order by fa.id
    limit 1;

    if not found then
      raise exception 'form_publish_requires_assignment'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.prevent_last_published_assignment_removal()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_state public.form_version_state;
begin
  select fv.state into v_current_state
  from public.forms f
  left join public.form_versions fv on fv.id = f.current_form_version_id
  where f.id = old.form_id
  for update of f;

  if v_current_state = 'published'::public.form_version_state
     and not exists (
       select 1
       from public.form_assignments fa
       where fa.form_id = old.form_id
         and fa.id <> old.id
     ) then
    raise exception 'form_published_requires_assignment'
      using errcode = '23514';
  end if;
  return old;
end;
$$;

create or replace function public.prevent_form_assignment_delete_with_cycles()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.cycles c
    join public.form_versions fv on fv.id = c.form_version_id
    where fv.form_id = old.form_id
      and c.organization_id = old.organization_id
  ) then
    raise exception 'form_assignment_has_cycles'
      using errcode = 'foreign_key_violation';
  end if;
  return old;
end;
$$;

create or replace function public.responses_sync_na_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.answer = 'not_applicable'::public.answer_value then
    if new.na_justification is null or btrim(new.na_justification) = '' then
      new.na_justification := nullif(btrim(coalesce(new.notes, '')), '');
    end if;

    if new.na_justification is null or char_length(btrim(new.na_justification)) < 20 then
      raise exception 'na_justification_required'
        using errcode = '22023';
    end if;

    new.notes := new.na_justification;

    if new.na_validation_status not in (
         'pending'::public.na_validation_status,
         'approved'::public.na_validation_status
       )
       or (
         tg_op = 'UPDATE'
         and old.answer is distinct from 'not_applicable'::public.answer_value
         and new.na_validation_status <> 'approved'::public.na_validation_status
       )
       or (
         tg_op = 'UPDATE'
         and old.na_justification is distinct from new.na_justification
         and new.na_validation_status is not distinct from old.na_validation_status
       ) then
      new.na_validation_status := 'pending'::public.na_validation_status;
      new.na_validated_at := null;
      new.na_validated_by := null;
      new.na_rejection_reason := null;
    end if;
  elsif new.na_validation_status = 'rejected'::public.na_validation_status then
    if new.answer <> 'no'::public.answer_value then
      raise exception 'invalid_rejected_na_answer'
        using errcode = '23514';
    end if;

    if new.na_justification is null
       or char_length(btrim(new.na_justification)) < 20 then
      raise exception 'na_justification_required'
        using errcode = '22023';
    end if;

    if new.na_rejection_reason is null
       or btrim(new.na_rejection_reason) = '' then
      raise exception 'na_rejection_reason_required'
        using errcode = '22023';
    end if;
  else
    new.na_justification := null;
    new.na_validation_status := null;
    new.na_validated_at := null;
    new.na_validated_by := null;
    new.na_rejection_reason := null;
  end if;

  return new;
end;
$$;

create or replace function public.bump_response_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.revision := old.revision + 1;
  return new;
end;
$$;

create or replace function public.deactivate_incompatible_evidence_on_response_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.answer <> 'yes'::public.answer_value then
    update public.evidences
       set deactivated_at = coalesce(deactivated_at, now())
     where response_id = new.id
       and deactivated_at is null;
  end if;
  return new;
end;
$$;

create or replace function public.deactivate_incompatible_evidence_on_evidence_write()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_answer public.answer_value;
begin
  if new.deactivated_at is null then
    select answer into v_answer
    from public.responses
    where id = new.response_id;

    if v_answer is distinct from 'yes'::public.answer_value then
      new.deactivated_at := now();
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.replace_question_organization_waivers(
  p_question_id uuid,
  p_scope_organization_ids uuid[],
  p_waivers jsonb,
  p_waived_by uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_question_id is null or p_waived_by is null then
    raise exception 'waiver_replacement_missing_required_argument'
      using errcode = '22023';
  end if;

  if coalesce(cardinality(p_scope_organization_ids), 0) = 0 then
    raise exception 'waiver_replacement_empty_scope'
      using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_waivers, '[]'::jsonb)) <> 'array' then
    raise exception 'waiver_replacement_invalid_payload'
      using errcode = '22023';
  end if;

  perform public.set_audit_actor(p_waived_by);

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_waivers, '[]'::jsonb)) item
    where nullif(item->>'organizationId', '') is null
       or not ((item->>'organizationId')::uuid = any(p_scope_organization_ids))
  ) then
    raise exception 'waiver_replacement_outside_scope'
      using errcode = '22023';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(coalesce(p_waivers, '[]'::jsonb)) item
    group by item->>'organizationId'
    having count(*) > 1
  ) then
    raise exception 'waiver_replacement_duplicate_organization'
      using errcode = '22023';
  end if;

  delete from public.question_organization_waivers
  where question_id = p_question_id
    and organization_id = any(p_scope_organization_ids);

  insert into public.question_organization_waivers (
    organization_id,
    question_id,
    reason,
    waived_by,
    waived_at
  )
  select
    (item->>'organizationId')::uuid,
    p_question_id,
    nullif(trim(item->>'reason'), ''),
    p_waived_by,
    statement_timestamp()
  from jsonb_array_elements(coalesce(p_waivers, '[]'::jsonb)) item;
end;
$$;

create or replace function public.lock_waiver_active_cycles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_organization_id uuid;
  v_old_question_id uuid;
  v_new_organization_id uuid;
  v_new_question_id uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_organization_id := old.organization_id;
    v_old_question_id := old.question_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_organization_id := new.organization_id;
    v_new_question_id := new.question_id;
  end if;

  perform c.id
  from public.cycles c
  join public.form_questions fq on fq.form_version_id = c.form_version_id
  join public.question_versions qv on qv.id = fq.question_version_id
  where c.state <> 'completed'::public.cycle_state
    and (
      (c.organization_id = v_old_organization_id and qv.question_id = v_old_question_id)
      or
      (c.organization_id = v_new_organization_id and qv.question_id = v_new_question_id)
    )
  order by c.id
  for update of c;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.lock_action_plan_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_recommendation_id uuid;
  v_new_recommendation_id uuid;
  v_cycle record;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_recommendation_id := old.recommendation_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_recommendation_id := new.recommendation_id;
  end if;

  if v_new_recommendation_id is not null and not exists (
    select 1 from public.recommendations r where r.id = v_new_recommendation_id
  ) then
    raise exception 'action_plan_recommendation_not_found'
      using errcode = '23503';
  end if;

  -- Trava origem e destino em ordem estável caso uma escrita interna tente
  -- mover o plano entre recomendações. Revalida cada estado somente depois da
  -- trava, eliminando a corrida com reabertura/encerramento.
  for v_cycle in
    select c.id, c.state
    from public.recommendations r
    join public.cycles c on c.id = r.cycle_id
    where r.id = any(array[v_old_recommendation_id, v_new_recommendation_id])
    order by c.id
    for update of c
  loop
    if v_cycle.state <> 'validated'::public.cycle_state then
      raise exception 'action_plan_cycle_not_editable'
        using errcode = '23514';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_action_plan_axis_matches_recommendation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_expected_axis_id uuid;
begin
  select qv.axis_id
    into v_expected_axis_id
  from public.recommendations r
  join public.question_versions qv on qv.id = r.question_version_id
  where r.id = new.recommendation_id;

  if v_expected_axis_id is null then
    raise exception 'action_plan_recommendation_not_found'
      using errcode = '23503';
  end if;

  if new.axis_id is distinct from v_expected_axis_id then
    raise exception 'action_plan_axis_mismatch'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.bump_action_plan_item_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if row(
    new.action_text,
    new.start_date,
    new.due_date,
    new.responsible_user_id,
    new.responsible_label,
    new.progress_percentage,
    new.status,
    new.execution_notes
  ) is distinct from row(
    old.action_text,
    old.start_date,
    old.due_date,
    old.responsible_user_id,
    old.responsible_label,
    old.progress_percentage,
    old.status,
    old.execution_notes
  ) then
    new.revision := old.revision + 1;
  else
    new.revision := old.revision;
  end if;
  return new;
end;
$$;

create or replace function public.enforce_pending_action_plan_document_upload_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_revision bigint;
  v_state public.cycle_state;
  v_plan_status public.action_plan_status;
begin
  select c.organization_id, ap.revision, c.state, ap.status
    into v_organization_id, v_revision, v_state, v_plan_status
  from public.action_plans ap
  join public.recommendations r on r.id = ap.recommendation_id
  join public.cycles c on c.id = r.cycle_id
  where ap.id = new.action_plan_id
  for share of ap, c;

  if v_organization_id is null then
    raise exception 'pending_action_plan_document_action_not_found' using errcode = '23503';
  end if;
  if v_state <> 'validated'::public.cycle_state then
    raise exception 'pending_action_plan_document_cycle_not_editable' using errcode = '23514';
  end if;
  if new.organization_id <> v_organization_id then
    raise exception 'pending_action_plan_document_organization_mismatch' using errcode = '23514';
  end if;
  if new.action_revision <> v_revision then
    raise exception 'pending_action_plan_document_revision_conflict' using errcode = '40001';
  end if;
  if v_plan_status = 'cancelled'::public.action_plan_status then
    raise exception 'pending_action_plan_document_action_cancelled' using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.enforce_action_plan_document_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_revision bigint;
  v_state public.cycle_state;
  v_plan_status public.action_plan_status;
begin
  select c.organization_id, ap.revision, c.state, ap.status
    into v_organization_id, v_revision, v_state, v_plan_status
  from public.action_plans ap
  join public.recommendations r on r.id = ap.recommendation_id
  join public.cycles c on c.id = r.cycle_id
  where ap.id = new.action_plan_id
  for share of ap, c;

  if v_organization_id is null then
    raise exception 'action_plan_document_action_not_found' using errcode = '23503';
  end if;
  if v_state <> 'validated'::public.cycle_state then
    raise exception 'action_plan_document_cycle_not_editable' using errcode = '23514';
  end if;
  if new.organization_id <> v_organization_id then
    raise exception 'action_plan_document_organization_mismatch' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and v_plan_status = 'cancelled'::public.action_plan_status then
    raise exception 'action_plan_document_action_cancelled' using errcode = '23514';
  end if;
  if tg_op = 'INSERT' and new.action_revision <> v_revision then
    raise exception 'action_plan_document_revision_conflict' using errcode = '40001';
  end if;
  return new;
end;
$$;

create or replace function public.delete_respondent_action_plan(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid,
  p_recommendation_id uuid,
  p_expected_revision bigint
)
returns table(plan_id uuid, mode text, revision bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_state public.cycle_state;
  v_plan_id uuid;
  v_revision bigint;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'respondent'::public.app_user_role
      and p.organization_id = p_organization_id
  ) then
    raise exception 'action_plan_actor_not_authorized' using errcode = '42501';
  end if;

  if p_plan_id is null or p_recommendation_id is null then
    raise exception 'action_plan_not_found' using errcode = 'P0002';
  end if;

  select c.state, ap.id, ap.revision
    into v_cycle_state, v_plan_id, v_revision
  from public.action_plans ap
  join public.recommendations r on r.id = ap.recommendation_id
  join public.cycles c on c.id = r.cycle_id
  where ap.id = p_plan_id
    and ap.recommendation_id = p_recommendation_id
    and c.organization_id = p_organization_id
    and app_private.is_current_official_recommendation(r.id)
  for update of c, ap;

  if not found then
    raise exception 'action_plan_not_found' using errcode = 'P0002';
  end if;

  if v_cycle_state <> 'validated'::public.cycle_state then
    raise exception 'action_plan_cycle_not_editable' using errcode = 'P0001';
  end if;
  if p_expected_revision is null or p_expected_revision <> v_revision then
    raise exception 'action_plan_revision_conflict' using errcode = '40001';
  end if;

  if exists (
    select 1 from public.action_plan_documents d where d.action_plan_id = v_plan_id
  ) then
    raise exception 'action_plan_has_execution_documents' using errcode = '23503';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  delete from public.action_plans
  where id = v_plan_id;

  return query select v_plan_id, 'deleted'::text, v_revision;
end;
$$;

create or replace function public.protect_library_item_version()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'library_item_versions são imutáveis e não podem ser removidos';
  end if;
  if new.item_type is distinct from old.item_type
     or new.item_id is distinct from old.item_id
     or new.version is distinct from old.version
     or new.version_major is distinct from old.version_major
     or new.version_minor is distinct from old.version_minor
     or new.version_patch is distinct from old.version_patch
     or new.payload is distinct from old.payload
     or new.hash is distinct from old.hash
     or new.vigente_de is distinct from old.vigente_de
     or new.previous_version_id is distinct from old.previous_version_id
     or new.published_by is distinct from old.published_by
     or new.published_at is distinct from old.published_at
     or new.created_at is distinct from old.created_at then
    raise exception 'o conteúdo de library_item_versions é imutável';
  end if;
  return new;
end;
$$;

create or replace function public.save_question_library_configuration(
  p_form_id uuid,
  p_question_id uuid,
  p_section_id uuid,
  p_metric jsonb,
  p_bindings jsonb,
  p_response_mapping jsonb,
  p_coverage_score numeric,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_actor_user_id is null then
    raise exception 'actor_required' using errcode = '22023';
  end if;
  if not exists (select 1 from public.sections where id = p_section_id) then
    raise exception 'section_not_found' using errcode = '23503';
  end if;
  if not exists (
    select 1
    from public.form_drafts fd
    join public.form_draft_questions fdq on fdq.form_draft_id = fd.id
    where fd.form_id = p_form_id and fdq.question_id = p_question_id
  ) then
    raise exception 'question_not_in_form_draft' using errcode = '23503';
  end if;
  if jsonb_typeof(p_metric) is distinct from 'object'
     or p_metric ->> 'answerType' is distinct from 'yes_no'
     or p_metric ->> 'interpretation' is distinct from 'qualitative'
     or jsonb_typeof(p_bindings) is distinct from 'object'
     or p_response_mapping is distinct from '{}'::jsonb
     or p_coverage_score is null
     or p_coverage_score < 0 or p_coverage_score > 100 then
    raise exception 'invalid_library_configuration' using errcode = '22023';
  end if;

  perform public.set_audit_actor(p_actor_user_id);
  update public.questions
  set section_id = p_section_id
  where id = p_question_id;

  insert into public.question_library_binding (
    question_id, metric, bindings, response_mapping, coverage_score, updated_by
  ) values (
    p_question_id, p_metric, p_bindings, p_response_mapping, p_coverage_score, p_actor_user_id
  )
  on conflict (question_id) do update
  set metric = excluded.metric,
      bindings = excluded.bindings,
      response_mapping = excluded.response_mapping,
      coverage_score = excluded.coverage_score,
      updated_by = excluded.updated_by;
end;
$$;

create or replace function public.enforce_recommendation_exception_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_question_id uuid;
  v_cycle_id uuid;
  v_cycle_state public.cycle_state;
  v_processing_id uuid;
begin
  select c.organization_id, qv.question_id, c.id, c.state, r.cycle_processing_id
    into v_organization_id, v_question_id, v_cycle_id, v_cycle_state, v_processing_id
  from public.recommendations r
  join public.cycles c on c.id = r.cycle_id
  join public.question_versions qv on qv.id = r.question_version_id
  where r.id = new.recommendation_id
  for update of c;

  if v_organization_id is null then
    raise exception 'recommendation_exception_recommendation_not_found'
      using errcode = '23503';
  end if;

  if new.organization_id <> v_organization_id then
    raise exception 'recommendation_exception_organization_mismatch'
      using errcode = '23514';
  end if;

  if new.question_id is not null and new.question_id <> v_question_id then
    raise exception 'recommendation_exception_question_mismatch'
      using errcode = '23514';
  end if;

  if tg_op = 'INSERT' then
    if v_cycle_state <> 'validated'::public.cycle_state then
      raise exception 'recommendation_exception_cycle_not_editable'
        using errcode = '23514';
    end if;
    if v_processing_id is distinct from (
      select cp.id
      from public.cycle_processings cp
      where cp.cycle_id = v_cycle_id
        and cp.status = 'completed'::public.cycle_processing_status
      order by cp.processing_version desc, cp.id desc
      limit 1
    ) then
      raise exception 'recommendation_exception_not_current'
        using errcode = '23514';
    end if;
    if exists (
      select 1
      from public.action_plans ap
      where ap.recommendation_id = new.recommendation_id
        and ap.status <> 'cancelled'::public.action_plan_status
    ) then
      raise exception 'recommendation_exception_has_active_action'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_recommendation_exception_terminal_state()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status <> 'requested' and (
    new.organization_id is distinct from old.organization_id
    or new.recommendation_id is distinct from old.recommendation_id
    or new.question_id is distinct from old.question_id
    or new.motivo is distinct from old.motivo
    or new.prazo is distinct from old.prazo
    or new.status is distinct from old.status
    or new.requested_by is distinct from old.requested_by
    or new.requested_at is distinct from old.requested_at
    or new.decided_by is distinct from old.decided_by
    or new.decided_at is distinct from old.decided_at
  ) then
    raise exception 'recommendation_exception_already_decided'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.prevent_approved_action_plan_document_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.action_plan_supervision_notes approval
    where approval.action_plan_id = new.action_plan_id
      and approval.action_revision = new.action_revision
      and approval.note_type = 'approval'
      and approval.lifecycle_status = 'effective'
  ) then
    raise exception 'action_plan_document_approval_effective'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.lock_supervision_cycle(
  p_recommendation_id uuid
)
returns public.cycle_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_state public.cycle_state;
begin
  select c.state into v_cycle_state
  from public.recommendations r
  join public.cycles c on c.id = r.cycle_id
  where r.id = p_recommendation_id
  for update of c;

  if not found then
    raise exception 'supervision_recommendation_not_found' using errcode = 'P0002';
  end if;
  if v_cycle_state <> 'validated'::public.cycle_state then
    raise exception 'supervision_cycle_not_open' using errcode = '23514';
  end if;

  return v_cycle_state;
end;
$$;

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
  if new.note_type = 'approval' and not exists (
    select 1
    from public.action_plan_documents d
    where d.action_plan_id = v_action.id
      and d.action_revision = v_action.revision
      and d.deactivated_at is null
      and (
        (d.kind = 'link' and d.external_link is not null)
        or (d.kind = 'file' and d.file_validation_status = 'valid')
      )
  ) then
    raise exception 'supervision_approval_requires_execution_evidence' using errcode = '23514';
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

create or replace function public.prevent_action_plan_cancellation_with_open_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'cancelled'::public.action_plan_status
     and old.status <> 'cancelled'::public.action_plan_status
     and exists (
       select 1
       from public.action_plan_supervision_notes n
       where n.action_plan_id = new.id
         and n.note_type in ('adjustment_request', 'pending')
         and n.lifecycle_status in ('open', 'acknowledged')
     ) then
    raise exception 'action_plan_cancel_has_open_supervision_request'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create or replace function public.supersede_action_plan_approval_after_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.revision <> old.revision then
    update public.action_plan_supervision_notes
    set lifecycle_status = 'superseded'::public.supervision_note_lifecycle_status
    where action_plan_id = new.id
      and note_type = 'approval'
      and lifecycle_status = 'effective'::public.supervision_note_lifecycle_status;
  end if;
  return new;
end;
$$;

create or replace function public.create_action_plan_supervision_note(
  p_recommendation_id uuid,
  p_action_plan_id uuid,
  p_actor_user_id uuid,
  p_note_type text,
  p_body text
)
returns public.action_plan_supervision_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note public.action_plan_supervision_notes%rowtype;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'supervision_create_not_authorized' using errcode = '42501';
  end if;
  if nullif(btrim(p_body), '') is null then
    raise exception 'supervision_body_required' using errcode = '23514';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  insert into public.action_plan_supervision_notes (
    recommendation_id,
    action_plan_id,
    author_id,
    author_role,
    note_type,
    lifecycle_status,
    body
  ) values (
    p_recommendation_id,
    p_action_plan_id,
    p_actor_user_id,
    'admin'::public.app_user_role,
    p_note_type,
    'recorded'::public.supervision_note_lifecycle_status,
    btrim(p_body)
  )
  returning * into v_note;

  return v_note;
end;
$$;

create or replace function public.respond_to_action_plan_supervision_request(
  p_note_id uuid,
  p_actor_user_id uuid,
  p_response_body text
)
returns public.action_plan_supervision_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note public.action_plan_supervision_notes%rowtype;
  v_organization_id uuid;
begin
  if nullif(btrim(p_response_body), '') is null then
    raise exception 'supervision_response_required' using errcode = '23514';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  select n.* into v_note
  from public.action_plan_supervision_notes n
  where n.id = p_note_id
  for update;

  if not found then
    raise exception 'supervision_note_not_found' using errcode = 'P0002';
  end if;

  select c.organization_id into v_organization_id
  from public.recommendations r
  join public.cycles c on c.id = r.cycle_id
  where r.id = v_note.recommendation_id;
  if v_note.note_type not in ('adjustment_request', 'pending')
     or v_note.lifecycle_status <> 'open'::public.supervision_note_lifecycle_status then
    raise exception 'supervision_request_not_open' using errcode = '23514';
  end if;

  perform public.lock_supervision_cycle(v_note.recommendation_id);

  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'respondent'::public.app_user_role
      and p.organization_id = v_organization_id
  ) then
    raise exception 'supervision_response_not_authorized' using errcode = '42501';
  end if;

  update public.action_plan_supervision_notes
  set lifecycle_status = 'acknowledged'::public.supervision_note_lifecycle_status,
      response_body = btrim(p_response_body),
      responded_by = p_actor_user_id,
      responded_at = now()
  where id = p_note_id
  returning * into v_note;

  return v_note;
end;
$$;

create or replace function public.decide_action_plan_supervision_request(
  p_note_id uuid,
  p_actor_user_id uuid,
  p_decision public.supervision_note_lifecycle_status,
  p_resolution_body text
)
returns public.action_plan_supervision_notes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_note public.action_plan_supervision_notes%rowtype;
begin
  if p_decision not in (
    'resolved'::public.supervision_note_lifecycle_status,
    'cancelled'::public.supervision_note_lifecycle_status
  ) then
    raise exception 'supervision_decision_invalid' using errcode = '23514';
  end if;
  if nullif(btrim(p_resolution_body), '') is null then
    raise exception 'supervision_resolution_required' using errcode = '23514';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'supervision_decision_not_authorized' using errcode = '42501';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  select * into v_note
  from public.action_plan_supervision_notes
  where id = p_note_id
  for update;

  if not found then
    raise exception 'supervision_note_not_found' using errcode = 'P0002';
  end if;
  if v_note.note_type not in ('adjustment_request', 'pending')
     or v_note.lifecycle_status not in (
       'open'::public.supervision_note_lifecycle_status,
       'acknowledged'::public.supervision_note_lifecycle_status
     ) then
    raise exception 'supervision_request_not_pending' using errcode = '23514';
  end if;
  if p_decision = 'resolved'::public.supervision_note_lifecycle_status
     and v_note.lifecycle_status <> 'acknowledged'::public.supervision_note_lifecycle_status then
    raise exception 'supervision_resolution_requires_response' using errcode = '23514';
  end if;

  perform public.lock_supervision_cycle(v_note.recommendation_id);

  update public.action_plan_supervision_notes
  set lifecycle_status = p_decision,
      resolution_body = btrim(p_resolution_body),
      resolved_by = p_actor_user_id,
      resolved_at = now()
  where id = p_note_id
  returning * into v_note;

  return v_note;
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
  select ap.recommendation_id, ap.id, 'missing_execution_evidence'::text
  from active_actions ap
  where ap.status = 'done'::public.action_plan_status
    and not exists (
      select 1 from public.action_plan_documents d
      where d.action_plan_id = ap.id
        and d.action_revision = ap.revision
        and d.deactivated_at is null
        and (
          (d.kind = 'link' and d.external_link is not null)
          or (d.kind = 'file' and d.file_validation_status = 'valid')
        )
    )
  union all
  select ap.recommendation_id, ap.id, 'action_not_approved'::text
  from active_actions ap
  where ap.status = 'done'::public.action_plan_status
    and exists (
      select 1 from public.action_plan_documents d
      where d.action_plan_id = ap.id
        and d.action_revision = ap.revision
        and d.deactivated_at is null
        and (
          (d.kind = 'link' and d.external_link is not null)
          or (d.kind = 'file' and d.file_validation_status = 'valid')
        )
    )
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

create or replace function public.prevent_audit_event_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  raise exception using
    errcode = '42501',
    message = 'audit_event_append_only';
end;
$$;

create or replace function app_private.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'admin'
  );
$$;

create or replace function app_private.is_respondent()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.user_id = auth.uid() and p.role = 'respondent'
  );
$$;

create or replace function app_private.current_organization_id()
returns uuid language sql stable security definer set search_path = public as $$
  select p.organization_id from public.profiles p
  where p.user_id = auth.uid() limit 1;
$$;

create or replace function public.prevent_profile_identity_change()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_override text := current_setting('app.profile_identity_override', true);
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'profile_user_id_immutable' using errcode = 'P0001';
  end if;

  if v_override in ('bootstrap_global_admin', 'update_respondent_profile') then
    return new;
  end if;

  if new.role is distinct from old.role
     or new.organization_id is distinct from old.organization_id then
    raise exception 'profile_identity_change_requires_admin_rpc'
      using errcode = 'P0001',
            hint = 'Use a operação administrativa autorizada para alterar respondentes.';
  end if;

  return new;
end;
$$;

create or replace function app_private.is_cycle_respondent_editable(p_cycle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    app_private.is_respondent()
    and exists (
      select 1
      from public.cycles c
      where c.id = p_cycle_id
        and c.organization_id = app_private.current_organization_id()
        and c.state in ('in_response', 'awaiting_adjustment')
        and c.response_collection_paused_at is null
    );
$$;

create or replace function app_private.is_response_respondent_editable(p_response_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    app_private.is_respondent()
    and exists (
      select 1
      from public.responses r
      join public.cycles c on c.id = r.cycle_id
      where r.id = p_response_id
        and c.organization_id = app_private.current_organization_id()
        and c.state in ('in_response', 'awaiting_adjustment')
        and c.response_collection_paused_at is null
    );
$$;

create or replace function app_private.is_cycle_question_version_allowed(
  p_cycle_id uuid,
  p_question_version_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cycles c
    join public.form_questions fq
      on fq.form_version_id = c.form_version_id
     and fq.question_version_id = p_question_version_id
    where c.id = p_cycle_id
  );
$$;

create or replace function public.guard_response_question_version_in_cycle_form()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not app_private.is_cycle_question_version_allowed(
    new.cycle_id,
    new.question_version_id
  ) then
    raise exception 'question_version_not_in_cycle_form'
      using errcode = 'foreign_key_violation';
  end if;

  return new;
end;
$$;

create or replace function public.guard_respondent_live_data_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not app_private.is_respondent() then
    return new;
  end if;

  if tg_table_name = 'responses' then
    if tg_op = 'UPDATE'
       and (
         new.cycle_id is distinct from old.cycle_id
         or new.question_version_id is distinct from old.question_version_id
         or new.created_by is distinct from old.created_by
         or new.created_at is distinct from old.created_at
       ) then
      raise exception 'respondente não pode alterar a identidade de uma resposta'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_table_name = 'evidences' then
    if tg_op = 'INSERT'
       and (
         new.validation_status <> 'pending'
         or new.validation_justification is not null
         or new.validated_at is not null
         or new.validated_by is not null
         or new.deactivated_at is not null
       ) then
      raise exception 'respondente não pode criar evidência com veredito administrativo'
        using errcode = '42501';
    end if;

    if tg_op = 'UPDATE'
       and (
         new.response_id is distinct from old.response_id
         or new.submitted_by is distinct from old.submitted_by
         or new.submitted_at is distinct from old.submitted_at
         or new.validation_status is distinct from old.validation_status
         or new.validation_justification is distinct from old.validation_justification
         or new.validated_at is distinct from old.validated_at
         or new.validated_by is distinct from old.validated_by
         or new.deactivated_at is distinct from old.deactivated_at
       ) then
      raise exception 'respondente não pode alterar identidade, veredito ou desativação de evidência'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

create or replace function app_private.is_current_official_recommendation(
  p_recommendation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.recommendations r
    join public.cycles c on c.id = r.cycle_id
    join public.cycle_processings cp
      on cp.id = r.cycle_processing_id
     and cp.cycle_id = r.cycle_id
    where r.id = p_recommendation_id
      and c.state in (
        'validated'::public.cycle_state,
        'completed'::public.cycle_state
      )
      and cp.status = 'completed'::public.cycle_processing_status
      and cp.processing_version = (
        select max(cp2.processing_version)
        from public.cycle_processings cp2
        where cp2.cycle_id = c.id
          and cp2.status = 'completed'::public.cycle_processing_status
      )
  );
$$;

create or replace function public.save_respondent_action_plan(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid,
  p_recommendation_id uuid,
  p_action_text text,
  p_due_date date,
  p_start_date date,
  p_responsible_sector text,
  p_responsible_user_id uuid,
  p_progress_percentage integer,
  p_cancelled boolean default false,
  p_expected_revision bigint default null,
  p_execution_notes text default null,
  p_progress_update_description text default null
)
returns table(plan_id uuid, mode text, revision bigint)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_axis_id uuid;
  v_cycle_state public.cycle_state;
  v_existing public.action_plans%rowtype;
  v_plan_id uuid;
  v_result_revision bigint;
  v_responsible_name text;
  v_responsible_label text;
  v_now timestamptz := now();
  v_status public.action_plan_status;
  v_progress integer;
  v_description text;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'respondent'::public.app_user_role
      and p.organization_id = p_organization_id
  ) then
    raise exception 'action_plan_actor_not_authorized' using errcode = '42501';
  end if;

  if p_action_text is null or char_length(btrim(p_action_text)) < 5
     or char_length(btrim(p_action_text)) > 4000 then
    raise exception 'action_plan_invalid_action_text' using errcode = '22023';
  end if;
  if p_due_date is null then
    raise exception 'action_plan_invalid_due_date' using errcode = '22023';
  end if;
  if p_start_date is null then
    raise exception 'action_plan_invalid_start_date' using errcode = '22023';
  end if;
  if p_start_date > p_due_date then
    raise exception 'action_plan_start_after_due' using errcode = '22023';
  end if;
  if p_responsible_sector is null or char_length(btrim(p_responsible_sector)) < 2
     or char_length(btrim(p_responsible_sector)) > 200 then
    raise exception 'action_plan_invalid_responsible_sector' using errcode = '22023';
  end if;
  if p_responsible_user_id is null then
    raise exception 'action_plan_responsible_user_required' using errcode = '22023';
  end if;
  if p_progress_percentage is null
     or p_progress_percentage <> trunc(p_progress_percentage)
     or p_progress_percentage < 0
     or p_progress_percentage > 100 then
    raise exception 'action_plan_invalid_progress_percentage' using errcode = '22023';
  end if;
  if p_execution_notes is not null and char_length(btrim(p_execution_notes)) > 4000 then
    raise exception 'action_plan_invalid_execution_notes' using errcode = '22023';
  end if;
  if p_progress_update_description is not null
     and char_length(btrim(p_progress_update_description)) > 4000 then
    raise exception 'action_plan_invalid_progress_update_description' using errcode = '22023';
  end if;
  if coalesce(p_cancelled, false)
     and nullif(btrim(coalesce(p_execution_notes, '')), '') is null then
    raise exception 'action_plan_cancel_reason_required' using errcode = '22023';
  end if;

  v_progress := p_progress_percentage;
  if coalesce(p_cancelled, false) then
    v_status := 'cancelled'::public.action_plan_status;
  elsif v_progress = 0 then
    v_status := 'todo'::public.action_plan_status;
  elsif v_progress = 100 then
    v_status := 'done'::public.action_plan_status;
  else
    v_status := 'doing'::public.action_plan_status;
  end if;
  v_description := nullif(btrim(coalesce(p_progress_update_description, '')), '');

  select coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(au.email), ''), 'Respondente')
    into v_responsible_name
  from public.profiles p
  left join auth.users au on au.id = p.user_id
  where p.user_id = p_responsible_user_id
    and p.role = 'respondent'::public.app_user_role
    and p.organization_id = p_organization_id;

  if v_responsible_name is null then
    raise exception 'action_plan_responsible_user_not_in_organization' using errcode = '22023';
  end if;

  select qv.axis_id, c.state
    into v_axis_id, v_cycle_state
  from public.recommendations r
  join public.question_versions qv on qv.id = r.question_version_id
  join public.cycles c on c.id = r.cycle_id
  where r.id = p_recommendation_id
    and c.organization_id = p_organization_id
    and app_private.is_current_official_recommendation(r.id)
  for update of c;

  if not found then
    raise exception 'action_plan_actor_not_authorized' using errcode = '42501';
  end if;
  if v_cycle_state <> 'validated'::public.cycle_state then
    raise exception 'action_plan_cycle_not_editable' using errcode = 'P0001';
  end if;
  if exists (
    select 1
    from public.recommendation_exceptions ex
    where ex.recommendation_id = p_recommendation_id
      and (
        ex.status = 'approved'
        or (
          ex.status = 'requested'
          and (ex.prazo is null or ex.prazo >= current_date)
        )
      )
  ) then
    raise exception 'action_plan_exception_active' using errcode = '23514';
  end if;

  v_responsible_label := btrim(p_responsible_sector) || ' — ' || v_responsible_name;
  perform public.set_audit_actor(p_actor_user_id);

  if p_plan_id is null then
    if p_expected_revision is not null then
      raise exception 'action_plan_revision_conflict' using errcode = '40001';
    end if;

    insert into public.action_plans (
      recommendation_id,
      axis_id,
      action_text,
      start_date,
      due_date,
      responsible_user_id,
      responsible_label,
      progress_percentage,
      status,
      execution_notes,
      completed_at,
      cancelled_at,
      cancel_reason
    ) values (
      p_recommendation_id,
      v_axis_id,
      btrim(p_action_text),
      p_start_date,
      p_due_date,
      p_responsible_user_id,
      v_responsible_label,
      v_progress,
      v_status,
      nullif(btrim(coalesce(p_execution_notes, '')), ''),
      case when v_status = 'done' then v_now else null end,
      case when v_status = 'cancelled' then v_now else null end,
      case when v_status = 'cancelled' then btrim(p_execution_notes) else null end
    )
    returning action_plans.id, action_plans.revision
      into v_plan_id, v_result_revision;

    insert into public.action_plan_progress_updates (
      action_plan_id,
      previous_percentage,
      new_percentage,
      previous_status,
      new_status,
      description,
      created_by
    ) values (
      v_plan_id,
      0,
      v_progress,
      'todo'::public.action_plan_status,
      v_status,
      v_description,
      p_actor_user_id
    );

    return query select v_plan_id, 'created'::text, v_result_revision;
    return;
  end if;

  select * into v_existing
  from public.action_plans ap
  where ap.id = p_plan_id
    and ap.recommendation_id = p_recommendation_id
  for update;

  if not found then
    raise exception 'action_plan_not_found' using errcode = 'P0002';
  end if;

  if p_expected_revision is null or p_expected_revision <> v_existing.revision then
    raise exception 'action_plan_revision_conflict' using errcode = '40001';
  end if;

  update public.action_plans
  set action_text = btrim(p_action_text),
      start_date = p_start_date,
      due_date = p_due_date,
      responsible_user_id = p_responsible_user_id,
      responsible_label = v_responsible_label,
      progress_percentage = v_progress,
      status = v_status,
      execution_notes = nullif(btrim(coalesce(p_execution_notes, '')), ''),
      completed_at = case
        when v_status = 'done' then coalesce(v_existing.completed_at, v_now)
        else null
      end,
      cancelled_at = case
        when v_status = 'cancelled' then coalesce(v_existing.cancelled_at, v_now)
        else null
      end,
      cancel_reason = case
        when v_status = 'cancelled' then btrim(p_execution_notes)
        else null
      end
  where id = p_plan_id
  returning action_plans.id, action_plans.revision
    into v_plan_id, v_result_revision;

  if v_existing.progress_percentage is distinct from v_progress
     or v_existing.status is distinct from v_status
     or v_description is not null then
    insert into public.action_plan_progress_updates (
      action_plan_id,
      previous_percentage,
      new_percentage,
      previous_status,
      new_status,
      description,
      created_by
    ) values (
      v_plan_id,
      v_existing.progress_percentage,
      v_progress,
      v_existing.status,
      v_status,
      v_description,
      p_actor_user_id
    );
  end if;

  return query select v_plan_id, 'updated'::text, v_result_revision;
end;
$$;

create or replace function public.initialize_action_plan_document_upload(
  p_actor_user_id uuid,
  p_organization_id uuid,
  p_plan_id uuid,
  p_pending_upload_id uuid,
  p_expected_revision bigint,
  p_title text,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_size_bytes bigint,
  p_expires_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan public.action_plans%rowtype;
  v_cycle_state public.cycle_state;
  v_recommendation_id uuid;
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
  if p_pending_upload_id is null
     or nullif(btrim(coalesce(p_title, '')), '') is null
     or char_length(btrim(p_title)) not between 3 and 200
     or nullif(btrim(coalesce(p_storage_path, '')), '') is null
     or p_storage_path not like p_organization_id::text || '/' || p_plan_id::text || '/%'
     or nullif(btrim(coalesce(p_original_filename, '')), '') is null
     or char_length(btrim(p_original_filename)) > 500
     or p_mime_type is null
     or char_length(btrim(p_mime_type)) > 200
     or p_size_bytes is null
     or p_size_bytes <= 0
     or p_size_bytes > 20971520
     or p_expires_at is null
     or p_expires_at <= now()
     or p_expires_at > now() + interval '24 hours' then
    raise exception 'pending_action_plan_document_invalid_metadata' using errcode = '22023';
  end if;

  -- PostgreSQL não permite misturar %rowtype com escalares no mesmo INTO.
  select c.state, r.id
    into v_cycle_state, v_recommendation_id
  from public.action_plans ap
  join public.recommendations r on r.id = ap.recommendation_id
  join public.cycles c on c.id = r.cycle_id
  where ap.id = p_plan_id
    and c.organization_id = p_organization_id
  for update of ap, c;

  if not found then
    raise exception 'action_plan_document_action_not_found' using errcode = 'P0002';
  end if;

  select * into v_plan
  from public.action_plans
  where id = p_plan_id;

  if not app_private.is_current_official_recommendation(v_recommendation_id) then
    raise exception 'action_plan_document_action_not_found' using errcode = 'P0002';
  end if;
  if v_cycle_state <> 'validated'::public.cycle_state then
    raise exception 'action_plan_document_cycle_not_editable' using errcode = 'P0001';
  end if;
  if v_plan.status = 'cancelled'::public.action_plan_status then
    raise exception 'action_plan_document_action_cancelled' using errcode = '23514';
  end if;
  if p_expected_revision is null or p_expected_revision <> v_plan.revision then
    raise exception 'action_plan_document_revision_conflict' using errcode = '40001';
  end if;
  if exists (
    select 1
    from public.action_plan_supervision_notes approval
    where approval.action_plan_id = v_plan.id
      and approval.action_revision = v_plan.revision
      and approval.note_type = 'approval'
      and approval.lifecycle_status = 'effective'
  ) then
    raise exception 'action_plan_document_approval_effective' using errcode = '23514';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  insert into public.pending_action_plan_document_uploads (
    id,
    action_plan_id,
    organization_id,
    action_revision,
    title,
    storage_path,
    original_filename,
    mime_type,
    size_bytes,
    uploaded_by,
    expires_at
  ) values (
    p_pending_upload_id,
    v_plan.id,
    p_organization_id,
    v_plan.revision,
    btrim(p_title),
    p_storage_path,
    btrim(p_original_filename),
    btrim(p_mime_type),
    p_size_bytes,
    p_actor_user_id,
    p_expires_at
  );
end;
$$;

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
  join public.action_plans existing_plan on existing_plan.id = document.action_plan_id
  join public.recommendations existing_recommendation
    on existing_recommendation.id = existing_plan.recommendation_id
  join public.cycles existing_cycle on existing_cycle.id = existing_recommendation.cycle_id
  where document.id = p_pending_upload_id
    and document.action_plan_id = p_plan_id
    and document.organization_id = p_organization_id
    and document.uploaded_by = p_actor_user_id
    and document.action_revision = p_expected_revision
    and document.deactivated_at is null
    and existing_cycle.organization_id = p_organization_id
    and app_private.is_current_official_recommendation(existing_recommendation.id)
  for share of document, existing_plan, existing_cycle;

  if found then
    return query select
      v_document.id,
      v_document.action_plan_id,
      v_document.action_revision,
      v_document.kind,
      v_document.title,
      v_document.storage_path,
      v_document.external_link,
      v_document.original_filename,
      v_document.mime_type,
      v_document.size_bytes,
      v_document.file_validation_status,
      v_document.created_at;
    return;
  end if;

  -- PostgreSQL não permite misturar %rowtype com escalares no mesmo INTO.
  select c.state, r.id
    into v_cycle_state, v_recommendation_id
  from public.pending_action_plan_document_uploads pdu
  join public.action_plans ap on ap.id = pdu.action_plan_id
  join public.recommendations r on r.id = ap.recommendation_id
  join public.cycles c on c.id = r.cycle_id
  where pdu.id = p_pending_upload_id
    and pdu.action_plan_id = p_plan_id
    and pdu.organization_id = p_organization_id
    and pdu.uploaded_by = p_actor_user_id
    and c.organization_id = p_organization_id
  for update of pdu, ap, c;

  if not found then
    raise exception 'pending_action_plan_document_not_found' using errcode = 'P0002';
  end if;

  select * into v_pending
  from public.pending_action_plan_document_uploads
  where id = p_pending_upload_id;

  select * into v_plan
  from public.action_plans
  where id = p_plan_id;
  if v_pending.expires_at <= now() then
    raise exception 'pending_action_plan_document_expired' using errcode = 'P0002';
  end if;
  if v_cycle_state <> 'validated'::public.cycle_state then
    raise exception 'action_plan_document_cycle_not_editable' using errcode = 'P0001';
  end if;
  if not app_private.is_current_official_recommendation(v_recommendation_id) then
    raise exception 'action_plan_document_action_not_found' using errcode = 'P0002';
  end if;
  if v_plan.status = 'cancelled'::public.action_plan_status then
    raise exception 'action_plan_document_action_cancelled' using errcode = '23514';
  end if;
  if p_expected_revision is null
     or p_expected_revision <> v_plan.revision
     or p_expected_revision <> v_pending.action_revision then
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
    where approval.action_plan_id = v_plan.id
      and approval.action_revision = v_plan.revision
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
    v_pending.id,
    v_plan.id,
    p_organization_id,
    v_plan.revision,
    'file',
    v_pending.title,
    v_pending.storage_path,
    v_pending.original_filename,
    btrim(p_verified_mime_type),
    v_pending.size_bytes,
    'valid',
    now(),
    p_actor_user_id
  )
  returning * into v_document;

  delete from public.pending_action_plan_document_uploads
  where pending_action_plan_document_uploads.id = v_pending.id;

  return query select
    v_document.id,
    v_document.action_plan_id,
    v_document.action_revision,
    v_document.kind,
    v_document.title,
    v_document.storage_path,
    v_document.external_link,
    v_document.original_filename,
    v_document.mime_type,
    v_document.size_bytes,
    v_document.file_validation_status,
    v_document.created_at;
end;
$$;

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
  on conflict (storage_path) do update
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
    on conflict (storage_path) do update
      set scheduled_for = least(
            public.action_plan_storage_cleanup_queue.scheduled_for,
            excluded.scheduled_for
          ),
          last_error = null;
  end if;

  return query select v_storage_path;
end;
$$;

create or replace function public.cycle_can_transition(
  p_from public.cycle_state,
  p_to public.cycle_state
)
returns boolean language sql immutable set search_path = public as $$
  select (p_from, p_to) in (
    ('draft', 'in_response'),
    ('in_response', 'submitted'),
    ('submitted', 'in_validation'),
    ('in_validation', 'awaiting_adjustment'),
    ('awaiting_adjustment', 'in_validation'),
    ('in_validation', 'validated'),
    ('validated', 'completed')
  );
$$;

create or replace function public.cycle_working_processing(p_cycle_id uuid)
returns uuid language sql stable set search_path = public as $$
  select cp.id from public.cycle_processings cp
  where cp.cycle_id = p_cycle_id and cp.status = 'working'
  limit 1;
$$;

create or replace function public.match_evidence_adjustment_replacements(
  p_response_id uuid
)
returns table(
  requested_evidence_id uuid,
  replacement_evidence_id uuid
)
language plpgsql
stable
set search_path = public
as $$
declare
  v_request record;
  v_replacement_id uuid;
  v_used_replacement_ids uuid[] := array[]::uuid[];
begin
  for v_request in
    select
      e.id,
      coalesce(e.validated_at, e.submitted_at) as requested_at
    from public.evidences e
    where e.response_id = p_response_id
      and e.deactivated_at is null
      and e.validation_status = 'adjustment_requested'::public.evidence_validation_status
    order by coalesce(e.validated_at, e.submitted_at), e.id
  loop
    select replacement.id
    into v_replacement_id
    from public.evidences replacement
    where replacement.response_id = p_response_id
      and replacement.deactivated_at is null
      and replacement.validation_status = 'pending'::public.evidence_validation_status
      and replacement.submitted_at > v_request.requested_at
      and not (replacement.id = any(v_used_replacement_ids))
    order by replacement.submitted_at, replacement.id
    limit 1;

    if found then
      requested_evidence_id := v_request.id;
      replacement_evidence_id := v_replacement_id;
      v_used_replacement_ids := array_append(
        v_used_replacement_ids,
        v_replacement_id
      );
      return next;
    end if;
  end loop;
end;
$$;

create or replace function public.remove_workbench_evidence_item(
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_question_version_id uuid,
  p_evidence_id uuid,
  p_expected_revision bigint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_response public.responses%rowtype;
  v_response_id uuid;
  v_response_revision bigint;
  v_evidence public.evidences%rowtype;
  v_snapshot_use integer := 0;
begin
  perform public.set_audit_actor(p_actor_user_id);

  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for share;

  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;

  if v_cycle.state not in ('in_response', 'awaiting_adjustment') then
    raise exception 'cycle_not_editable: %', v_cycle.state using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.form_questions fq
    where fq.form_version_id = v_cycle.form_version_id
      and fq.question_version_id = p_question_version_id
  ) then
    raise exception 'question_not_in_cycle_form' using errcode = 'P0001';
  end if;

  select * into v_response
  from public.responses r
  where r.cycle_id = p_cycle_id
    and r.question_version_id = p_question_version_id
  for update;

  if not found then
    raise exception 'response_not_found' using errcode = 'P0002';
  end if;

  v_response_id := v_response.id;
  v_response_revision := v_response.revision;

  if p_expected_revision is null or p_expected_revision <> v_response_revision then
    raise exception 'response_revision_conflict' using errcode = '40001';
  end if;

  if v_cycle.state = 'awaiting_adjustment'::public.cycle_state
     and not (
       exists (
         select 1
         from public.evidences requested
         where requested.response_id = v_response_id
           and requested.deactivated_at is null
           and requested.validation_status = 'adjustment_requested'::public.evidence_validation_status
       )
       or v_response.admin_proof_status = 'proof_requested'
     ) then
    raise exception 'adjustment_question_not_editable' using errcode = 'P0001';
  end if;

  select * into v_evidence
  from public.evidences e
  where e.id = p_evidence_id
    and e.response_id = v_response_id
    and e.deactivated_at is null
  for update;

  if not found then
    raise exception 'active_evidence_not_found' using errcode = 'P0002';
  end if;

  if v_cycle.state = 'awaiting_adjustment'::public.cycle_state
     and v_evidence.validation_status <> 'pending'::public.evidence_validation_status then
    raise exception 'returned_evidence_must_be_preserved' using errcode = 'P0001';
  end if;

  select count(*) into v_snapshot_use
  from public.evidence_snapshots es
  where es.evidence_id = v_evidence.id;

  if v_snapshot_use > 0 then
    update public.evidences
    set deactivated_at = now()
    where id = v_evidence.id;
  else
    if v_evidence.storage_path is not null then
      insert into public.evidence_storage_cleanup_queue(storage_path)
      values (v_evidence.storage_path)
      on conflict (storage_path) do update
      set scheduled_for = least(
        public.evidence_storage_cleanup_queue.scheduled_for,
        excluded.scheduled_for
      );
    end if;
    delete from public.evidences
    where id = v_evidence.id;
  end if;

  update public.responses
  set updated_at = updated_at
  where id = v_response_id
  returning revision into v_response_revision;

  return jsonb_build_object(
    'responseId', v_response_id,
    'responseRevision', v_response_revision,
    'evidenceId', v_evidence.id,
    'storagePath', case when v_snapshot_use = 0 then v_evidence.storage_path else null end,
    'deactivated', v_snapshot_use > 0
  );
end;
$$;

create or replace function public.create_cycle(
  p_form_id uuid,
  p_organization_id uuid,
  p_period_label text,
  p_actor_user_id uuid,
  p_starts_at timestamptz default null,
  p_response_deadline_at timestamptz default null
)
returns public.cycles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form_version_id uuid;
  v_period public.form_periods;
  v_cycle public.cycles;
  v_code text := btrim(p_period_label);
begin
  perform public.set_audit_actor(p_actor_user_id);

  if v_code is null or v_code = '' then
    raise exception 'invalid_period_label'
      using errcode = 'check_violation';
  end if;

  if p_starts_at is not null and p_response_deadline_at is not null
     and p_response_deadline_at < p_starts_at then
    raise exception 'deadline_before_start'
      using errcode = 'check_violation';
  end if;

  select current_form_version_id into v_form_version_id
  from public.forms
  where id = p_form_id
  for share;

  if v_form_version_id is null then
    raise exception 'form_has_no_published_version'
      using errcode = 'foreign_key_violation';
  end if;

  perform 1
  from public.form_assignments
  where form_id = p_form_id and organization_id = p_organization_id
  for key share;

  if not found then
    raise exception 'organization_not_assigned'
      using errcode = 'foreign_key_violation';
  end if;

  v_period := public.ensure_form_period(
    v_form_version_id,
    v_code,
    v_code,
    p_starts_at,
    p_response_deadline_at
  );

  -- Duplicidade funcional entre versões do mesmo formulário (mesmo period_code).
  if exists (
    select 1
    from public.cycles c
    join public.form_versions fv on fv.id = c.form_version_id
    join public.form_periods fp on fp.id = c.period_id
    where fv.form_id = p_form_id
      and c.organization_id = p_organization_id
      and fp.period_code = v_period.period_code
  ) then
    raise exception 'cycles_form_period_unique'
      using errcode = 'unique_violation';
  end if;

  insert into public.cycles (
    form_version_id, organization_id, period_id, period_label, state,
    starts_at, response_deadline_at
  )
  values (
    v_form_version_id, p_organization_id, v_period.id, v_period.label, 'draft',
    p_starts_at, p_response_deadline_at
  )
  returning * into v_cycle;

  insert into public.cycle_processings (cycle_id, processing_version, status)
  values (v_cycle.id, 1, 'working');

  return v_cycle;
end;
$$;

create or replace function public.create_or_open_cycles_batch(
  p_form_id uuid,
  p_organization_ids uuid[],
  p_period_label text,
  p_actor_user_id uuid,
  p_starts_at timestamptz,
  p_response_deadline_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_result jsonb;
  v_results jsonb := '[]'::jsonb;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'cycle_batch_actor_not_authorized' using errcode = '42501';
  end if;

  for v_organization_id in
    select ids.organization_id
    from unnest(coalesce(p_organization_ids, array[]::uuid[])) with ordinality
      as ids(organization_id, ordinal)
    group by ids.organization_id
    order by min(ids.ordinal)
  loop
    begin
      v_result := public.create_or_open_cycle(
        p_form_id,
        v_organization_id,
        p_period_label,
        p_actor_user_id,
        p_starts_at,
        p_response_deadline_at
      );
      v_results := v_results || jsonb_build_array(v_result);
    exception
      when others then
        v_results := v_results || jsonb_build_array(
          jsonb_build_object(
            'status', 'failed',
            'organization_id', v_organization_id,
            'message', sqlerrm
          )
        );
    end;
  end loop;

  return v_results;
end;
$$;

create or replace function public.reorder_form_draft_questions(
  p_form_draft_id uuid,
  p_ordered_question_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_count integer;
  v_input_count integer;
  v_distinct_input_count integer;
begin
  v_input_count := cardinality(coalesce(p_ordered_question_ids, array[]::uuid[]));

  select count(*)
  into v_distinct_input_count
  from (
    select distinct question_id
    from unnest(coalesce(p_ordered_question_ids, array[]::uuid[]))
      as ids(question_id)
  ) distinct_ids;

  select count(*)
  into v_current_count
  from public.form_draft_questions
  where form_draft_id = p_form_draft_id;

  if v_input_count <> v_distinct_input_count or v_input_count <> v_current_count then
    raise exception 'form_draft_question_order_mismatch' using errcode = '22023';
  end if;

  if exists (
    select 1
    from public.form_draft_questions fdq
    where fdq.form_draft_id = p_form_draft_id
      and not (fdq.question_id = any(coalesce(p_ordered_question_ids, array[]::uuid[])))
  ) then
    raise exception 'form_draft_question_order_mismatch' using errcode = '22023';
  end if;

  -- Libera temporariamente as posições para respeitar a unicidade
  -- (form_draft_id, order_index) durante trocas concorrentes.
  update public.form_draft_questions
  set order_index = order_index + 1000000
  where form_draft_id = p_form_draft_id;

  update public.form_draft_questions fdq
  set order_index = ordered.ordinality - 1
  from unnest(coalesce(p_ordered_question_ids, array[]::uuid[])) with ordinality
    as ordered(question_id, ordinality)
  where fdq.form_draft_id = p_form_draft_id
    and fdq.question_id = ordered.question_id;

  update public.form_drafts
  set updated_at = now()
  where id = p_form_draft_id;
end;
$$;

create or replace function public.create_form_with_draft(
  p_name text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.forms%rowtype;
  v_draft public.form_drafts%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = p_actor_user_id and role = 'admin' and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  insert into public.forms (name, created_by)
  values (btrim(p_name), p_actor_user_id)
  returning * into v_form;

  insert into public.form_drafts (form_id)
  values (v_form.id)
  returning * into v_draft;

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id, 'form.created', 'forms', v_form.id, null,
    to_jsonb(v_form) || jsonb_build_object('draft_id', v_draft.id)
  );

  return to_jsonb(v_form) || jsonb_build_object('draft_id', v_draft.id);
end;
$$;

create or replace function public.create_form_draft_question(
  p_form_id uuid,
  p_section_id uuid,
  p_prompt text,
  p_evidence_parameter jsonb,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft_id uuid;
  v_next_index integer;
  v_question public.questions%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = p_actor_user_id and role = 'admin' and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  select fd.id into v_draft_id
  from public.form_drafts fd
  join public.forms f on f.id = fd.form_id
  where f.id = p_form_id
  for update of fd;

  if v_draft_id is null then
    raise exception 'form_draft_not_found' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.sections where id = p_section_id) then
    raise exception 'section_not_found' using errcode = 'P0002';
  end if;

  select coalesce(max(order_index), -1) + 1
  into v_next_index
  from public.form_draft_questions
  where form_draft_id = v_draft_id;

  insert into public.questions (
    prompt, section_id, evidence_parameter, fami_enabled, applies_to_respondent
  ) values (
    btrim(p_prompt), p_section_id, coalesce(p_evidence_parameter, '{}'::jsonb), true, true
  ) returning * into v_question;

  insert into public.form_draft_questions (form_draft_id, question_id, order_index)
  values (v_draft_id, v_question.id, v_next_index);

  update public.form_drafts set updated_at = now() where id = v_draft_id;

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id, 'form.question_created', 'questions', v_question.id, null,
    to_jsonb(v_question) || jsonb_build_object('form_id', p_form_id, 'order_index', v_next_index)
  );

  return to_jsonb(v_question) || jsonb_build_object('order_index', v_next_index);
end;
$$;

create or replace function public.delete_unpublished_form(
  p_form_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_form public.forms%rowtype;
  v_question_ids uuid[];
begin
  if not exists (
    select 1 from public.profiles
    where user_id = p_actor_user_id and role = 'admin' and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  select * into v_form from public.forms where id = p_form_id for update;
  if not found then
    raise exception 'form_not_found' using errcode = 'P0002';
  end if;
  if v_form.current_form_version_id is not null then
    raise exception 'published_form_cannot_be_deleted' using errcode = '23514';
  end if;

  select coalesce(array_agg(fdq.question_id), array[]::uuid[])
  into v_question_ids
  from public.form_drafts fd
  join public.form_draft_questions fdq on fdq.form_draft_id = fd.id
  where fd.form_id = p_form_id;

  delete from public.forms where id = p_form_id;

  delete from public.questions q
  where q.id = any(v_question_ids)
    and not exists (select 1 from public.form_draft_questions fdq where fdq.question_id = q.id)
    and not exists (select 1 from public.question_versions qv where qv.question_id = q.id);

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id, 'form.deleted', 'forms', p_form_id, to_jsonb(v_form), null
  );
end;
$$;

create or replace function public.sync_form_assignments(
  p_form_id uuid,
  p_organization_ids uuid[],
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_desired uuid[] := coalesce(p_organization_ids, array[]::uuid[]);
  v_published boolean;
  v_locked_count integer;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = p_actor_user_id and role = 'admin' and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  perform 1 from public.forms where id = p_form_id for update;
  if not found then raise exception 'form_not_found' using errcode = 'P0002'; end if;

  if cardinality(v_desired) <> (
    select count(*) from (select distinct value from unnest(v_desired) value) d
  ) then
    raise exception 'duplicate_organization_assignment' using errcode = '22023';
  end if;

  if exists (
    select 1 from unnest(v_desired) org_id
    where not exists (select 1 from public.organizations o where o.id = org_id)
  ) then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  select exists (
    select 1 from public.forms f
    join public.form_versions fv on fv.id = f.current_form_version_id
    where f.id = p_form_id and fv.state = 'published'
  ) into v_published;

  if v_published and cardinality(v_desired) = 0 then
    raise exception 'form_published_requires_assignment' using errcode = '23514';
  end if;

  select count(*) into v_locked_count
  from public.form_assignments fa
  where fa.form_id = p_form_id
    and not (fa.organization_id = any(v_desired))
    and exists (
      select 1 from public.cycles c
      join public.form_versions fv on fv.id = c.form_version_id
      where fv.form_id = p_form_id and c.organization_id = fa.organization_id
    );
  if v_locked_count > 0 then
    raise exception 'form_assignment_has_cycles' using errcode = '23514';
  end if;

  delete from public.form_assignments
  where form_id = p_form_id
    and not (organization_id = any(v_desired));

  insert into public.form_assignments (form_id, organization_id, assigned_by)
  select p_form_id, org_id, p_actor_user_id
  from unnest(v_desired) org_id
  on conflict (form_id, organization_id) do nothing;

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id, 'form.assignments_synced', 'forms', p_form_id, null,
    jsonb_build_object('organization_ids', to_jsonb(v_desired))
  );

  return jsonb_build_object('form_id', p_form_id, 'organization_ids', to_jsonb(v_desired));
end;
$$;

create or replace function public.remove_form_draft_question(
  p_form_id uuid,
  p_question_id uuid,
  p_actor_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft_id uuid;
  v_exists boolean;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = p_actor_user_id and role = 'admin' and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  perform 1 from public.forms where id = p_form_id for update;
  if not found then raise exception 'form_not_found' using errcode = 'P0002'; end if;

  select id into v_draft_id
  from public.form_drafts
  where form_id = p_form_id
  for update;
  if v_draft_id is null then raise exception 'form_draft_not_found' using errcode = 'P0002'; end if;

  select exists(
    select 1 from public.form_draft_questions
    where form_draft_id = v_draft_id and question_id = p_question_id
  ) into v_exists;
  if not v_exists then raise exception 'form_question_not_found' using errcode = 'P0002'; end if;

  delete from public.form_draft_questions
  where form_draft_id = v_draft_id and question_id = p_question_id;

  update public.form_draft_questions
  set order_index = order_index + 1000000
  where form_draft_id = v_draft_id;

  with ordered as (
    select question_id, row_number() over (order by order_index, question_id) - 1 as next_order
    from public.form_draft_questions
    where form_draft_id = v_draft_id
  )
  update public.form_draft_questions fdq
  set order_index = ordered.next_order
  from ordered
  where fdq.form_draft_id = v_draft_id
    and fdq.question_id = ordered.question_id;

  if not exists (select 1 from public.form_draft_questions where question_id = p_question_id)
     and not exists (select 1 from public.question_versions where question_id = p_question_id) then
    delete from public.questions where id = p_question_id;
  end if;

  insert into public.audit_logs(actor_user_id, event_type, entity_type, record_id, before_json, after_json)
  values (p_actor_user_id, 'form.question_removed', 'forms', p_form_id, null,
    jsonb_build_object('question_id', p_question_id));
end;
$$;

create or replace function public.guard_validation_queue_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.state = 'in_validation'::public.cycle_state
     and new.state in ('awaiting_adjustment'::public.cycle_state, 'validated'::public.cycle_state)
     and coalesce(current_setting('app.validation_transition_origin', true), '') <> 'evidence_queue' then
    raise exception 'validation_transition_requires_evidence_workflow'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.validate_evidence(
  p_evidence_id uuid,
  p_cycle_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_justification text default null,
  p_expected_status text default null,
  p_expected_validated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_evidence public.evidences%rowtype;
  v_cycle_id uuid;
  v_cycle public.cycles%rowtype;
  v_status public.evidence_validation_status;
  v_justification text;
  v_needs_just boolean;
  v_validated_at timestamptz;
begin
  perform public.set_audit_actor(p_actor_user_id);

  if p_action not in ('approve','invalidate','request_adjustment') then
    raise exception 'invalid_action: %', p_action using errcode = 'P0001';
  end if;

  v_needs_just := p_action in ('invalidate','request_adjustment');
  v_justification := nullif(btrim(coalesce(p_justification,'')), '');
  if v_needs_just and v_justification is null then
    raise exception 'justification_required' using errcode = 'P0001';
  end if;

  -- A ordem de lock é sempre ciclo → item. A conclusão do FAMI usa a
  -- mesma ordem, evitando deadlocks e impedindo pareceres após o fechamento.
  select r.cycle_id into v_cycle_id
  from public.evidences e
  join public.responses r on r.id = e.response_id
  where e.id = p_evidence_id;

  if not found then
    raise exception 'evidence_not_found' using errcode = 'P0002';
  end if;

  if v_cycle_id <> p_cycle_id then
    raise exception 'evidence_not_in_cycle' using errcode = '23514';
  end if;

  select * into v_cycle
  from public.cycles
  where id = v_cycle_id
  for update;

  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;

  if v_cycle.state <> 'in_validation' then
    raise exception 'cycle_not_in_validation: estado do ciclo %', v_cycle.state
      using errcode = 'P0001';
  end if;

  select e.* into v_evidence
  from public.evidences e
  join public.responses r on r.id = e.response_id
  where e.id = p_evidence_id
    and r.cycle_id = p_cycle_id
  for update of e;

  if not found then
    raise exception 'evidence_not_in_cycle' using errcode = '23514';
  end if;

  if p_expected_status is not null and (
    v_evidence.validation_status::text is distinct from p_expected_status
    or v_evidence.validated_at is distinct from p_expected_validated_at
  ) then
    raise exception 'validation_conflict' using errcode = '40001';
  end if;

  v_status := case p_action
    when 'approve' then 'approved'
    when 'invalidate' then 'invalidated'
    else 'adjustment_requested'
  end::public.evidence_validation_status;
  v_validated_at := clock_timestamp();

  update public.evidences
  set validation_status = v_status,
      validation_justification = case when v_needs_just then v_justification else null end,
      validated_at = v_validated_at,
      validated_by = p_actor_user_id
  where id = p_evidence_id;

  return jsonb_build_object(
    'evidenceId', p_evidence_id,
    'validationStatus', v_status,
    'validatedAt', v_validated_at,
    'cycleId', v_cycle_id,
    'cycleState', 'in_validation'
  );
end;
$$;

create or replace function public.validate_not_applicable_response(
  p_response_id uuid,
  p_cycle_id uuid,
  p_action text,
  p_actor_user_id uuid,
  p_rejection_reason text default null,
  p_expected_status text default null,
  p_expected_validated_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response public.responses%rowtype;
  v_cycle public.cycles%rowtype;
  v_cycle_id uuid;
  v_reason text;
  v_validated_at timestamptz;
begin
  perform public.set_audit_actor(p_actor_user_id);

  if p_action not in ('approve', 'reject') then
    raise exception 'invalid_action: %', p_action using errcode = 'P0001';
  end if;

  -- Mantém a mesma ordem de lock da consolidação: ciclo → resposta.
  select resp.cycle_id into v_cycle_id
  from public.responses resp
  where resp.id = p_response_id;

  if not found then
    raise exception 'response_not_found' using errcode = 'P0002';
  end if;

  if v_cycle_id <> p_cycle_id then
    raise exception 'response_not_in_cycle' using errcode = '23514';
  end if;

  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;

  if v_cycle.state <> 'in_validation'::public.cycle_state then
    raise exception 'cycle_not_in_validation: estado do ciclo %', v_cycle.state
      using errcode = 'P0001';
  end if;

  select * into v_response
  from public.responses
  where id = p_response_id
    and cycle_id = p_cycle_id
  for update;

  if not found then
    raise exception 'response_not_in_cycle' using errcode = '23514';
  end if;

  if p_expected_status is not null and (
    v_response.na_validation_status::text is distinct from p_expected_status
    or v_response.na_validated_at is distinct from p_expected_validated_at
  ) then
    raise exception 'validation_conflict' using errcode = '40001';
  end if;

  if not (
    (v_response.answer = 'not_applicable'::public.answer_value
      and v_response.na_validation_status in (
        'pending'::public.na_validation_status,
        'approved'::public.na_validation_status
      ))
    or
    (v_response.answer = 'no'::public.answer_value
      and v_response.na_validation_status = 'rejected'::public.na_validation_status)
  ) then
    raise exception 'response_not_reviewable_na' using errcode = 'P0001';
  end if;

  v_validated_at := clock_timestamp();

  if p_action = 'approve' then
    update public.responses
    set answer = 'not_applicable'::public.answer_value,
        is_not_applicable = true,
        na_validation_status = 'approved'::public.na_validation_status,
        na_validated_at = v_validated_at,
        na_validated_by = p_actor_user_id,
        na_rejection_reason = null
    where id = p_response_id;

    return jsonb_build_object(
      'responseId', p_response_id,
      'answer', 'not_applicable',
      'naValidationStatus', 'approved',
      'validatedAt', v_validated_at,
      'cycleId', v_cycle.id,
      'rejected', false
    );
  end if;

  v_reason := nullif(btrim(coalesce(p_rejection_reason, '')), '');
  if v_reason is null then
    raise exception 'na_rejection_reason_required' using errcode = '22023';
  end if;

  update public.responses
  set answer = 'no'::public.answer_value,
      is_not_applicable = false,
      na_validation_status = 'rejected'::public.na_validation_status,
      na_validated_at = v_validated_at,
      na_validated_by = p_actor_user_id,
      na_rejection_reason = v_reason
  where id = p_response_id;

  return jsonb_build_object(
    'responseId', p_response_id,
    'answer', 'no',
    'naValidationStatus', 'rejected',
    'validatedAt', v_validated_at,
    'cycleId', v_cycle.id,
    'rejected', true
  );
end;
$$;

create function public.create_report_emission(
  p_cycle_id uuid,
  p_cycle_processing_id uuid,
  p_file_path text,
  p_generated_by uuid,
  p_generated_at timestamptz,
  p_reissue_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_state public.cycle_state;
  v_processing_status public.cycle_processing_status;
  v_organization_id uuid;
  v_latest_id uuid;
  v_latest_version integer;
  v_reason text;
  v_report public.reports%rowtype;
begin
  if nullif(btrim(coalesce(p_file_path, '')), '') is null then
    raise exception 'report_file_path_required' using errcode = 'P0001';
  end if;

  select c.state, cp.status, c.organization_id
  into v_cycle_state, v_processing_status, v_organization_id
  from public.cycle_processings cp
  join public.cycles c on c.id = cp.cycle_id
  where cp.id = p_cycle_processing_id
    and cp.cycle_id = p_cycle_id
  for update of c, cp;

  if not found then
    raise exception 'cycle_processing_not_found' using errcode = 'P0002';
  end if;

  if v_cycle_state <> 'completed' then
    raise exception 'cycle_not_completed: estado atual %', v_cycle_state
      using errcode = 'P0001';
  end if;

  if v_processing_status <> 'completed' then
    raise exception 'cycle_processing_not_completed' using errcode = 'P0001';
  end if;

  if p_file_path !~ (
    '^' || v_organization_id::text || '/' || p_cycle_id::text || '/' ||
    p_cycle_processing_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$'
  ) then
    raise exception 'report_file_path_scope_invalid' using errcode = 'P0001';
  end if;

  perform 1
  from storage.objects so
  where so.bucket_id = 'relatorios'
    and so.name = p_file_path
    and lower(coalesce(so.metadata ->> 'mimetype', '')) = 'application/pdf'
    and coalesce(nullif(so.metadata ->> 'size', '')::bigint, 0) > 0
  for key share;

  if not found then
    raise exception 'report_storage_object_not_found' using errcode = 'P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_cycle_processing_id::text));

  select id, emission_version
  into v_latest_id, v_latest_version
  from public.reports
  where cycle_processing_id = p_cycle_processing_id
  order by emission_version desc
  limit 1
  for update;

  v_reason := nullif(btrim(coalesce(p_reissue_reason, '')), '');
  if v_latest_id is not null and v_reason is null then
    raise exception 'reissue_reason_required' using errcode = 'P0001';
  end if;

  insert into public.reports (
    cycle_id,
    cycle_processing_id,
    file_path,
    generated_by,
    generated_at,
    emission_version,
    supersedes_report_id,
    reissue_reason
  ) values (
    p_cycle_id,
    p_cycle_processing_id,
    p_file_path,
    p_generated_by,
    coalesce(p_generated_at, now()),
    coalesce(v_latest_version, 0) + 1,
    v_latest_id,
    v_reason
  )
  returning * into v_report;

  return to_jsonb(v_report);
end;
$$;



create or replace function public.enqueue_operational_notifications()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item record;
  v_profile record;
  v_key text;
  v_message text;
  v_created integer := 0;
  v_inserted integer := 0;
  v_days integer;
begin
  for v_item in
    select c.id as cycle_id, c.organization_id, c.response_deadline_at
    from public.cycles c
    where c.state in ('in_response', 'awaiting_adjustment')
      and c.response_deadline_at is not null
      and c.response_deadline_at < now()
  loop
    for v_profile in
      select p.user_id, au.email
      from public.profiles p
      left join auth.users au on au.id = p.user_id
      where p.organization_id = v_item.organization_id
        and p.role = 'respondent'
    loop
      v_key := format('cycle-overdue:%s:user:%s', v_item.cycle_id, v_profile.user_id);
      insert into public.user_notifications (
        user_id, kind, title, message, action_path, dedupe_key
      ) values (
        v_profile.user_id,
        'diagnostic_overdue',
        'Diagnóstico com prazo vencido',
        'O diagnóstico ainda possui atividade pendente após o prazo de resposta.',
        format('/respondente/ciclos/%s', v_item.cycle_id),
        v_key
      ) on conflict do nothing;
      get diagnostics v_inserted = row_count;
      v_created := v_created + v_inserted;

      insert into public.notification_outbox (
        recipient_user_id, recipient_email, kind, payload, dedupe_key
      ) values (
        v_profile.user_id,
        v_profile.email,
        'diagnostic_overdue',
        jsonb_build_object(
          'cycle_id', v_item.cycle_id,
          'deadline', v_item.response_deadline_at,
          'action_path', format('/respondente/ciclos/%s', v_item.cycle_id)
        ),
        v_key
      ) on conflict (dedupe_key) do nothing;
    end loop;
  end loop;

  for v_item in
    select
      ap.id as action_id,
      ap.recommendation_id,
      ap.due_date,
      ap.responsible_user_id,
      c.organization_id
    from public.action_plans ap
    join public.recommendations r on r.id = ap.recommendation_id
    join public.cycles c on c.id = r.cycle_id
    where ap.status in ('todo', 'doing')
      and ap.due_date <= current_date + 7
  loop
    v_days := v_item.due_date - current_date;
    if v_days not in (7, 3, 0) and v_days >= 0 then
      continue;
    end if;
    v_message := case
      when v_days < 0 then 'A ação do plano está atrasada.'
      when v_days = 0 then 'A ação do plano vence hoje.'
      else format('Faltam %s dia(s) para o prazo da ação do plano.', v_days)
    end;

    for v_profile in
      select p.user_id, au.email
      from public.profiles p
      left join auth.users au on au.id = p.user_id
      where p.role = 'respondent'
        and (
          (v_item.responsible_user_id is not null and p.user_id = v_item.responsible_user_id)
          or
          (v_item.responsible_user_id is null and p.organization_id = v_item.organization_id)
        )
    loop
      v_key := format(
        'action-plan:%s:user:%s:window:%s',
        v_item.action_id,
        v_profile.user_id,
        case
          when v_days < 0 then format('overdue:%s', v_item.due_date)
          else v_days::text
        end
      );
      insert into public.user_notifications (
        user_id, kind, title, message, action_path, dedupe_key
      ) values (
        v_profile.user_id,
        case when v_days < 0 then 'action_plan_overdue' else 'action_plan_deadline' end,
        case when v_days < 0 then 'Ação do plano atrasada' else 'Prazo de ação do plano' end,
        v_message,
        format('/respondente/plano-acao/%s/acoes', v_item.recommendation_id),
        v_key
      ) on conflict do nothing;
      get diagnostics v_inserted = row_count;
      v_created := v_created + v_inserted;

      insert into public.notification_outbox (
        recipient_user_id, recipient_email, kind, payload, dedupe_key
      ) values (
        v_profile.user_id,
        v_profile.email,
        case when v_days < 0 then 'action_plan_overdue' else 'action_plan_deadline' end,
        jsonb_build_object(
          'action_id', v_item.action_id,
          'recommendation_id', v_item.recommendation_id,
          'due_date', v_item.due_date,
          'days_until_due', v_days,
          'action_path', format('/respondente/plano-acao/%s/acoes', v_item.recommendation_id)
        ),
        v_key
      ) on conflict (dedupe_key) do nothing;
    end loop;

    -- A administração acompanha somente o que exige intervenção: atraso. Os
    -- lembretes preventivos permanecem com a organização responsável.
    if v_days < 0 then
      for v_profile in
        select p.user_id, au.email
        from public.profiles p
        left join auth.users au on au.id = p.user_id
        where p.role = 'admin'
      loop
        v_key := format(
          'action-plan-admin:%s:user:%s:overdue:%s',
          v_item.action_id,
          v_profile.user_id,
          v_item.due_date
        );
        insert into public.user_notifications (
          user_id, kind, title, message, action_path, dedupe_key
        ) values (
          v_profile.user_id,
          'action_plan_overdue_admin',
          'Ação do plano atrasada',
          'Uma ação acompanhada pela administração está com prazo vencido.',
          format('/admin/plano-acao/%s/monitoramento', v_item.recommendation_id),
          v_key
        ) on conflict do nothing;
        get diagnostics v_inserted = row_count;
        v_created := v_created + v_inserted;

        insert into public.notification_outbox (
          recipient_user_id, recipient_email, kind, payload, dedupe_key
        ) values (
          v_profile.user_id,
          v_profile.email,
          'action_plan_overdue_admin',
          jsonb_build_object(
            'action_id', v_item.action_id,
            'recommendation_id', v_item.recommendation_id,
            'due_date', v_item.due_date,
            'days_overdue', abs(v_days),
            'action_path', format('/admin/plano-acao/%s/monitoramento', v_item.recommendation_id)
          ),
          v_key
        ) on conflict (dedupe_key) do nothing;
      end loop;
    end if;
  end loop;

  return jsonb_build_object('queued', v_created);
end;
$$;

create or replace function public.notify_organization_respondents(
  p_organization_id uuid,
  p_kind text,
  p_title text,
  p_message text,
  p_action_path text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_key text;
  v_created integer := 0;
  v_inserted integer := 0;
begin
  if p_organization_id is null then
    return 0;
  end if;

  for v_profile in
    select p.user_id, au.email
    from public.profiles p
    left join auth.users au on au.id = p.user_id
    where p.organization_id = p_organization_id
      and p.role = 'respondent'
  loop
    v_key := format('%s:user:%s', p_dedupe_key, v_profile.user_id);

    insert into public.user_notifications (
      user_id, kind, title, message, action_path, dedupe_key
    ) values (
      v_profile.user_id,
      p_kind,
      p_title,
      p_message,
      p_action_path,
      v_key
    ) on conflict do nothing;
    get diagnostics v_inserted = row_count;
    v_created := v_created + v_inserted;

    insert into public.notification_outbox (
      recipient_user_id, recipient_email, kind, payload, dedupe_key
    ) values (
      v_profile.user_id,
      v_profile.email,
      p_kind,
      p_payload || jsonb_build_object(
        'action_path', p_action_path,
        'organization_id', p_organization_id
      ),
      v_key
    ) on conflict (dedupe_key) do nothing;
  end loop;

  return v_created;
end;
$$;

create or replace function public.notify_administrators(
  p_kind text,
  p_title text,
  p_message text,
  p_action_path text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_key text;
  v_created integer := 0;
  v_inserted integer := 0;
begin
  for v_profile in
    select p.user_id, au.email
    from public.profiles p
    left join auth.users au on au.id = p.user_id
    where p.role = 'admin'
  loop
    v_key := format('%s:user:%s', p_dedupe_key, v_profile.user_id);

    insert into public.user_notifications (
      user_id, kind, title, message, action_path, dedupe_key
    ) values (
      v_profile.user_id,
      p_kind,
      p_title,
      p_message,
      p_action_path,
      v_key
    ) on conflict do nothing;
    get diagnostics v_inserted = row_count;
    v_created := v_created + v_inserted;

    insert into public.notification_outbox (
      recipient_user_id, recipient_email, kind, payload, dedupe_key
    ) values (
      v_profile.user_id,
      v_profile.email,
      p_kind,
      p_payload || jsonb_build_object('action_path', p_action_path),
      v_key
    ) on conflict (dedupe_key) do nothing;
  end loop;

  return v_created;
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
        'A avaliação do diagnóstico %s foi encerrada. O resultado permanece disponível e o relatório oficial poderá ser consultado após a emissão.',
        v_period
      ),
      format('/respondente/relatorios?cycleId=%s', new.id),
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

create or replace function public.notify_action_plan_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_recommendation_id uuid;
  v_organization_id uuid;
  v_kind text;
  v_title text;
  v_message text;
  v_event_at timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.action_text is not distinct from old.action_text
       and new.due_date is not distinct from old.due_date
       and new.responsible_user_id is not distinct from old.responsible_user_id
       and new.responsible_label is not distinct from old.responsible_label
       and new.status is not distinct from old.status
       and new.cancel_reason is not distinct from old.cancel_reason
       and new.execution_notes is not distinct from old.execution_notes then
      return new;
    end if;
  end if;

  v_plan_id := case when tg_op = 'DELETE' then old.id else new.id end;
  v_recommendation_id := case
    when tg_op = 'DELETE' then old.recommendation_id
    else new.recommendation_id
  end;
  v_event_at := case
    when tg_op = 'DELETE' then clock_timestamp()
    else coalesce(new.updated_at, new.created_at, clock_timestamp())
  end;

  select c.organization_id into v_organization_id
  from public.recommendations r
  join public.cycles c on c.id = r.cycle_id
  where r.id = v_recommendation_id;

  if v_organization_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    v_kind := 'action_plan_created';
    v_title := 'Nova ação cadastrada';
    v_message := 'A organização cadastrou uma nova ação no plano.';
  elsif tg_op = 'DELETE' then
    v_kind := 'action_plan_deleted';
    v_title := 'Ação removida do plano';
    v_message := 'A organização removeu uma ação do plano.';
  elsif new.status = 'done'::public.action_plan_status
        and old.status is distinct from new.status then
    v_kind := 'action_plan_completed';
    v_title := 'Ação do plano concluída';
    v_message := 'A organização marcou uma ação do plano como concluída.';
  else
    v_kind := 'action_plan_updated';
    v_title := 'Ação do plano atualizada';
    v_message := 'A organização atualizou uma ação do plano.';
  end if;

  perform public.notify_administrators(
    v_kind,
    v_title,
    v_message,
    format('/admin/plano-acao/%s/monitoramento', v_recommendation_id),
    format('action-plan-change:%s:%s:at:%s', v_plan_id, lower(tg_op), v_event_at),
    jsonb_build_object(
      'action_id', v_plan_id,
      'recommendation_id', v_recommendation_id,
      'organization_id', v_organization_id,
      'operation', lower(tg_op)
    )
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function public.notify_supervision_note()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_responsible_user_id uuid;
  v_kind text;
  v_title text;
  v_message text;
begin
  if new.author_role <> 'admin'::public.app_user_role then
    return new;
  end if;

  select c.organization_id, ap.responsible_user_id
    into v_organization_id, v_responsible_user_id
  from public.recommendations r
  join public.cycles c on c.id = r.cycle_id
  left join public.action_plans ap on ap.id = new.action_plan_id
  where r.id = new.recommendation_id;

  if v_organization_id is null then
    return new;
  end if;

  v_kind := case
    when new.note_type = 'adjustment_request' then 'action_plan_adjustment_requested'
    when new.note_type = 'approval' then 'action_plan_supervision_accepted'
    when new.note_type = 'pending' then 'action_plan_supervision_pending'
    else 'action_plan_supervision_note'
  end;
  v_title := case
    when new.note_type = 'adjustment_request' then 'Ajuste solicitado em uma ação'
    when new.note_type = 'approval' then 'Execução da ação aceita pela supervisão'
    when new.note_type = 'pending' then 'Pendência registrada em uma ação'
    else 'Novo registro da supervisão'
  end;
  v_message := case
    when new.note_type = 'approval' then
      new.body || format(E'\n\nAceite válido para a revisão %s da ação. Uma alteração posterior exige nova análise.', new.action_revision)
    else new.body
  end;

  if v_responsible_user_id is not null then
    perform public.notify_respondent_user(
      v_responsible_user_id,
      v_kind,
      v_title,
      v_message,
      format('/respondente/plano-acao/%s/monitoramento', new.recommendation_id),
      format('supervision-note:%s', new.id),
      jsonb_build_object(
        'note_id', new.id,
        'recommendation_id', new.recommendation_id,
        'action_plan_id', new.action_plan_id,
        'action_revision', new.action_revision,
        'note_type', new.note_type,
        'lifecycle_status', new.lifecycle_status,
        'recorded_at', new.created_at
      )
    );
  else
    perform public.notify_organization_respondents(
      v_organization_id,
      v_kind,
      v_title,
      v_message,
      format('/respondente/plano-acao/%s/monitoramento', new.recommendation_id),
      format('supervision-note:%s', new.id),
      jsonb_build_object(
        'note_id', new.id,
        'recommendation_id', new.recommendation_id,
        'action_plan_id', new.action_plan_id,
        'action_revision', new.action_revision,
        'note_type', new.note_type,
        'lifecycle_status', new.lifecycle_status,
        'recorded_at', new.created_at
      )
    );
  end if;

  return new;
end;
$$;

create or replace function public.notify_supervision_request_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_responsible_user_id uuid;
begin
  if new.lifecycle_status = old.lifecycle_status then
    return new;
  end if;

  select c.organization_id, ap.responsible_user_id
    into v_organization_id, v_responsible_user_id
  from public.recommendations r
  join public.cycles c on c.id = r.cycle_id
  left join public.action_plans ap on ap.id = new.action_plan_id
  where r.id = new.recommendation_id;

  if new.lifecycle_status = 'acknowledged'::public.supervision_note_lifecycle_status then
    perform public.notify_administrators(
      'action_plan_supervision_acknowledged',
      'Organização informou o ajuste realizado',
      coalesce(new.response_body, 'A organização informou atendimento à solicitação.'),
      format('/admin/plano-acao/%s/monitoramento', new.recommendation_id),
      format('supervision-note-ack:%s', new.id),
      jsonb_build_object('note_id', new.id, 'organization_id', v_organization_id, 'action_plan_id', new.action_plan_id)
    );
  elsif new.lifecycle_status = 'superseded'::public.supervision_note_lifecycle_status
        and new.note_type = 'approval' then
    if v_responsible_user_id is not null then
      perform public.notify_respondent_user(
        v_responsible_user_id,
        'action_plan_supervision_reanalysis_required',
        'A ação precisa de nova análise da supervisão',
        'A ação foi alterada depois do aceite. Conclua os ajustes necessários e aguarde um novo parecer.',
        format('/respondente/plano-acao/%s/monitoramento', new.recommendation_id),
        format('supervision-note-superseded:%s', new.id),
        jsonb_build_object('note_id', new.id, 'action_plan_id', new.action_plan_id, 'action_revision', new.action_revision)
      );
    else
      perform public.notify_organization_respondents(
        v_organization_id,
        'action_plan_supervision_reanalysis_required',
        'A ação precisa de nova análise da supervisão',
        'A ação foi alterada depois do aceite. Conclua os ajustes necessários e aguarde um novo parecer.',
        format('/respondente/plano-acao/%s/monitoramento', new.recommendation_id),
        format('supervision-note-superseded:%s', new.id),
        jsonb_build_object('note_id', new.id, 'action_plan_id', new.action_plan_id, 'action_revision', new.action_revision)
      );
    end if;
  elsif new.lifecycle_status in (
    'resolved'::public.supervision_note_lifecycle_status,
    'cancelled'::public.supervision_note_lifecycle_status
  ) then
    if v_responsible_user_id is not null then
      perform public.notify_respondent_user(
        v_responsible_user_id,
        'action_plan_supervision_decided',
        case when new.lifecycle_status = 'resolved' then 'Solicitação confirmada como resolvida' else 'Solicitação cancelada pela supervisão' end,
        coalesce(new.resolution_body, 'A supervisão registrou uma decisão.'),
        format('/respondente/plano-acao/%s/monitoramento', new.recommendation_id),
        format('supervision-note-decision:%s:%s', new.id, new.lifecycle_status),
        jsonb_build_object('note_id', new.id, 'action_plan_id', new.action_plan_id, 'lifecycle_status', new.lifecycle_status)
      );
    else
      perform public.notify_organization_respondents(
        v_organization_id,
        'action_plan_supervision_decided',
        case when new.lifecycle_status = 'resolved' then 'Solicitação confirmada como resolvida' else 'Solicitação cancelada pela supervisão' end,
        coalesce(new.resolution_body, 'A supervisão registrou uma decisão.'),
        format('/respondente/plano-acao/%s/monitoramento', new.recommendation_id),
        format('supervision-note-decision:%s:%s', new.id, new.lifecycle_status),
        jsonb_build_object('note_id', new.id, 'action_plan_id', new.action_plan_id, 'lifecycle_status', new.lifecycle_status)
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.notify_report_emission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_period text;
begin
  -- Defesa em profundidade: a notificação só existe quando a reserva foi
  -- efetivamente finalizada. Inserções em `preparing`, atualizações repetidas
  -- ou documentos legados não disparam aviso antecipado.
  if tg_op <> 'UPDATE'
     or old.status is distinct from 'preparing'
     or new.status is distinct from 'completed' then
    return new;
  end if;

  select c.organization_id,
         coalesce(nullif(btrim(c.period_label), ''), 'atual')
    into v_organization_id, v_period
  from public.cycles c
  where c.id = new.cycle_id;

  if v_organization_id is null then
    return new;
  end if;

  perform public.notify_organization_respondents(
    v_organization_id,
    'official_report_available',
    case when new.emission_version = 1
      then 'Relatório oficial disponível'
      else format('Nova emissão do relatório disponível — versão %s', new.emission_version)
    end,
    case when new.emission_version = 1
      then format('O relatório oficial do diagnóstico %s já pode ser consultado.', v_period)
      else format('A versão %s do relatório oficial do diagnóstico %s já pode ser consultada.', new.emission_version, v_period)
    end,
    format('/respondente/relatorios?cycleId=%s', new.cycle_id),
    format('official-report:%s', new.id),
    jsonb_build_object(
      'report_id', new.id,
      'cycle_id', new.cycle_id,
      'cycle_processing_id', new.cycle_processing_id,
      'emission_version', new.emission_version,
      'status', new.status
    )
  );

  return new;
end;
$$;

create or replace function public.notify_respondent_user(
  p_user_id uuid,
  p_kind text,
  p_title text,
  p_message text,
  p_action_path text,
  p_dedupe_key text,
  p_payload jsonb default '{}'::jsonb
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_key text;
  v_inserted integer := 0;
begin
  if p_user_id is null then
    return 0;
  end if;

  select au.email into v_email
  from auth.users au
  where au.id = p_user_id;

  v_key := format('%s:user:%s', p_dedupe_key, p_user_id);

  insert into public.user_notifications (
    user_id, kind, title, message, action_path, dedupe_key
  ) values (
    p_user_id,
    p_kind,
    p_title,
    p_message,
    p_action_path,
    v_key
  ) on conflict do nothing;
  get diagnostics v_inserted = row_count;

  insert into public.notification_outbox (
    recipient_user_id, recipient_email, kind, payload, dedupe_key
  ) values (
    p_user_id,
    v_email,
    p_kind,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('action_path', p_action_path),
    v_key
  ) on conflict (dedupe_key) do nothing;

  return v_inserted;
end;
$$;

create or replace function public.notify_respondent_open_cycles(
  p_user_id uuid,
  p_organization_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle record;
  v_period text;
  v_created integer := 0;
begin
  if p_user_id is null or p_organization_id is null then
    return 0;
  end if;

  for v_cycle in
    select c.id, c.period_label, c.reopen_count
    from public.cycles c
    where c.organization_id = p_organization_id
      and c.state = 'in_response'::public.cycle_state
  loop
    v_period := coalesce(nullif(btrim(v_cycle.period_label), ''), 'atual');
    v_created := v_created + public.notify_respondent_user(
      p_user_id,
      'diagnostic_opened',
      'Diagnóstico aberto para resposta',
      format('O diagnóstico %s está disponível para preenchimento.', v_period),
      format('/respondente/ciclos/%s', v_cycle.id),
      format('diagnostic-opened:%s:reopen:%s', v_cycle.id, v_cycle.reopen_count),
      jsonb_build_object(
        'cycle_id', v_cycle.id,
        'period_label', v_cycle.period_label,
        'organization_id', p_organization_id,
        'source', 'respondent_org_link'
      )
    );
  end loop;

  return v_created;
end;
$$;

create or replace function public.profiles_notify_open_cycles()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from 'respondent' then
    return new;
  end if;
  if new.organization_id is null then
    return new;
  end if;

  if tg_op = 'UPDATE'
     and old.role = 'respondent'
     and old.organization_id is not distinct from new.organization_id then
    return new;
  end if;

  perform public.notify_respondent_open_cycles(new.user_id, new.organization_id);
  return new;
end;
$$;

create or replace function public.list_admin_users_page(
  p_search text default null,
  p_organization_id uuid default null,
  p_role public.app_user_role default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role public.app_user_role,
  organization_id uuid,
  created_at timestamptz,
  total_count bigint
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    p.user_id,
    au.email,
    p.full_name,
    p.role,
    p.organization_id,
    p.created_at,
    count(*) over() as total_count
  from public.profiles p
  join auth.users au on au.id = p.user_id
  left join public.organizations o on o.id = p.organization_id
  where (p_organization_id is null or p.organization_id = p_organization_id)
    and (p_role is null or p.role = p_role)
    and (
      nullif(btrim(p_search), '') is null
      or concat_ws(' ', p.full_name, au.email, o.name, o.acronym)
        ilike '%' || btrim(p_search) || '%'
    )
  order by p.created_at desc, p.user_id desc
  limit greatest(1, least(coalesce(p_limit, 25), 200))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.list_organization_respondents(
  p_organization_id uuid
)
returns table (
  user_id uuid,
  email text,
  full_name text
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    p.user_id,
    au.email,
    p.full_name
  from public.profiles p
  join auth.users au on au.id = p.user_id
  where p.organization_id = p_organization_id
    and p.role = 'respondent'::public.app_user_role
  order by
    coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(au.email), ''), p.user_id::text),
    p.user_id;
$$;



create or replace function public.list_evidences_page(
  p_search text default null,
  p_status text default null,
  p_pending_only boolean default false,
  p_cycle_id uuid default null,
  p_organization_id uuid default null,
  p_form_id uuid default null,
  p_question_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_ids uuid[] default null,
  p_limit integer default 50,
  p_offset integer default 0,
  p_exclude_status text default null,
  p_axis_name text default null,
  p_section_name text default null
)
returns table (
  id uuid,
  response_id uuid,
  cycle_id uuid,
  cycle_state public.cycle_state,
  period_label text,
  organization_id uuid,
  organization_name text,
  form_id uuid,
  form_name text,
  form_version integer,
  question_id uuid,
  question_prompt text,
  axis_name text,
  section_name text,
  evidence_parameter jsonb,
  kind public.evidence_kind,
  title text,
  text_body text,
  storage_path text,
  external_link text,
  link_reason text,
  original_filename text,
  submitted_at timestamptz,
  submitted_by uuid,
  validation_status public.evidence_validation_status,
  validation_justification text,
  validated_at timestamptz,
  validated_by uuid,
  current_status text,
  total_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    ev.id,
    ev.response_id,
    ev.cycle_id,
    ev.cycle_state,
    ev.period_label,
    ev.organization_id,
    ev.organization_name,
    ev.form_id,
    ev.form_name,
    ev.form_version,
    ev.question_id,
    ev.question_prompt,
    ev.axis_name,
    ev.section_name,
    ev.evidence_parameter,
    ev.kind,
    ev.title,
    ev.text_body,
    ev.storage_path,
    ev.external_link,
    ev.link_reason,
    ev.original_filename,
    ev.submitted_at,
    ev.submitted_by,
    ev.validation_status,
    ev.validation_justification,
    ev.validated_at,
    ev.validated_by,
    ev.current_status,
    count(*) over() as total_count
  from public.evidence_operational_view ev
  where (p_cycle_id is null or ev.cycle_id = p_cycle_id)
    and (p_organization_id is null or ev.organization_id = p_organization_id)
    and (p_form_id is null or ev.form_id = p_form_id)
    and (p_question_id is null or ev.question_id = p_question_id)
    and (p_from is null or ev.submitted_at >= p_from)
    and (p_to is null or ev.submitted_at <= p_to)
    and (p_ids is null or cardinality(p_ids) = 0 or ev.id = any(p_ids))
    and (nullif(btrim(p_status), '') is null or ev.current_status = p_status)
    and (
      nullif(btrim(p_exclude_status), '') is null
      or ev.current_status is distinct from btrim(p_exclude_status)
    )
    and (
      not coalesce(p_pending_only, false)
      or ev.current_status in ('pending', 'adjustment_requested', 'submitted')
    )
    and (
      nullif(btrim(p_search), '') is null
      or ev.search_document ilike '%' || btrim(p_search) || '%'
    )
    and (
      nullif(btrim(p_axis_name), '') is null
      or ev.axis_name = btrim(p_axis_name)
    )
    and (
      nullif(btrim(p_section_name), '') is null
      or ev.section_name = btrim(p_section_name)
    )
  order by ev.submitted_at desc, ev.id desc
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.get_evidence_metrics(
  p_search text default null,
  p_status text default null,
  p_pending_only boolean default false,
  p_cycle_id uuid default null,
  p_organization_id uuid default null,
  p_form_id uuid default null,
  p_question_id uuid default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_ids uuid[] default null,
  p_axis_name text default null,
  p_section_name text default null
)
returns table (
  total bigint,
  aguardando_envio bigint,
  aguardando_validacao bigint,
  ajuste_solicitado bigint,
  aprovadas bigint,
  nao_aprovadas bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*)::bigint,
    count(*) filter (where ev.current_status = 'pending')::bigint,
    count(*) filter (where ev.current_status = 'submitted')::bigint,
    count(*) filter (where ev.current_status = 'adjustment_requested')::bigint,
    count(*) filter (where ev.current_status = 'approved')::bigint,
    count(*) filter (where ev.current_status = 'invalidated')::bigint
  from public.evidence_operational_view ev
  where (p_cycle_id is null or ev.cycle_id = p_cycle_id)
    and (p_organization_id is null or ev.organization_id = p_organization_id)
    and (p_form_id is null or ev.form_id = p_form_id)
    and (p_question_id is null or ev.question_id = p_question_id)
    and (p_from is null or ev.submitted_at >= p_from)
    and (p_to is null or ev.submitted_at <= p_to)
    and (p_ids is null or cardinality(p_ids) = 0 or ev.id = any(p_ids))
    and (nullif(btrim(p_status), '') is null or ev.current_status = p_status)
    and (
      not coalesce(p_pending_only, false)
      or ev.current_status in ('pending', 'adjustment_requested', 'submitted')
    )
    and (
      nullif(btrim(p_search), '') is null
      or ev.search_document ilike '%' || btrim(p_search) || '%'
    )
    and (
      nullif(btrim(p_axis_name), '') is null
      or ev.axis_name = btrim(p_axis_name)
    )
    and (
      nullif(btrim(p_section_name), '') is null
      or ev.section_name = btrim(p_section_name)
    );
$$;

create or replace function public.list_respondent_evidence_filter_options(
  p_organization_id uuid
)
returns table (
  cycle_id uuid,
  form_id uuid,
  form_name text,
  period_label text
)
language sql
security definer
set search_path = public
stable
as $$
  select distinct
    c.id,
    fv.form_id,
    f.name,
    c.period_label
  from public.evidences e
  join public.responses r on r.id = e.response_id
  join public.cycles c on c.id = r.cycle_id
  join public.form_versions fv on fv.id = c.form_version_id
  join public.forms f on f.id = fv.form_id
  where e.deactivated_at is null
    and c.organization_id = p_organization_id
  order by f.name, c.period_label desc, c.id;
$$;

create or replace function public.get_action_plan_status_metrics(
  p_organization_id uuid default null
)
returns table (status public.action_plan_status, total bigint)
language sql
security definer
set search_path = public
stable
as $$
  select ap.status, count(*)::bigint
  from public.action_plans ap
  join public.recommendations r on r.id = ap.recommendation_id
  join public.cycles c on c.id = r.cycle_id
  where p_organization_id is null or c.organization_id = p_organization_id
  group by ap.status
  order by ap.status;
$$;

create or replace function public.claim_automation_jobs(
  p_worker_id text,
  p_kinds text[] default null,
  p_limit integer default 10,
  p_lock_timeout interval default interval '15 minutes'
)
returns setof public.automation_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(p_worker_id), '') is null then
    raise exception 'worker_id_required' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select j.id
    from public.automation_jobs j
    where (p_kinds is null or cardinality(p_kinds) = 0 or j.kind = any(p_kinds))
      and coalesce(j.scheduled_for, j.created_at) <= now()
      and (
        (j.status in ('pending', 'failed') and j.attempts < j.max_attempts)
        or (j.status = 'processing' and j.locked_at < now() - p_lock_timeout)
      )
    order by coalesce(j.scheduled_for, j.created_at), j.created_at, j.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 10), 50))
  )
  update public.automation_jobs j
  set status = 'processing',
      -- Um lock vencido representa tentativa sem desfecho. Mesmo quando ela
      -- já consumiu o contador máximo, precisa ser recuperável para o worker
      -- concluir ou marcar a falha terminal.
      attempts = least(j.attempts + 1, j.max_attempts),
      started_at = coalesce(j.started_at, now()),
      locked_at = now(),
      locked_by = btrim(p_worker_id),
      error_message = null
  from candidates c
  where j.id = c.id
  returning j.*;
end;
$$;

create or replace function public.claim_notification_outbox(
  p_worker_id text,
  p_limit integer default 20,
  p_lock_timeout interval default interval '10 minutes'
)
returns setof public.notification_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(btrim(p_worker_id), '') is null then
    raise exception 'worker_id_required' using errcode = '22023';
  end if;

  return query
  with candidates as (
    select o.id
    from public.notification_outbox o
    where o.scheduled_for <= now()
      and (
        (o.status in ('pending', 'failed') and o.attempts < o.max_attempts)
        or (o.status = 'processing' and o.locked_at < now() - p_lock_timeout)
      )
    order by o.scheduled_for, o.created_at, o.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 20), 100))
  )
  update public.notification_outbox o
  set status = 'processing',
      attempts = least(o.attempts + 1, o.max_attempts),
      locked_at = now(),
      locked_by = btrim(p_worker_id),
      last_error = null
  from candidates c
  where o.id = c.id
  returning o.*;
end;
$$;

create or replace function public.get_cycle_metrics(
  p_search text default null,
  p_organization_id uuid default null,
  p_form_id uuid default null,
  p_states public.cycle_state[] default null,
  p_period_label text default null,
  p_due_filter text default 'all'
)
returns table (total bigint, overdue bigint)
language sql
security definer
set search_path = public
stable
as $$
  with scoped as (
    select c.state, c.response_deadline_at
    from public.cycles c
    join public.organizations o on o.id = c.organization_id
    join public.form_versions fv on fv.id = c.form_version_id
    join public.forms f on f.id = fv.form_id
    where (p_organization_id is null or c.organization_id = p_organization_id)
      and (p_form_id is null or fv.form_id = p_form_id)
      and (p_states is null or cardinality(p_states) = 0 or c.state = any(p_states))
      and (nullif(btrim(p_period_label), '') is null or c.period_label = btrim(p_period_label))
      and (
        coalesce(p_due_filter, 'all') = 'all'
        or (p_due_filter = 'overdue' and c.state in ('in_response', 'awaiting_adjustment') and c.response_deadline_at is not null and c.response_deadline_at < now())
        or (p_due_filter = 'in_response' and c.state in ('in_response', 'awaiting_adjustment'))
      )
      and (
        nullif(btrim(p_search), '') is null
        or concat_ws(' ', f.name, o.name, o.acronym, c.period_label)
          ilike '%' || btrim(p_search) || '%'
      )
  )
  select
    count(*)::bigint,
    count(*) filter (
      where state in ('in_response', 'awaiting_adjustment')
        and response_deadline_at is not null
        and response_deadline_at < now()
    )::bigint
  from scoped;
$$;

create or replace function public.list_recommendations_page(
  p_cycle_id uuid default null,
  p_organization_id uuid default null,
  p_form_id uuid default null,
  p_recommendation_id uuid default null,
  p_axis_id uuid default null,
  p_status text default null,
  p_type text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  recommendation_id uuid,
  cycle_id uuid,
  cycle_processing_id uuid,
  form_id uuid,
  form_name text,
  form_version integer,
  organization_id uuid,
  organization_name text,
  cycle_state public.cycle_state,
  period_label text,
  question_id uuid,
  question_prompt text,
  section_name text,
  axis_id uuid,
  axis_name text,
  recommendation_type text,
  source text,
  trigger text,
  origin_mode text,
  recommendation_text text,
  recommendation_status text,
  created_at timestamptz,
  has_action_plan boolean,
  total_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    rm.recommendation_id,
    rm.cycle_id,
    rm.cycle_processing_id,
    rm.form_id,
    rm.form_name,
    rm.form_version,
    rm.organization_id,
    rm.organization_name,
    rm.cycle_state,
    rm.period_label,
    rm.question_id,
    rm.question_prompt,
    rm.section_name,
    rm.axis_id,
    rm.axis_name,
    rm.recommendation_type,
    rm.source,
    nullif(rm.origin ->> 'trigger', ''),
    nullif(rm.origin ->> 'mode', ''),
    rm.recommendation_text,
    rm.recommendation_status,
    rm.recommendation_created_at,
    rm.has_action_plan,
    count(*) over() as total_count
  from public.current_recommendation_read_model rm
  where (p_cycle_id is null or rm.cycle_id = p_cycle_id)
    and (p_organization_id is null or rm.organization_id = p_organization_id)
    and (p_form_id is null or rm.form_id = p_form_id)
    and (p_recommendation_id is null or rm.recommendation_id = p_recommendation_id)
    and (p_axis_id is null or rm.axis_id = p_axis_id)
    and (nullif(btrim(p_status), '') is null or rm.recommendation_status = p_status)
    and (nullif(btrim(p_type), '') is null or rm.recommendation_type = p_type)
  order by rm.recommendation_created_at desc, rm.recommendation_id desc
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create function public.list_action_plan_recommendations_page(
  p_cycle_id uuid default null,
  p_organization_id uuid default null,
  p_form_id uuid default null,
  p_recommendation_id uuid default null,
  p_view text default 'overview',
  p_recommendation_status text default null,
  p_plan_status text default null,
  p_responsible_contains text default null,
  p_search text default null,
  p_due_filter text default 'all',
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  recommendation_id uuid,
  cycle_id uuid,
  cycle_state public.cycle_state,
  period_label text,
  form_id uuid,
  form_name text,
  form_version integer,
  organization_id uuid,
  organization_name text,
  question_id uuid,
  question_prompt text,
  section_id uuid,
  section_name text,
  section_order integer,
  axis_id uuid,
  axis_name text,
  question_order integer,
  recommendation_type text,
  recommendation_text text,
  recommendation_status text,
  recommendation_created_at timestamptz,
  action_plans jsonb,
  total_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    rm.recommendation_id,
    rm.cycle_id,
    rm.cycle_state,
    rm.period_label,
    rm.form_id,
    rm.form_name,
    rm.form_version,
    rm.organization_id,
    rm.organization_name,
    rm.question_id,
    rm.question_prompt,
    rm.section_id,
    rm.section_name,
    rm.section_order,
    rm.axis_id,
    rm.axis_name,
    rm.question_order,
    rm.recommendation_type,
    rm.recommendation_text,
    rm.recommendation_status,
    rm.recommendation_created_at,
    rm.action_plans,
    count(*) over() as total_count
  from public.current_recommendation_read_model rm
  where (p_cycle_id is null or rm.cycle_id = p_cycle_id)
    and (p_organization_id is null or rm.organization_id = p_organization_id)
    and (p_form_id is null or rm.form_id = p_form_id)
    and (p_recommendation_id is null or rm.recommendation_id = p_recommendation_id)
    and (
      nullif(btrim(p_recommendation_status), '') is null
      or rm.recommendation_status = p_recommendation_status
    )
    and (
      nullif(btrim(p_search), '') is null
      or rm.recommendation_text ilike '%' || btrim(p_search) || '%'
      or rm.question_prompt ilike '%' || btrim(p_search) || '%'
    )
    and (
      nullif(btrim(p_responsible_contains), '') is null
      or exists (
        select 1
        from jsonb_array_elements(rm.action_plans) plan
        where coalesce(plan ->> 'responsible_label', '')
          ilike '%' || btrim(p_responsible_contains) || '%'
      )
    )
    and (
      coalesce(p_view, 'overview') = 'overview'
      or (p_view = 'backlog' and not exists (
        select 1 from jsonb_array_elements(rm.action_plans) plan
        where plan ->> 'status' = 'doing'
      ))
      or (p_view = 'in_progress' and exists (
        select 1 from jsonb_array_elements(rm.action_plans) plan
        where plan ->> 'status' = 'doing'
      ))
      or (p_view = 'completed' and exists (
        select 1 from jsonb_array_elements(rm.action_plans) plan
        where plan ->> 'status' = 'done'
      ))
      or (p_view = 'overdue' and exists (
        select 1 from jsonb_array_elements(rm.action_plans) plan
        where (plan ->> 'due_date')::date < current_date
          and plan ->> 'status' not in ('done', 'cancelled')
      ))
    )
    and (
      coalesce(p_view, 'overview') <> 'overview'
      or nullif(btrim(p_plan_status), '') is null
      or exists (
        select 1 from jsonb_array_elements(rm.action_plans) plan
        where plan ->> 'status' = case p_plan_status
          when 'not_started' then 'todo'
          when 'in_progress' then 'doing'
          when 'completed' then 'done'
          else p_plan_status
        end
      )
    )
    and (
      coalesce(p_due_filter, 'all') = 'all'
      or p_view = 'backlog'
      or (p_due_filter = 'overdue' and exists (
        select 1 from jsonb_array_elements(rm.action_plans) plan
        where (plan ->> 'due_date')::date < current_date
          and plan ->> 'status' not in ('done', 'cancelled')
      ))
      or (p_due_filter = 'due_7d' and exists (
        select 1 from jsonb_array_elements(rm.action_plans) plan
        where (plan ->> 'due_date')::date between current_date and current_date + 7
          and plan ->> 'status' not in ('done', 'cancelled')
      ))
    )
  order by
    case rm.axis_name
      when 'Governanca' then 0
      when 'Ambiental' then 1
      when 'Social' then 2
      else 3
    end,
    rm.section_order,
    rm.question_order,
    rm.recommendation_id
  limit greatest(1, least(coalesce(p_limit, 50), 200))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.list_form_answer_respondents_page(
  p_form_id uuid,
  p_organization_id uuid default null,
  p_status text default null,
  p_from timestamptz default null,
  p_to timestamptz default null,
  p_cursor_updated_at timestamptz default null,
  p_cursor_cycle_id uuid default null,
  p_limit integer default 25
)
returns table (
  cycle_id uuid,
  organization_id uuid,
  organization_name text,
  period_label text,
  answered_questions integer,
  total_questions integer,
  last_updated_at timestamptz,
  respondent_status text,
  contributor_count integer
)
language sql
security definer
set search_path = public
stable
as $$
  select
    rm.cycle_id,
    rm.organization_id,
    rm.organization_name,
    rm.period_label,
    rm.answered_questions,
    rm.total_questions,
    rm.last_updated_at,
    rm.respondent_status,
    rm.contributor_count
  from public.form_answer_cycle_read_model rm
  where rm.form_id = p_form_id
    and (p_organization_id is null or rm.organization_id = p_organization_id)
    and (nullif(btrim(p_status), '') is null or rm.respondent_status = p_status)
    and (p_from is null or rm.last_updated_at >= p_from)
    and (p_to is null or rm.last_updated_at <= p_to)
    and (
      p_cursor_updated_at is null
      or rm.last_updated_at < p_cursor_updated_at
      or (
        rm.last_updated_at = p_cursor_updated_at
        and p_cursor_cycle_id is not null
        and rm.cycle_id > p_cursor_cycle_id
      )
    )
  order by rm.last_updated_at desc, rm.cycle_id asc
  limit greatest(1, least(coalesce(p_limit, 25), 100)) + 1;
$$;

create or replace function public.get_form_answers_overview(p_form_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with form_data as (
    select f.id, f.name, f.current_form_version_id
    from public.forms f
    where f.id = p_form_id
  ), current_questions as (
    select count(*)::bigint as total_questions
    from form_data fd
    join public.form_questions fq on fq.form_version_id = fd.current_form_version_id
  ), scoped as (
    select *
    from public.form_answer_cycle_read_model rm
    where rm.form_id = p_form_id
  ), totals as (
    select
      count(distinct organization_id) filter (where answered_questions > 0)::bigint
        as total_respondents,
      count(*)::bigint as total_cycles,
      max(last_updated_at) filter (where answered_questions > 0) as last_answer_at,
      count(*) filter (where respondent_status = 'nao_iniciada')::bigint as nao_iniciada,
      count(*) filter (where respondent_status = 'em_preenchimento')::bigint as em_preenchimento,
      count(*) filter (where respondent_status = 'completa')::bigint as completa,
      count(*) filter (where respondent_status = 'submetida')::bigint as submetida,
      count(*) filter (where respondent_status = 'em_complementacao')::bigint
        as em_complementacao
    from scoped
  )
  select jsonb_build_object(
    'formId', fd.id,
    'formName', fd.name,
    'totalRespondents', totals.total_respondents,
    'totalCycles', totals.total_cycles,
    'totalQuestions', current_questions.total_questions,
    'lastAnswerAt', totals.last_answer_at,
    'statusBreakdown', jsonb_build_object(
      'nao_iniciada', totals.nao_iniciada,
      'em_preenchimento', totals.em_preenchimento,
      'completa', totals.completa,
      'submetida', totals.submetida,
      'em_complementacao', totals.em_complementacao
    )
  )
  from form_data fd cross join current_questions cross join totals;
$$;

create or replace function public.get_form_answers_summary(p_form_id uuid)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with form_data as (
    select current_form_version_id
    from public.forms
    where id = p_form_id
  ), questions as (
    select
      qv.question_id,
      fq.order_index,
      qv.prompt
    from form_data fd
    join public.form_questions fq on fq.form_version_id = fd.current_form_version_id
    join public.question_versions qv on qv.id = fq.question_version_id
  ), scoped_responses as (
    select
      qv.question_id,
      c.organization_id,
      r.answer
    from public.responses r
    join public.cycles c on c.id = r.cycle_id
    join public.form_versions fv on fv.id = c.form_version_id
    join public.question_versions qv on qv.id = r.question_version_id
    where fv.form_id = p_form_id
      and qv.question_id in (select question_id from questions)
  ), totals as (
    select count(distinct organization_id)::bigint as total_respondents
    from scoped_responses
  ), question_stats as (
    select
      q.question_id,
      q.order_index,
      q.prompt,
      count(sr.question_id)::bigint as total_responses,
      count(*) filter (where sr.answer = 'yes')::bigint as yes_count,
      count(*) filter (where sr.answer = 'no')::bigint as no_count,
      count(*) filter (where sr.answer = 'not_applicable')::bigint
        as not_applicable_count
    from questions q
    left join scoped_responses sr on sr.question_id = q.question_id
    group by q.question_id, q.order_index, q.prompt
  )
  select jsonb_build_object(
    'formId', p_form_id,
    'totalRespondents', totals.total_respondents,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'questionId', qs.question_id,
        'orderIndex', qs.order_index,
        'prompt', qs.prompt,
        'answerType', 'yes_no',
        'totalResponses', qs.total_responses,
        'distribution', jsonb_build_object(
          'yes', qs.yes_count,
          'no', qs.no_count,
          'not_applicable', qs.not_applicable_count
        )
      ) order by qs.order_index)
      from question_stats qs
    ), '[]'::jsonb)
  )
  from totals;
$$;

create or replace function public.list_form_answer_organization_options(p_form_id uuid)
returns table (id uuid, name text)
language sql
security definer
set search_path = public
stable
as $$
  select distinct rm.organization_id, rm.organization_name
  from public.form_answer_cycle_read_model rm
  where rm.form_id = p_form_id
  order by rm.organization_name, rm.organization_id;
$$;

create or replace function public.get_admin_recommendation_monitoring_page(
  p_organization_id uuid default null,
  p_form_id uuid default null,
  p_cycle_id uuid default null,
  p_axis_id uuid default null,
  p_status text default null,
  p_search text default null,
  p_from date default null,
  p_to date default null,
  p_card_filter text default null,
  p_layout text default 'list',
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with base as (
    select
      rm.*,
      display_plan.id as display_plan_id,
      display_plan.status as display_plan_status,
      display_plan.due_date as display_due_date,
      display_plan.responsible_label as display_responsible_label,
      display_plan.updated_at as display_updated_at,
      case
        when display_plan.status = 'todo' then 'not_started'
        when display_plan.status = 'doing' then 'in_progress'
        when display_plan.status = 'done' then 'completed'
        when display_plan.status = 'cancelled' then 'cancelled'
        else null
      end as display_plan_status_ui,
      coalesce(display_plan.due_date < current_date
        and display_plan.status not in ('done', 'cancelled'), false) as is_overdue,
      coalesce(display_plan.due_date between current_date and current_date + 7
        and display_plan.status not in ('done', 'cancelled'), false) as is_due_soon,
      case
        when jsonb_array_length(rm.action_plans) = 0 then 0
        else coalesce((
          select round(avg((plan ->> 'progress_percentage')::numeric))::integer
          from jsonb_array_elements(rm.action_plans) plan
          where plan ->> 'status' is distinct from 'cancelled'
        ), 0)
      end as progress
    from public.current_recommendation_read_model rm
    left join lateral (
      select ap.id, ap.status, ap.due_date, ap.responsible_label, ap.updated_at,
             ap.progress_percentage
      from public.action_plans ap
      where ap.recommendation_id = rm.recommendation_id
      order by
        case when ap.status in ('done', 'cancelled') then 1 else 0 end,
        ap.updated_at desc,
        ap.id desc
      limit 1
    ) display_plan on true
  ), normal as (
    select *
    from base b
    where (p_organization_id is null or b.organization_id = p_organization_id)
      and (p_form_id is null or b.form_id = p_form_id)
      and (p_cycle_id is null or b.cycle_id = p_cycle_id)
      and (p_axis_id is null or b.axis_id = p_axis_id)
      and (nullif(btrim(p_status), '') is null or b.recommendation_status = p_status)
      and (
        p_from is null
        or timezone('America/Recife', coalesce(b.display_updated_at, b.recommendation_created_at))::date >= p_from
      )
      and (
        p_to is null
        or timezone('America/Recife', coalesce(b.display_updated_at, b.recommendation_created_at))::date <= p_to
      )
      and (
        nullif(btrim(p_search), '') is null
        or concat_ws(
          ' ', b.recommendation_text, b.question_prompt, b.axis_name,
          b.section_name, b.organization_name, b.form_name,
          b.display_responsible_label
        ) ilike '%' || btrim(p_search) || '%'
      )
  ), summary as (
    select
      count(*)::bigint as total,
      count(*) filter (where not has_action_plan and recommendation_status = 'generated')::bigint as without_plan,
      count(*) filter (where has_action_plan)::bigint as with_plan,
      count(*) filter (
        where recommendation_status in ('in_action_plan', 'adjustment_requested', 'awaiting_approval', 'exception_requested')
          or display_plan_status = 'doing'
      )::bigint as in_execution,
      count(*) filter (where recommendation_status = 'completed')::bigint as completed,
      count(*) filter (where is_overdue)::bigint as overdue
    from normal
  ), filtered as (
    select *
    from normal n
    where nullif(btrim(p_card_filter), '') is null
      or (p_card_filter = 'without_plan' and not n.has_action_plan and n.recommendation_status = 'generated')
      or (
        p_card_filter = 'executing'
        and (n.recommendation_status in ('in_action_plan', 'adjustment_requested', 'awaiting_approval', 'exception_requested') or n.display_plan_status = 'doing')
      )
      or (p_card_filter = 'completed' and n.recommendation_status = 'completed')
      or (p_card_filter = 'overdue' and n.is_overdue)
  ), organization_page as (
    select organization_id
    from filtered
    group by organization_id, organization_name
    order by organization_name, organization_id
    limit greatest(1, least(coalesce(p_page_size, 10), 100))
    offset (greatest(coalesce(p_page, 1), 1) - 1)
      * greatest(1, least(coalesce(p_page_size, 10), 100))
  ), selected as (
    select f.*
    from filtered f
    where (
      coalesce(p_layout, 'list') = 'organization'
      and f.organization_id in (select organization_id from organization_page)
    ) or coalesce(p_layout, 'list') <> 'organization'
    order by
      case when coalesce(p_layout, 'list') = 'organization' then f.organization_name end,
      case f.axis_name
        when 'Governanca' then 0
        when 'Ambiental' then 1
        when 'Social' then 2
        else 3
      end,
      f.section_order,
      f.question_order,
      f.recommendation_id
    limit case
      when coalesce(p_layout, 'list') = 'organization' then 2147483647
      else greatest(1, least(coalesce(p_page_size, 10), 100))
    end
    offset case
      when coalesce(p_layout, 'list') = 'organization' then 0
      else (greatest(coalesce(p_page, 1), 1) - 1)
        * greatest(1, least(coalesce(p_page_size, 10), 100))
    end
  ), counts as (
    select
      count(*)::bigint as total,
      count(distinct organization_id)::bigint as organization_total
    from filtered
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'recommendation_id', s.recommendation_id,
        'cycle_id', s.cycle_id,
        'cycle_state', s.cycle_state,
        'period_label', s.period_label,
        'form_id', s.form_id,
        'form_name', s.form_name,
        'form_version', s.form_version,
        'organization_id', s.organization_id,
        'organization_name', s.organization_name,
        'question_id', s.question_id,
        'question_prompt', s.question_prompt,
        'section_id', s.section_id,
        'section_name', s.section_name,
        'section_order', s.section_order,
        'axis_id', s.axis_id,
        'axis_name', s.axis_name,
        'question_order', s.question_order,
        'recommendation_type', s.recommendation_type,
        'recommendation_text', s.recommendation_text,
        'recommendation_status', s.recommendation_status,
        'recommendation_created_at', s.recommendation_created_at,
        'action_plans', s.action_plans
      ) order by
        s.organization_name,
        case s.axis_name
          when 'Governanca' then 0
          when 'Ambiental' then 1
          when 'Social' then 2
          else 3
        end,
        s.section_order,
        s.question_order,
        s.recommendation_id
      )
      from selected s
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'total', summary.total,
      'withoutPlan', summary.without_plan,
      'withPlan', summary.with_plan,
      'inExecution', summary.in_execution,
      'completed', summary.completed,
      'overdue', summary.overdue
    ),
    'total', counts.total,
    'paginationTotal', case
      when coalesce(p_layout, 'list') = 'organization' then counts.organization_total
      else counts.total
    end,
    'page', greatest(coalesce(p_page, 1), 1),
    'pageSize', greatest(1, least(coalesce(p_page_size, 10), 100)),
    'totalPages', greatest(1, ceil((case
      when coalesce(p_layout, 'list') = 'organization' then counts.organization_total
      else counts.total
    end)::numeric / greatest(1, least(coalesce(p_page_size, 10), 100)))::integer),
    'layout', case when p_layout = 'organization' then 'organization' else 'list' end,
    'selectedCycleLabel', case when p_cycle_id is null then null else (
      select concat(f.name, ' · ', coalesce(c.period_label, 'Período informado'))
      from public.cycles c
      join public.form_versions fv on fv.id = c.form_version_id
      join public.forms f on f.id = fv.form_id
      where c.id = p_cycle_id
    ) end
  )
  from summary cross join counts;
$$;

create or replace function public.get_admin_action_plan_monitoring_page(
  p_organization_id uuid default null,
  p_form_id uuid default null,
  p_cycle_id uuid default null,
  p_view text default null,
  p_search text default null,
  p_from date default null,
  p_to date default null,
  p_card_filter text default null,
  p_layout text default 'list',
  p_page integer default 1,
  p_page_size integer default 10
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with flat as (
    select
      rm.*,
      ap.id as plan_id,
      ap.action_text,
      ap.due_date,
      ap.responsible_label,
      ap.progress_percentage,
      ap.status as plan_status,
      ap.execution_notes,
      ap.updated_at,
      ap.revision,
      count(ap.id) over (partition by rm.recommendation_id)::integer as action_count
    from public.current_recommendation_read_model rm
    join public.action_plans ap on ap.recommendation_id = rm.recommendation_id
  ), shaped as (
    select
      f.*,
      case
        when f.due_date < current_date and f.plan_status not in ('done', 'cancelled') then 'overdue'
        when f.plan_status = 'todo' then 'not_started'
        when f.plan_status = 'doing' then 'in_progress'
        when f.plan_status = 'done' then 'completed'
        when f.plan_status = 'cancelled' then 'cancelled'
        else 'not_started'
      end as plan_view,
      coalesce(f.due_date < current_date
        and f.plan_status not in ('done', 'cancelled'), false) as is_overdue,
      coalesce(f.due_date between current_date and current_date + 7
        and f.plan_status not in ('done', 'cancelled'), false) as is_due_soon,
      coalesce(f.progress_percentage, 0) as progress,
      case
        when f.plan_status = 'done' then 0
        when f.plan_status = 'cancelled' then 10
        else least(100,
          (case when f.due_date < current_date then 40
            when f.due_date between current_date and current_date + 7 then 15
            else 0 end)
          + (case when f.updated_at < now() - interval '14 days' then 20 else 0 end)
          + (case when coalesce(f.progress_percentage, 0) = 0 then 20 else 0 end)
          + (case when nullif(btrim(coalesce(f.responsible_label, '')), '') is null then 10 else 0 end)
        )
      end as risk_score
    from flat f
  ), normal as (
    select *
    from shaped s
    where (p_organization_id is null or s.organization_id = p_organization_id)
      and (p_form_id is null or s.form_id = p_form_id)
      and (p_cycle_id is null or s.cycle_id = p_cycle_id)
      and (nullif(btrim(p_view), '') is null or s.plan_view = p_view)
      and (p_from is null or s.due_date >= p_from)
      and (p_to is null or s.due_date <= p_to)
      and (
        nullif(btrim(p_search), '') is null
        or concat_ws(
          ' ', s.action_text, s.recommendation_text, s.question_prompt,
          s.axis_name, s.section_name, s.organization_name, s.form_name,
          s.responsible_label
        ) ilike '%' || btrim(p_search) || '%'
      )
  ), summary as (
    select
      count(*)::bigint as total,
      count(*) filter (where plan_status in ('todo', 'doing'))::bigint as in_progress,
      count(*) filter (where plan_status = 'done')::bigint as completed,
      count(*) filter (where is_overdue)::bigint as overdue,
      count(*) filter (
        where nullif(btrim(coalesce(responsible_label, '')), '') is null
      )::bigint as without_responsible,
      count(*) filter (where is_due_soon)::bigint as due_soon,
      count(*) filter (where risk_score >= 60)::bigint as high_risk,
      count(*) filter (where progress <= 25)::bigint as low_progress
    from normal
  ), filtered as (
    select *
    from normal n
    where nullif(btrim(p_card_filter), '') is null
      or (p_card_filter = 'in_progress' and n.plan_view in ('in_progress', 'not_started'))
      or (p_card_filter = 'completed' and n.plan_view = 'completed')
      or (p_card_filter = 'overdue' and n.is_overdue)
  ), organization_page as (
    select organization_id
    from filtered
    group by organization_id, organization_name
    order by organization_name, organization_id
    limit greatest(1, least(coalesce(p_page_size, 10), 100))
    offset (greatest(coalesce(p_page, 1), 1) - 1)
      * greatest(1, least(coalesce(p_page_size, 10), 100))
  ), selected as (
    select f.*
    from filtered f
    where (
      coalesce(p_layout, 'list') = 'organization'
      and f.organization_id in (select organization_id from organization_page)
    ) or coalesce(p_layout, 'list') <> 'organization'
    order by
      case when coalesce(p_layout, 'list') = 'organization' then f.organization_name end,
      f.recommendation_created_at desc,
      f.recommendation_id desc,
      f.updated_at desc nulls last,
      f.plan_id desc nulls last
    limit case
      when coalesce(p_layout, 'list') = 'organization' then 2147483647
      else greatest(1, least(coalesce(p_page_size, 10), 100))
    end
    offset case
      when coalesce(p_layout, 'list') = 'organization' then 0
      else (greatest(coalesce(p_page, 1), 1) - 1)
        * greatest(1, least(coalesce(p_page_size, 10), 100))
    end
  ), counts as (
    select
      count(*)::bigint as total,
      count(distinct organization_id)::bigint as organization_total
    from filtered
  )
  select jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'recommendation_id', s.recommendation_id,
        'cycle_id', s.cycle_id,
        'cycle_state', s.cycle_state,
        'period_label', s.period_label,
        'form_id', s.form_id,
        'form_name', s.form_name,
        'form_version', s.form_version,
        'organization_id', s.organization_id,
        'organization_name', s.organization_name,
        'question_id', s.question_id,
        'question_prompt', s.question_prompt,
        'section_id', s.section_id,
        'section_name', s.section_name,
        'axis_id', s.axis_id,
        'axis_name', s.axis_name,
        'recommendation_type', s.recommendation_type,
        'recommendation_text', s.recommendation_text,
        'recommendation_status', s.recommendation_status,
        'recommendation_created_at', s.recommendation_created_at,
        'plan_id', s.plan_id,
        'action_text', s.action_text,
        'due_date', s.due_date,
        'responsible_label', s.responsible_label,
        'progress_percentage', s.progress_percentage,
        'plan_status', s.plan_status,
        'execution_notes', s.execution_notes,
        'updated_at', s.updated_at,
        'revision', s.revision,
        'action_count', s.action_count
      ) order by s.organization_name, s.recommendation_created_at desc,
        s.recommendation_id desc, s.updated_at desc nulls last, s.plan_id desc nulls last)
      from selected s
    ), '[]'::jsonb),
    'summary', jsonb_build_object(
      'total', summary.total,
      'inProgress', summary.in_progress,
      'completed', summary.completed,
      'overdue', summary.overdue,
      'withoutResponsible', summary.without_responsible,
      'dueSoon', summary.due_soon,
      'highRisk', summary.high_risk,
      'lowProgress', summary.low_progress
    ),
    'total', counts.total,
    'paginationTotal', case
      when coalesce(p_layout, 'list') = 'organization' then counts.organization_total
      else counts.total
    end,
    'page', greatest(coalesce(p_page, 1), 1),
    'pageSize', greatest(1, least(coalesce(p_page_size, 10), 100)),
    'totalPages', greatest(1, ceil((case
      when coalesce(p_layout, 'list') = 'organization' then counts.organization_total
      else counts.total
    end)::numeric / greatest(1, least(coalesce(p_page_size, 10), 100)))::integer),
    'layout', case when p_layout = 'organization' then 'organization' else 'list' end,
    'selectedCycleLabel', case when p_cycle_id is null then null else (
      select concat(f.name, ' · ', coalesce(c.period_label, 'Período informado'))
      from public.cycles c
      join public.form_versions fv on fv.id = c.form_version_id
      join public.forms f on f.id = fv.form_id
      where c.id = p_cycle_id
    ) end
  )
  from summary cross join counts;
$$;

create or replace function public.list_open_recommendations_without_plan(
  p_organization_id uuid default null,
  p_limit integer default 8,
  p_offset integer default 0
)
returns table (id uuid, text text, status text, total_count bigint)
language sql
security definer
set search_path = public
stable
as $$
  select
    rm.recommendation_id,
    rm.recommendation_text,
    rm.recommendation_status,
    count(*) over()
  from public.current_recommendation_read_model rm
  where (p_organization_id is null or rm.organization_id = p_organization_id)
    and rm.recommendation_status = 'generated'
    and not rm.has_action_plan
  order by rm.recommendation_created_at desc, rm.recommendation_id desc
  limit greatest(1, least(coalesce(p_limit, 8), 100))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

create or replace function public.validate_evidences_batch(
  p_cycle_id uuid,
  p_items jsonb,
  p_action text,
  p_actor_user_id uuid,
  p_justification text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_evidence_id uuid;
  v_expected_status text;
  v_expected_validated_at timestamptz;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
  v_error text;
  v_error_code text;
begin
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 200 then
    raise exception 'invalid_batch_size' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_evidence_id := null;
    begin
      v_evidence_id := (v_item ->> 'id')::uuid;
      v_expected_status := nullif(v_item ->> 'status', '');
      v_expected_validated_at := nullif(v_item ->> 'validatedAt', '')::timestamptz;

      v_result := public.validate_evidence(
        v_evidence_id,
        p_cycle_id,
        p_action,
        p_actor_user_id,
        p_justification,
        v_expected_status,
        v_expected_validated_at
      );
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'id', v_evidence_id,
        'status', 'succeeded',
        'result', v_result
      ));
    exception when others then
      get stacked diagnostics v_error = message_text;
      raise warning 'validate_evidences_batch failed for evidence %: %',
        coalesce(v_evidence_id::text, v_item ->> 'id'), v_error;
      v_error_code := case
        when v_error like 'validation_conflict%' then 'validation_conflict'
        when v_error like 'evidence_not_found%' then 'evidence_not_found'
        when v_error like 'evidence_not_in_cycle%' then 'evidence_not_in_cycle'
        when v_error like 'justification_required%' then 'justification_required'
        when v_error like 'cycle_not_in_validation%' then 'cycle_not_in_validation'
        when v_error like 'invalid_action%' then 'invalid_action'
        else 'validation_failed'
      end;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'id', coalesce(v_evidence_id::text, v_item ->> 'id'),
        'status', 'failed',
        'code', v_error_code
      ));
    end;
  end loop;

  return jsonb_build_object('results', v_results);
end;
$$;

create or replace function public.validate_not_applicable_batch(
  p_cycle_id uuid,
  p_items jsonb,
  p_action text,
  p_actor_user_id uuid,
  p_rejection_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_response_id uuid;
  v_expected_status text;
  v_expected_validated_at timestamptz;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
  v_error text;
  v_error_code text;
begin
  if jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0
     or jsonb_array_length(p_items) > 200 then
    raise exception 'invalid_batch_size' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(p_items) loop
    v_response_id := null;
    begin
      v_response_id := (v_item ->> 'id')::uuid;
      v_expected_status := nullif(v_item ->> 'status', '');
      v_expected_validated_at := nullif(v_item ->> 'validatedAt', '')::timestamptz;

      v_result := public.validate_not_applicable_response(
        v_response_id,
        p_cycle_id,
        p_action,
        p_actor_user_id,
        p_rejection_reason,
        v_expected_status,
        v_expected_validated_at
      );
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'id', v_response_id,
        'status', 'succeeded',
        'result', v_result
      ));
    exception when others then
      get stacked diagnostics v_error = message_text;
      raise warning 'validate_not_applicable_batch failed for response %: %',
        coalesce(v_response_id::text, v_item ->> 'id'), v_error;
      v_error_code := case
        when v_error like 'validation_conflict%' then 'validation_conflict'
        when v_error like 'response_not_found%' then 'response_not_found'
        when v_error like 'response_not_in_cycle%' then 'response_not_in_cycle'
        when v_error like 'response_not_reviewable_na%' then 'response_not_reviewable_na'
        when v_error like 'na_rejection_reason_required%' then 'na_rejection_reason_required'
        when v_error like 'cycle_not_in_validation%' then 'cycle_not_in_validation'
        when v_error like 'invalid_action%' then 'invalid_action'
        else 'validation_failed'
      end;
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'id', coalesce(v_response_id::text, v_item ->> 'id'),
        'status', 'failed',
        'code', v_error_code
      ));
    end;
  end loop;

  return jsonb_build_object('results', v_results);
end;
$$;

create or replace function public.get_automation_queue_metrics()
returns table (
  pending_jobs bigint,
  processing_jobs bigint,
  failed_jobs bigint,
  oldest_pending_job_at timestamptz,
  pending_notifications bigint,
  processing_notifications bigint,
  failed_notifications bigint,
  oldest_pending_notification_at timestamptz,
  average_job_duration_ms numeric
)
language sql
security definer
set search_path = public
stable
as $$
  select
    count(*) filter (where j.status = 'pending')::bigint,
    count(*) filter (where j.status = 'processing')::bigint,
    count(*) filter (where j.status = 'failed')::bigint,
    min(coalesce(j.scheduled_for, j.created_at)) filter (where j.status = 'pending'),
    (select count(*) from public.notification_outbox o where o.status = 'pending')::bigint,
    (select count(*) from public.notification_outbox o where o.status = 'processing')::bigint,
    (select count(*) from public.notification_outbox o where o.status = 'failed')::bigint,
    (select min(o.scheduled_for) from public.notification_outbox o where o.status = 'pending'),
    avg(j.last_duration_ms) filter (
      where j.last_duration_ms is not null
        and j.updated_at >= now() - interval '24 hours'
    )
  from public.automation_jobs j;
$$;

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_row public.api_rate_limits%rowtype;
begin
  if nullif(btrim(p_bucket_key), '') is null
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid_rate_limit_arguments' using errcode = '22023';
  end if;

  insert into public.api_rate_limits (
    bucket_key, window_started_at, hit_count, expires_at, updated_at
  ) values (
    p_bucket_key, v_now, 1, v_now + make_interval(secs => p_window_seconds), v_now
  )
  on conflict (bucket_key) do update
  set window_started_at = case
        when public.api_rate_limits.expires_at <= v_now then v_now
        else public.api_rate_limits.window_started_at
      end,
      hit_count = case
        when public.api_rate_limits.expires_at <= v_now then 1
        else public.api_rate_limits.hit_count + 1
      end,
      expires_at = case
        when public.api_rate_limits.expires_at <= v_now
          then v_now + make_interval(secs => p_window_seconds)
        else public.api_rate_limits.expires_at
      end,
      updated_at = v_now
  returning * into v_row;

  return query select
    v_row.hit_count <= p_limit,
    greatest(p_limit - v_row.hit_count, 0),
    case when v_row.hit_count <= p_limit then 0
      else greatest(ceil(extract(epoch from (v_row.expires_at - v_now)))::integer, 1)
    end;
end;
$$;

create or replace function public.cleanup_operational_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_limits integer;
  v_payloads integer;
  v_jobs integer;
  v_outbox integer;
  v_notifications integer;
begin
  delete from public.api_rate_limits where expires_at < now() - interval '1 day';
  get diagnostics v_limits = row_count;

  update public.automation_job_items i
  set input = '{}'::jsonb,
      output = case
        when i.entity_type in ('respondent_import_row', 'organization_import_row')
          then jsonb_strip_nulls(jsonb_build_object(
            'identity', i.output ->> 'identity',
            'created_id', i.output ->> 'created_id'
          ))
        else i.output
      end
  from public.automation_jobs j
  where j.id = i.job_id
    and j.status in ('completed', 'completed_with_errors', 'failed', 'cancelled')
    and j.completed_at < now() - interval '1 hour'
    and (i.input <> '{}'::jsonb or i.output ?| array['recovery_link','password','senha','senha_provisoria']);
  get diagnostics v_payloads = row_count;

  delete from public.automation_jobs
  where status in ('completed', 'completed_with_errors', 'failed', 'cancelled')
    and completed_at < now() - interval '30 days';
  get diagnostics v_jobs = row_count;

  delete from public.notification_outbox
  where status in ('sent', 'failed', 'cancelled')
    and updated_at < now() - interval '30 days';
  get diagnostics v_outbox = row_count;

  delete from public.user_notifications
  where read_at is not null
    and read_at < now() - interval '180 days';
  get diagnostics v_notifications = row_count;

  return jsonb_build_object(
    'rate_limits_removed', v_limits,
    'job_payloads_sanitized', v_payloads,
    'jobs_removed', v_jobs,
    'outbox_rows_removed', v_outbox,
    'read_notifications_removed', v_notifications
  );
end;
$$;

create or replace function public.list_organizations_page(
  p_search text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  acronym text,
  created_at timestamptz,
  user_count bigint,
  respondent_count bigint,
  total_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    o.id, o.name, o.acronym, o.created_at,
    count(p.user_id)::bigint as user_count,
    count(p.user_id) filter (where p.role = 'respondent')::bigint as respondent_count,
    count(*) over()::bigint as total_count
  from public.organizations o
  left join public.profiles p on p.organization_id = o.id
  where nullif(btrim(p_search), '') is null
     or lower(o.name) like '%' || lower(btrim(p_search)) || '%'
     or lower(o.acronym) like '%' || lower(btrim(p_search)) || '%'
  group by o.id
  order by o.name asc, o.id asc
  limit least(greatest(p_limit, 1), 500)
  offset greatest(p_offset, 0);
$$;

create or replace function public.list_forms_page(
  p_state text default null,
  p_search text default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  id uuid,
  name text,
  version integer,
  publication_state text,
  created_at timestamptz,
  question_count bigint,
  published_at timestamptz,
  total_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  with summarized as (
    select
      f.id,
      f.name,
      fv.version,
      coalesce(fv.state::text, 'draft') as publication_state,
      f.created_at,
      count(fdq.question_id)::bigint as question_count,
      fv.published_at
    from public.forms f
    left join public.form_versions fv on fv.id = f.current_form_version_id
    left join public.form_drafts fd on fd.form_id = f.id
    left join public.form_draft_questions fdq on fdq.form_draft_id = fd.id
    where nullif(btrim(p_search), '') is null
       or lower(f.name) like '%' || lower(btrim(p_search)) || '%'
    group by f.id, fv.id
  )
  select
    s.id, s.name, s.version, s.publication_state, s.created_at,
    s.question_count, s.published_at, count(*) over()::bigint
  from summarized s
  where nullif(btrim(p_state), '') is null or s.publication_state = p_state
  order by s.created_at desc, s.id desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

create or replace function public.list_recommendation_types()
returns table (type text)
language sql
security definer
set search_path = public
stable
as $$
  select distinct r.tipo::text as type
  from public.recommendations r
  order by type asc;
$$;

create or replace function public.list_form_assignments_page(
  p_form_ids uuid[],
  p_limit integer default 500,
  p_offset integer default 0
)
returns table (
  form_id uuid,
  organization_id uuid,
  total_count bigint
)
language sql
security definer
set search_path = public
stable
as $$
  select
    fa.form_id,
    fa.organization_id,
    count(*) over()::bigint as total_count
  from public.form_assignments fa
  where fa.form_id = any(coalesce(p_form_ids, array[]::uuid[]))
  order by fa.form_id asc, fa.organization_id asc
  limit least(greatest(p_limit, 1), 500)
  offset greatest(p_offset, 0);
$$;

create or replace function public.discard_pending_evidence_upload(
  p_pending_upload_id uuid,
  p_cycle_id uuid,
  p_organization_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending public.pending_evidence_uploads%rowtype;
begin
  select * into v_pending
  from public.pending_evidence_uploads
  where id = p_pending_upload_id
  for update;

  if not found then
    raise exception 'pending_evidence_upload_not_found' using errcode = 'P0002';
  end if;

  if v_pending.cycle_id <> p_cycle_id
     or v_pending.organization_id <> p_organization_id
     or v_pending.uploaded_by <> p_actor_user_id then
    raise exception 'pending_evidence_upload_scope_mismatch' using errcode = '42501';
  end if;

  insert into public.evidence_storage_cleanup_queue(storage_path)
  values (v_pending.storage_path)
  on conflict (storage_path) do update
  set scheduled_for = least(
        public.evidence_storage_cleanup_queue.scheduled_for,
        excluded.scheduled_for
      );

  delete from public.pending_evidence_uploads
  where id = v_pending.id;

  return jsonb_build_object('storagePath', v_pending.storage_path);
end;
$$;

create or replace function public.cycles_normalize_reference_period()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_years integer[];
begin
  if new.reference_start_year is null and new.reference_end_year is null then
    select array_agg(distinct (m)[1]::integer order by (m)[1]::integer)
    into v_years
    from regexp_matches(coalesce(new.period_label, ''), '((19|20|21)[0-9]{2})', 'g') as m;

    if coalesce(array_length(v_years, 1), 0) = 1 then
      new.reference_start_year := v_years[1];
      new.reference_end_year := v_years[1];
    elsif coalesce(array_length(v_years, 1), 0) >= 2 then
      new.reference_start_year := v_years[1];
      new.reference_end_year := v_years[array_length(v_years, 1)];
    end if;
  elsif new.reference_start_year is null or new.reference_end_year is null then
    raise exception 'cycle_reference_period_incomplete' using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.bump_action_plan_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid;
begin
  for v_cycle_id in
    select distinct r.cycle_id
    from public.recommendations r
    where r.id = any(array[
      case when tg_op in ('UPDATE', 'DELETE') then old.recommendation_id else null end,
      case when tg_op in ('INSERT', 'UPDATE') then new.recommendation_id else null end
    ])
    order by r.cycle_id
  loop
    update public.cycles
    set action_plan_revision = action_plan_revision + 1
    where id = v_cycle_id;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.apply_cycle_reference_period_to_batch_result(
  p_result jsonb,
  p_reference_start_year integer,
  p_reference_end_year integer,
  p_mutable_statuses text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item jsonb;
  v_cycle public.cycles%rowtype;
  v_result jsonb := '[]'::jsonb;
  v_status text;
  v_cycle_id uuid;
begin
  if p_reference_start_year not between 1900 and 2199
     or p_reference_end_year not between p_reference_start_year and 2199 then
    raise exception 'cycle_reference_period_invalid' using errcode = '22023';
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_result, '[]'::jsonb))
  loop
    v_status := v_item ->> 'status';
    v_cycle_id := nullif(v_item #>> '{cycle,id}', '')::uuid;
    if v_cycle_id is not null and v_status = any(p_mutable_statuses) then
      update public.cycles
      set reference_start_year = p_reference_start_year,
          reference_end_year = p_reference_end_year
      where id = v_cycle_id
      returning * into v_cycle;
      v_item := jsonb_set(v_item, '{cycle}', to_jsonb(v_cycle), true);
    end if;
    v_result := v_result || jsonb_build_array(v_item);
  end loop;
  return v_result;
end;
$$;

create or replace function public.create_cycles_batch_with_reference(
  p_form_id uuid,
  p_organization_ids uuid[],
  p_period_label text,
  p_reference_start_year integer,
  p_reference_end_year integer,
  p_actor_user_id uuid,
  p_starts_at timestamptz default null,
  p_response_deadline_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := public.create_cycles_batch(
    p_form_id, p_organization_ids, p_period_label, p_actor_user_id,
    p_starts_at, p_response_deadline_at
  );
  return public.apply_cycle_reference_period_to_batch_result(
    v_result, p_reference_start_year, p_reference_end_year,
    array['created', 'existing_draft']::text[]
  );
end;
$$;

create or replace function public.create_or_open_cycles_batch_with_reference(
  p_form_id uuid,
  p_organization_ids uuid[],
  p_period_label text,
  p_reference_start_year integer,
  p_reference_end_year integer,
  p_actor_user_id uuid,
  p_starts_at timestamptz,
  p_response_deadline_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  v_result := public.create_or_open_cycles_batch(
    p_form_id, p_organization_ids, p_period_label, p_actor_user_id,
    p_starts_at, p_response_deadline_at
  );
  return public.apply_cycle_reference_period_to_batch_result(
    v_result, p_reference_start_year, p_reference_end_year,
    array['created_and_opened', 'opened_existing']::text[]
  );
end;
$$;

create or replace function public.protect_cycle_report_reference_period()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reference_start_year is not distinct from old.reference_start_year
     and new.reference_end_year is not distinct from old.reference_end_year then
    return new;
  end if;

  if exists (
    select 1 from public.reports r
    where r.cycle_id = old.id and r.status in ('completed', 'legacy')
  ) then
    -- Exceção controlada para documentos legados que nunca tiveram referência
    -- estruturada. A primeira definição permite uma reemissão moderna; depois
    -- disso, qualquer mudança é bloqueada.
    if old.reference_start_year is null
       and old.reference_end_year is null
       and not exists (
         select 1 from public.reports r
         where r.cycle_id = old.id
           and (
             r.status = 'completed'
             or r.reference_start_year is not null
             or r.reference_end_year is not null
           )
       )
    then
      return new;
    end if;
    raise exception 'cycle_reference_period_locked' using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function public.protect_report_emission_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mode text := current_setting('app.report_mutation_mode', true);
begin
  if tg_op = 'UPDATE' then
    if old.status = 'preparing' and new.status = 'completed' and v_mode = 'finalize'
       and new.id = old.id
       and new.cycle_id = old.cycle_id
       and new.cycle_processing_id = old.cycle_processing_id
       and new.file_path = old.file_path
       and new.generated_by is not distinct from old.generated_by
       and new.generated_at = old.generated_at
       and new.emission_version = old.emission_version
       and new.supersedes_report_id is not distinct from old.supersedes_report_id
       and new.reissue_reason is not distinct from old.reissue_reason
       and new.action_plan_revision = old.action_plan_revision
       and new.reference_start_year = old.reference_start_year
       and new.reference_end_year = old.reference_end_year
       and new.generated_by_name is not distinct from old.generated_by_name
    then return new; end if;
    raise exception 'report_emission_immutable' using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then
    if old.status = 'preparing' and v_mode = 'cancel' then return old; end if;
    raise exception 'report_emission_immutable' using errcode = '55000';
  end if;

  return new;
end;
$$;

create or replace function public.reserve_report_emission(
  p_cycle_id uuid,
  p_cycle_processing_id uuid,
  p_generated_by uuid,
  p_expected_action_plan_revision bigint,
  p_generated_at timestamptz,
  p_reissue_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_processing public.cycle_processings%rowtype;
  v_latest public.reports%rowtype;
  v_report public.reports%rowtype;
  v_report_id uuid := gen_random_uuid();
  v_reason text := nullif(btrim(coalesce(p_reissue_reason, '')), '');
  v_actor_name text;
begin
  perform pg_advisory_xact_lock(hashtext(p_cycle_processing_id::text));

  select * into v_cycle from public.cycles where id = p_cycle_id for update;
  if not found then raise exception 'cycle_not_found' using errcode = 'P0002'; end if;
  select * into v_processing from public.cycle_processings
  where id = p_cycle_processing_id and cycle_id = p_cycle_id for update;
  if not found then raise exception 'cycle_processing_not_found' using errcode = 'P0002'; end if;

  if v_cycle.state <> 'completed'::public.cycle_state then
    raise exception 'cycle_not_completed' using errcode = 'P0001';
  end if;
  if v_processing.status <> 'completed'::public.cycle_processing_status then
    raise exception 'cycle_processing_not_completed' using errcode = 'P0001';
  end if;
  if v_cycle.reference_start_year is null or v_cycle.reference_end_year is null then
    raise exception 'cycle_reference_period_required' using errcode = 'P0001';
  end if;
  if v_cycle.action_plan_revision <> p_expected_action_plan_revision then
    raise exception 'report_action_plan_changed' using errcode = '40001';
  end if;

  select * into v_latest from public.reports
  where cycle_processing_id = p_cycle_processing_id and status in ('completed', 'legacy')
  order by emission_version desc limit 1 for update;
  if v_latest.id is not null and v_reason is null then
    raise exception 'reissue_reason_required' using errcode = 'P0001';
  end if;

  select nullif(btrim(full_name), '') into v_actor_name
  from public.profiles where user_id = p_generated_by;

  insert into public.reports (
    id, cycle_id, cycle_processing_id, file_path, generated_by, generated_by_name,
    generated_at, emission_version, supersedes_report_id, reissue_reason,
    status, action_plan_revision, reference_start_year, reference_end_year
  ) values (
    v_report_id,
    p_cycle_id,
    p_cycle_processing_id,
    format('%s/%s/%s/%s.pdf', v_cycle.organization_id, p_cycle_id, p_cycle_processing_id, v_report_id),
    p_generated_by,
    coalesce(v_actor_name, 'Administração da plataforma'),
    coalesce(p_generated_at, now()),
    coalesce(v_latest.emission_version, 0) + 1,
    v_latest.id,
    v_reason,
    'preparing',
    v_cycle.action_plan_revision,
    v_cycle.reference_start_year,
    v_cycle.reference_end_year
  ) returning * into v_report;

  return to_jsonb(v_report);
end;
$$;

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

  return to_jsonb(v_report);
end;
$$;

create or replace function public.cancel_report_emission(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_report public.reports%rowtype;
begin
  select * into v_report from public.reports where id = p_report_id for update;
  if not found then return; end if;
  if v_report.status <> 'preparing' then
    raise exception 'completed_report_cannot_be_cancelled' using errcode = '55000';
  end if;
  perform set_config('app.report_mutation_mode', 'cancel', true);
  delete from public.reports where id = p_report_id;
  perform set_config('app.report_mutation_mode', '', true);
end;
$$;

create or replace function public.protect_official_report_storage_object()
returns trigger
language plpgsql
security definer
set search_path = public, storage
as $$
begin
  if tg_op = 'UPDATE' and old.bucket_id = 'relatorios' and exists (
    select 1 from public.reports r
    where r.file_path = old.name and r.status in ('completed', 'legacy')
  ) then
    raise exception 'official_report_storage_object_immutable' using errcode = '55000';
  end if;

  if tg_op = 'DELETE' and old.bucket_id = 'relatorios' and exists (
    select 1 from public.reports r
    where r.file_path = old.name and r.status in ('completed', 'legacy')
  ) then
    raise exception 'official_report_storage_object_referenced' using errcode = '55000';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.enrich_response_snapshot_na_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select
    resp.na_justification,
    resp.na_validation_status,
    resp.na_rejection_reason
  into
    new.na_original_justification,
    new.na_validation_status,
    new.na_rejection_reason
  from public.cycle_processings cp
  join public.responses resp
    on resp.cycle_id = cp.cycle_id
   and resp.question_version_id = new.question_version_id
  where cp.id = new.cycle_processing_id;
  return new;
end;
$$;

create or replace function public.set_cycle_reference_period(
  p_cycle_id uuid,
  p_reference_start_year integer,
  p_reference_end_year integer,
  p_actor_user_id uuid
)
returns public.cycles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'cycle_reference_actor_not_authorized' using errcode = '42501';
  end if;
  if p_reference_start_year not between 1900 and 2199
     or p_reference_end_year not between p_reference_start_year and 2199 then
    raise exception 'cycle_reference_period_invalid' using errcode = '22023';
  end if;

  select * into v_cycle from public.cycles where id = p_cycle_id for update;
  if not found then raise exception 'cycle_not_found' using errcode = 'P0002'; end if;
  if exists (
    select 1 from public.reports r
    where r.cycle_id = p_cycle_id
      and (
        r.status = 'completed'
        or (
          r.status = 'legacy'
          and (r.reference_start_year is not null or r.reference_end_year is not null)
        )
      )
  ) then
    raise exception 'cycle_reference_period_locked' using errcode = '55000';
  end if;

  update public.cycles
  set reference_start_year = p_reference_start_year,
      reference_end_year = p_reference_end_year
  where id = p_cycle_id
  returning * into v_cycle;
  return v_cycle;
end;
$$;

create or replace function public.list_report_options_page(
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
    count(*) over()::bigint
  from latest l
  order by l.processed_at desc, l.cycle_id desc
  limit least(greatest(p_limit, 1), 200)
  offset greatest(p_offset, 0);
$$;

create or replace function public.ensure_respondent_profile_details_target()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = new.user_id
      and p.role = 'respondent'::public.app_user_role
      and p.organization_id is not null
  ) then
    raise exception 'respondent_profile_required'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create or replace function public.upsert_respondent_profile_details(
  p_target_user_id uuid,
  p_registration_number text,
  p_organizational_unit text,
  p_position_title text,
  p_source_submitted_at timestamptz,
  p_declaration_text text,
  p_source_name text,
  p_actor_user_id uuid
)
returns public.respondent_profile_details
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.respondent_profile_details;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
      and p.organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_target_user_id
      and p.role = 'respondent'::public.app_user_role
      and p.organization_id is not null
  ) then
    raise exception 'respondent_profile_not_found' using errcode = 'P0002';
  end if;

  if nullif(btrim(coalesce(p_source_name, '')), '') is null then
    raise exception 'source_name_required' using errcode = '22023';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  insert into public.respondent_profile_details as existing (
    user_id,
    registration_number,
    organizational_unit,
    position_title,
    source_submitted_at,
    declaration_text,
    source_name,
    updated_by
  ) values (
    p_target_user_id,
    nullif(btrim(coalesce(p_registration_number, '')), ''),
    nullif(btrim(coalesce(p_organizational_unit, '')), ''),
    nullif(btrim(coalesce(p_position_title, '')), ''),
    p_source_submitted_at,
    nullif(btrim(coalesce(p_declaration_text, '')), ''),
    btrim(p_source_name),
    p_actor_user_id
  )
  on conflict (user_id) do update set
    registration_number = excluded.registration_number,
    organizational_unit = excluded.organizational_unit,
    position_title = excluded.position_title,
    source_submitted_at = excluded.source_submitted_at,
    declaration_text = excluded.declaration_text,
    source_name = excluded.source_name,
    updated_by = excluded.updated_by
  where (
    existing.registration_number,
    existing.organizational_unit,
    existing.position_title,
    existing.source_submitted_at,
    existing.declaration_text,
    existing.source_name
  ) is distinct from (
    excluded.registration_number,
    excluded.organizational_unit,
    excluded.position_title,
    excluded.source_submitted_at,
    excluded.declaration_text,
    excluded.source_name
  )
  returning * into v_result;

  if v_result.id is null then
    select * into v_result
    from public.respondent_profile_details
    where user_id = p_target_user_id;
  end if;

  return v_result;
end;
$$;

create or replace function public.create_or_open_historical_cycle(
  p_form_id uuid,
  p_organization_id uuid,
  p_period_label text,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cycle public.cycles;
  v_created boolean := false;
  v_opened boolean := false;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
      and p.organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  if nullif(btrim(coalesce(p_period_label, '')), '') is null then
    raise exception 'invalid_period_label' using errcode = '22023';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  select c.* into v_cycle
  from public.cycles c
  join public.form_versions fv on fv.id = c.form_version_id
  where fv.form_id = p_form_id
    and c.organization_id = p_organization_id
    and c.period_label = btrim(p_period_label)
  order by c.created_at desc
  limit 1
  for update of c;

  if not found then
    begin
      select * into v_cycle
      from public.create_cycle(
        p_form_id,
        p_organization_id,
        btrim(p_period_label),
        p_actor_user_id,
        null,
        null
      );
      v_created := true;
    exception
      when unique_violation then
        select c.* into v_cycle
        from public.cycles c
        join public.form_versions fv on fv.id = c.form_version_id
        where fv.form_id = p_form_id
          and c.organization_id = p_organization_id
          and c.period_label = btrim(p_period_label)
        order by c.created_at desc
        limit 1
        for update of c;

        if not found then
          raise;
        end if;
    end;
  end if;

  if v_cycle.state = 'draft'::public.cycle_state then
    perform set_config('app.historical_import_mode', 'on', true);
    perform set_config('app.suppress_cycle_notifications', 'on', true);
    perform public.commit_cycle_transition(
      v_cycle.id,
      p_actor_user_id,
      'in_response'::public.cycle_state,
      null,
      null,
      'draft'::public.cycle_state
    );
    v_opened := true;

    select * into v_cycle
    from public.cycles
    where id = v_cycle.id;
  end if;

  if v_cycle.state not in (
    'in_response'::public.cycle_state,
    'submitted'::public.cycle_state,
    'in_validation'::public.cycle_state,
    'validated'::public.cycle_state,
    'completed'::public.cycle_state
  ) then
    raise exception 'historical_cycle_state_not_importable: %', v_cycle.state
      using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'status', case
      when v_created and v_opened then 'created_and_opened'
      when v_opened then 'opened_existing'
      else 'already_exists'
    end,
    'cycle', to_jsonb(v_cycle)
  );
end;
$$;

create or replace function public.advance_historical_cycle_to_validation(
  p_cycle_id uuid,
  p_respondent_user_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_cycle public.cycles;
  v_initial_state public.cycle_state;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
      and p.organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_respondent_user_id
      and p.role = 'respondent'::public.app_user_role
      and p.organization_id = v_cycle.organization_id
  ) then
    raise exception 'cycle_respondent_scope_mismatch' using errcode = '42501';
  end if;

  v_initial_state := v_cycle.state;
  perform set_config('app.suppress_cycle_notifications', 'on', true);

  if v_cycle.state = 'in_response'::public.cycle_state then
    perform public.commit_cycle_transition(
      v_cycle.id,
      p_respondent_user_id,
      'submitted'::public.cycle_state,
      null,
      null,
      'in_response'::public.cycle_state
    );

    select * into v_cycle from public.cycles where id = p_cycle_id;
  end if;

  if v_cycle.state = 'submitted'::public.cycle_state then
    perform public.commit_cycle_transition(
      v_cycle.id,
      p_actor_user_id,
      'in_validation'::public.cycle_state,
      null,
      null,
      'submitted'::public.cycle_state
    );

    select * into v_cycle from public.cycles where id = p_cycle_id;
  end if;

  if v_cycle.state not in (
    'in_validation'::public.cycle_state,
    'validated'::public.cycle_state,
    'completed'::public.cycle_state
  ) then
    raise exception 'historical_cycle_not_advanced: %', v_cycle.state
      using errcode = 'P0001';
  end if;

  return jsonb_build_object(
    'status', case
      when v_initial_state = v_cycle.state then 'already_advanced'
      else 'advanced'
    end,
    'from_state', v_initial_state,
    'cycle', to_jsonb(v_cycle)
  );
end;
$$;

create or replace function public.upsert_question_organization_waiver(
  p_organization_id uuid,
  p_question_id uuid,
  p_reason text,
  p_actor_user_id uuid
)
returns public.question_organization_waivers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_result public.question_organization_waivers;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
      and p.organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.organizations o where o.id = p_organization_id
  ) then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.questions q where q.id = p_question_id
  ) then
    raise exception 'question_not_found' using errcode = 'P0002';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'waiver_reason_required' using errcode = '22023';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  insert into public.question_organization_waivers as existing (
    organization_id,
    question_id,
    reason,
    waived_by,
    waived_at
  ) values (
    p_organization_id,
    p_question_id,
    btrim(p_reason),
    p_actor_user_id,
    now()
  )
  on conflict (organization_id, question_id) do update set
    reason = excluded.reason,
    waived_by = excluded.waived_by,
    waived_at = excluded.waived_at
  where existing.reason is distinct from excluded.reason
     or existing.waived_by is distinct from excluded.waived_by
  returning * into v_result;

  if v_result.id is null then
    select * into v_result
    from public.question_organization_waivers
    where organization_id = p_organization_id
      and question_id = p_question_id;
  end if;

  return v_result;
end;
$$;

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

create or replace function public.capture_cycle_submission_deadline()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_is_submission boolean;
  v_submission_at timestamptz;
begin
  v_is_submission := (
    (old.state = 'in_response'::public.cycle_state
      and new.state = 'submitted'::public.cycle_state)
    or
    (old.state = 'awaiting_adjustment'::public.cycle_state
      and new.state = 'in_validation'::public.cycle_state)
  );

  if not v_is_submission then
    return new;
  end if;

  -- Em um reenvio após ajuste, submitted_at ainda pode conter o primeiro envio.
  -- O prazo deve ser comparado com o instante desta transição oficial.
  v_submission_at := case
    when old.state = 'awaiting_adjustment'::public.cycle_state then now()
    else coalesce(new.submitted_at, now())
  end;
  new.submitted_at := v_submission_at;

  if new.response_deadline_at is not null
     and v_submission_at > new.response_deadline_at then
    new.submitted_late_at := v_submission_at;
    new.submission_delay_seconds := greatest(
      0,
      floor(extract(epoch from (v_submission_at - new.response_deadline_at)))::bigint
    );
  else
    new.submitted_late_at := null;
    new.submission_delay_seconds := null;
  end if;

  return new;
end;
$$;

create or replace function public.record_cycle_submission_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid;
  v_is_submission boolean;
begin
  v_is_submission := (
    (old.state = 'in_response'::public.cycle_state
      and new.state = 'submitted'::public.cycle_state)
    or
    (old.state = 'awaiting_adjustment'::public.cycle_state
      and new.state = 'in_validation'::public.cycle_state)
  );

  if not v_is_submission then
    return new;
  end if;

  v_actor := nullif(current_setting('app.actor_user_id', true), '')::uuid;
  if v_actor is null then
    v_actor := auth.uid();
  end if;

  insert into public.cycle_submission_events (
    cycle_id,
    actor_user_id,
    from_state,
    to_state,
    submitted_at,
    response_deadline_at,
    was_late,
    delay_seconds
  ) values (
    new.id,
    v_actor,
    old.state,
    new.state,
    coalesce(new.submitted_at, now()),
    new.response_deadline_at,
    new.submitted_late_at is not null,
    coalesce(new.submission_delay_seconds, 0)
  );

  return new;
end;
$$;

create or replace function public.cancel_cycle_schedule_jobs(
  p_cycle_id uuid,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelled_items integer := 0;
begin
  update public.automation_job_items item
  set status = 'skipped',
      message = left(coalesce(nullif(btrim(p_reason), ''), 'Cronograma cancelado.'), 1000)
  from public.automation_jobs job
  where item.job_id = job.id
    and item.entity_type = 'cycle'
    and item.entity_id = p_cycle_id::text
    and item.status in ('pending', 'processing')
    and job.kind in ('cycle_open', 'validation_finalize', 'cycle_close', 'reminder_dispatch');
  get diagnostics v_cancelled_items = row_count;

  update public.automation_jobs job
  set status = 'cancelled',
      completed_at = now(),
      error_message = left(coalesce(nullif(btrim(p_reason), ''), 'Cronograma cancelado.'), 1000),
      locked_at = null,
      locked_by = null
  where job.status in ('pending', 'processing')
    and job.kind in ('cycle_open', 'validation_finalize', 'cycle_close', 'reminder_dispatch')
    and exists (
      select 1 from public.automation_job_items item
      where item.job_id = job.id
        and item.entity_type = 'cycle'
        and item.entity_id = p_cycle_id::text
    )
    and not exists (
      select 1 from public.automation_job_items active_item
      where active_item.job_id = job.id
        and active_item.status in ('pending', 'processing')
    );

  return v_cancelled_items;
end;
$$;

create or replace function public.replace_cycle_schedule(
  p_cycle_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_job_id uuid;
  v_offset integer;
  v_scheduled_for timestamptz;
  v_jobs_created integer := 0;
  v_reminders_created integer := 0;
  v_cancelled_items integer := 0;
  v_dedupe text;
begin
  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;

  v_cancelled_items := public.cancel_cycle_schedule_jobs(
    p_cycle_id,
    format('Cronograma substituído pela revisão %s.', v_cycle.schedule_revision)
  );

  if v_cycle.state = 'draft'::public.cycle_state
     and v_cycle.starts_at is not null then
    v_scheduled_for := greatest(v_cycle.starts_at, now());
    v_dedupe := format(
      'cycle-schedule:%s:revision:%s:open:%s',
      v_cycle.id,
      v_cycle.schedule_revision,
      extract(epoch from v_scheduled_for)::bigint
    );

    insert into public.automation_jobs (
      kind, status, dedupe_key, requested_by, scheduled_for, max_attempts, payload
    ) values (
      'cycle_open', 'pending', v_dedupe, p_actor_user_id,
      v_scheduled_for, 25,
      jsonb_build_object('schedule_revision', v_cycle.schedule_revision)
    )
    on conflict (dedupe_key) do update
      set requested_by = excluded.requested_by
    returning id into v_job_id;

    insert into public.automation_job_items (
      job_id, entity_type, entity_id, idempotency_key, status, input
    ) values (
      v_job_id, 'cycle', v_cycle.id::text,
      format('cycle_open:%s:revision:%s', v_cycle.id, v_cycle.schedule_revision),
      'pending', jsonb_build_object('schedule_revision', v_cycle.schedule_revision)
    ) on conflict (job_id, entity_type, entity_id) do nothing;

    v_jobs_created := v_jobs_created + 1;
  end if;

  if v_cycle.state in ('draft'::public.cycle_state, 'in_response'::public.cycle_state)
     and v_cycle.response_deadline_at is not null then
    for v_offset in
      select distinct value
      from unnest(v_cycle.reminder_offsets_days) value
      where value >= 0
      order by value desc
    loop
      v_scheduled_for := v_cycle.response_deadline_at - make_interval(days => v_offset);
      if v_scheduled_for <= now() then
        continue;
      end if;

      v_dedupe := format(
        'cycle-schedule:%s:revision:%s:reminder:%s:offset:%s',
        v_cycle.id,
        v_cycle.schedule_revision,
        extract(epoch from v_scheduled_for)::bigint,
        v_offset
      );

      insert into public.automation_jobs (
        kind, status, dedupe_key, requested_by, scheduled_for, max_attempts, payload
      ) values (
        'reminder_dispatch', 'pending', v_dedupe, p_actor_user_id,
        v_scheduled_for, 5,
        jsonb_build_object(
          'offset_days', v_offset,
          'schedule_revision', v_cycle.schedule_revision
        )
      )
      on conflict (dedupe_key) do update
        set requested_by = excluded.requested_by
      returning id into v_job_id;

      insert into public.automation_job_items (
        job_id, entity_type, entity_id, idempotency_key, status, input
      ) values (
        v_job_id, 'cycle', v_cycle.id::text,
        format('reminder_dispatch:%s:revision:%s:offset:%s',
          v_cycle.id, v_cycle.schedule_revision, v_offset),
        'pending', jsonb_build_object('schedule_revision', v_cycle.schedule_revision)
      ) on conflict (job_id, entity_type, entity_id) do nothing;

      v_jobs_created := v_jobs_created + 1;
      v_reminders_created := v_reminders_created + 1;
    end loop;
  end if;

  if v_cycle.validation_deadline_at is not null
     and v_cycle.validation_deadline_at > now() then
    v_dedupe := format(
      'cycle-schedule:%s:revision:%s:validation:%s',
      v_cycle.id,
      v_cycle.schedule_revision,
      extract(epoch from v_cycle.validation_deadline_at)::bigint
    );
    insert into public.automation_jobs (
      kind, status, dedupe_key, requested_by, scheduled_for, max_attempts, payload
    ) values (
      'validation_finalize', 'pending', v_dedupe, p_actor_user_id,
      v_cycle.validation_deadline_at, 500,
      jsonb_build_object('schedule_revision', v_cycle.schedule_revision)
    )
    on conflict (dedupe_key) do update set requested_by = excluded.requested_by
    returning id into v_job_id;

    insert into public.automation_job_items (
      job_id, entity_type, entity_id, idempotency_key, status, input
    ) values (
      v_job_id, 'cycle', v_cycle.id::text,
      format('validation_finalize:%s:revision:%s', v_cycle.id, v_cycle.schedule_revision),
      'pending', jsonb_build_object('schedule_revision', v_cycle.schedule_revision)
    ) on conflict (job_id, entity_type, entity_id) do nothing;
    v_jobs_created := v_jobs_created + 1;
  end if;

  if v_cycle.cycle_close_at is not null
     and v_cycle.cycle_close_at > now() then
    v_dedupe := format(
      'cycle-schedule:%s:revision:%s:close:%s',
      v_cycle.id,
      v_cycle.schedule_revision,
      extract(epoch from v_cycle.cycle_close_at)::bigint
    );
    insert into public.automation_jobs (
      kind, status, dedupe_key, requested_by, scheduled_for, max_attempts, payload
    ) values (
      'cycle_close', 'pending', v_dedupe, p_actor_user_id,
      v_cycle.cycle_close_at, 500,
      jsonb_build_object('schedule_revision', v_cycle.schedule_revision)
    )
    on conflict (dedupe_key) do update set requested_by = excluded.requested_by
    returning id into v_job_id;

    insert into public.automation_job_items (
      job_id, entity_type, entity_id, idempotency_key, status, input
    ) values (
      v_job_id, 'cycle', v_cycle.id::text,
      format('cycle_close:%s:revision:%s', v_cycle.id, v_cycle.schedule_revision),
      'pending', jsonb_build_object('schedule_revision', v_cycle.schedule_revision)
    ) on conflict (job_id, entity_type, entity_id) do nothing;
    v_jobs_created := v_jobs_created + 1;
  end if;

  return jsonb_build_object(
    'scheduleRevision', v_cycle.schedule_revision,
    'cancelledItems', v_cancelled_items,
    'jobsCreated', v_jobs_created,
    'remindersCreated', v_reminders_created
  );
end;
$$;

create or replace function public.prepare_cycle_schedule_registration(
  p_cycle_ids uuid[],
  p_reminder_offsets_days integer[],
  p_validation_deadline_at timestamptz,
  p_cycle_close_at timestamptz,
  p_actor_user_id uuid
)
returns table (
  cycle_id uuid,
  schedule_revision bigint,
  jobs_created integer,
  reminders_created integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid;
  v_schedule_revision bigint;
  v_summary jsonb;
  v_updated_count integer := 0;
  v_expected_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'cycle_schedule_actor_not_authorized' using errcode = '42501';
  end if;

  if p_cycle_ids is null or cardinality(p_cycle_ids) = 0 then
    return;
  end if;
  if not public.valid_reminder_offsets(coalesce(p_reminder_offsets_days, array[]::integer[])) then
    raise exception 'invalid_reminder_offsets' using errcode = '22023';
  end if;

  select count(*) into v_expected_count
  from (select distinct unnest(p_cycle_ids) as id) requested;

  perform public.set_audit_actor(p_actor_user_id);

  if p_validation_deadline_at is not null and exists (
    select 1 from public.cycles c
    where c.id = any(p_cycle_ids)
      and (c.response_deadline_at is null or p_validation_deadline_at <= c.response_deadline_at)
  ) then
    raise exception 'validation_deadline_must_follow_response_deadline' using errcode = '22023';
  end if;
  if p_cycle_close_at is not null
     and (p_validation_deadline_at is null or p_cycle_close_at <= p_validation_deadline_at) then
    raise exception 'cycle_close_must_follow_validation_deadline' using errcode = '22023';
  end if;

  update public.cycles c
  set schedule_revision = c.schedule_revision + 1,
      reminder_offsets_days = coalesce(p_reminder_offsets_days, array[]::integer[]),
      validation_deadline_at = p_validation_deadline_at,
      cycle_close_at = p_cycle_close_at
  where c.id = any(p_cycle_ids);
  get diagnostics v_updated_count = row_count;

  if v_updated_count <> v_expected_count then
    raise exception 'cycle_schedule_contains_unknown_cycle' using errcode = 'P0002';
  end if;

  -- A atualização do ciclo e a substituição de todos os jobs ocorrem na mesma
  -- transação da RPC. Não existe janela em que o cronograma fique persistido
  -- sem os jobs correspondentes.
  for v_cycle_id, v_schedule_revision in
    select c.id, c.schedule_revision
    from public.cycles c
    where c.id = any(p_cycle_ids)
    order by c.id
  loop
    v_summary := public.replace_cycle_schedule(v_cycle_id, p_actor_user_id);

    cycle_id := v_cycle_id;
    schedule_revision := v_schedule_revision;
    jobs_created := coalesce((v_summary ->> 'jobsCreated')::integer, 0);
    reminders_created := coalesce((v_summary ->> 'remindersCreated')::integer, 0);
    return next;
  end loop;
end;
$$;

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

create or replace function public.dispatch_cycle_deadline_reminder(
  p_job_id uuid,
  p_cycle_id uuid,
  p_expected_schedule_revision bigint,
  p_offset_days integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_message text;
  v_action_path text;
  v_recipients integer := 0;
begin
  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;

  if not found then
    update public.automation_job_items
    set status = 'failed', message = 'Diagnóstico não encontrado.'
    where job_id = p_job_id and entity_type = 'cycle' and entity_id = p_cycle_id::text;
    return jsonb_build_object('status', 'failed', 'recipients', 0);
  end if;

  if v_cycle.schedule_revision <> p_expected_schedule_revision then
    update public.automation_job_items
    set status = 'skipped',
        message = format('Programação obsoleta: revisão %s; revisão atual %s.',
          p_expected_schedule_revision, v_cycle.schedule_revision)
    where job_id = p_job_id and entity_type = 'cycle' and entity_id = p_cycle_id::text;
    return jsonb_build_object('status', 'skipped', 'recipients', 0);
  end if;

  if v_cycle.state not in ('in_response'::public.cycle_state, 'awaiting_adjustment'::public.cycle_state) then
    update public.automation_job_items
    set status = 'skipped', message = 'O diagnóstico não está mais na etapa de resposta.'
    where job_id = p_job_id and entity_type = 'cycle' and entity_id = p_cycle_id::text;
    return jsonb_build_object('status', 'skipped', 'recipients', 0);
  end if;

  select count(*)::integer into v_recipients
  from public.profiles p
  where p.role = 'respondent'::public.app_user_role
    and p.organization_id = v_cycle.organization_id;

  if v_recipients = 0 then
    update public.automation_job_items
    set status = 'skipped', message = 'Nenhum respondente está vinculado à organização.'
    where job_id = p_job_id and entity_type = 'cycle' and entity_id = p_cycle_id::text;
    return jsonb_build_object('status', 'skipped', 'recipients', 0);
  end if;

  v_message := case when p_offset_days = 0
    then format('O prazo do diagnóstico %s termina hoje.', v_cycle.period_label)
    else format('Faltam %s dia(s) para o prazo do diagnóstico %s.', p_offset_days, v_cycle.period_label)
  end;
  v_action_path := format('/respondente/ciclos/%s', v_cycle.id);

  insert into public.user_notifications (
    user_id, kind, title, message, action_path, dedupe_key
  )
  select
    p.user_id,
    'diagnostic_deadline',
    'Prazo do diagnóstico',
    v_message,
    v_action_path,
    format('cycle:%s:user:%s:deadline:%s:offset:%s',
      v_cycle.id, p.user_id, v_cycle.response_deadline_at, p_offset_days)
  from public.profiles p
  where p.role = 'respondent'::public.app_user_role
    and p.organization_id = v_cycle.organization_id
  on conflict (user_id, dedupe_key) do nothing;

  insert into public.notification_outbox (
    recipient_user_id, kind, payload, dedupe_key
  )
  select
    p.user_id,
    'diagnostic_deadline',
    jsonb_build_object(
      'cycle_id', v_cycle.id,
      'period_label', v_cycle.period_label,
      'deadline', v_cycle.response_deadline_at,
      'offset_days', p_offset_days,
      'action_path', v_action_path
    ),
    format('cycle:%s:user:%s:deadline:%s:offset:%s',
      v_cycle.id, p.user_id, v_cycle.response_deadline_at, p_offset_days)
  from public.profiles p
  where p.role = 'respondent'::public.app_user_role
    and p.organization_id = v_cycle.organization_id
  on conflict (dedupe_key) do nothing;

  update public.automation_job_items
  set status = 'succeeded',
      message = format('%s destinatário(s) notificado(s).', v_recipients),
      output = jsonb_build_object('recipients', v_recipients, 'offset_days', p_offset_days)
  where job_id = p_job_id and entity_type = 'cycle' and entity_id = p_cycle_id::text;

  return jsonb_build_object('status', 'succeeded', 'recipients', v_recipients);
end;
$$;

create or replace function public.update_cycle_schedule(
  p_cycle_id uuid,
  p_starts_at timestamptz,
  p_response_deadline_at timestamptz,
  p_validation_deadline_at timestamptz,
  p_cycle_close_at timestamptz,
  p_actor_user_id uuid
)
returns public.cycles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles;
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'cycle_schedule_actor_not_authorized' using errcode = '42501';
  end if;

  if p_starts_at is not null and p_response_deadline_at is not null
     and p_response_deadline_at < p_starts_at then
    raise exception 'deadline_before_start' using errcode = '22023';
  end if;

  if p_response_deadline_at is not null and p_response_deadline_at <= now() then
    raise exception 'response_deadline_must_be_future' using errcode = '22023';
  end if;
  if p_validation_deadline_at is not null
     and (p_response_deadline_at is null or p_validation_deadline_at <= p_response_deadline_at) then
    raise exception 'validation_deadline_must_follow_response_deadline' using errcode = '22023';
  end if;
  if p_cycle_close_at is not null
     and (p_validation_deadline_at is null or p_cycle_close_at <= p_validation_deadline_at) then
    raise exception 'cycle_close_must_follow_validation_deadline' using errcode = '22023';
  end if;

  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;
  if v_cycle.state <> 'draft'::public.cycle_state then
    raise exception 'cycle_schedule_not_draft' using errcode = 'P0001';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  update public.cycles
  set starts_at = p_starts_at,
      response_deadline_at = p_response_deadline_at,
      validation_deadline_at = p_validation_deadline_at,
      cycle_close_at = p_cycle_close_at,
      schedule_revision = schedule_revision + 1
  where id = p_cycle_id
  returning * into v_cycle;

  perform public.replace_cycle_schedule(p_cycle_id, p_actor_user_id);
  return v_cycle;
end;
$$;

create or replace function public.create_or_open_cycle(
  p_form_id uuid,
  p_organization_id uuid,
  p_period_label text,
  p_actor_user_id uuid,
  p_starts_at timestamptz,
  p_response_deadline_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles;
  v_created boolean := false;
  v_status text;
  v_code text := btrim(p_period_label);
  v_defer_schedule boolean :=
    coalesce(current_setting('app.defer_cycle_schedule_materialization', true), '') = 'on';
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'cycle_batch_actor_not_authorized' using errcode = '42501';
  end if;

  if v_code is null or v_code = '' then
    raise exception 'invalid_period_label' using errcode = '23514';
  end if;
  if p_starts_at is null or p_response_deadline_at is null then
    raise exception 'cycle_schedule_required' using errcode = '23514';
  end if;
  if p_response_deadline_at < p_starts_at then
    raise exception 'deadline_before_start' using errcode = '22023';
  end if;
  if p_starts_at > now() + interval '5 minutes' then
    raise exception 'immediate_open_start_in_future' using errcode = '22023';
  end if;
  if p_response_deadline_at <= now() then
    raise exception 'response_deadline_not_future' using errcode = '22023';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  select c.* into v_cycle
  from public.cycles c
  join public.form_versions fv on fv.id = c.form_version_id
  join public.form_periods fp on fp.id = c.period_id
  where fv.form_id = p_form_id
    and c.organization_id = p_organization_id
    and fp.period_code = v_code
  order by c.created_at desc
  limit 1
  for update of c;

  if not found then
    begin
      select * into v_cycle
      from public.create_cycle(
        p_form_id,
        p_organization_id,
        v_code,
        p_actor_user_id,
        p_starts_at,
        p_response_deadline_at
      );
      v_created := true;
    exception
      when unique_violation then
        select c.* into v_cycle
        from public.cycles c
        join public.form_versions fv on fv.id = c.form_version_id
        join public.form_periods fp on fp.id = c.period_id
        where fv.form_id = p_form_id
          and c.organization_id = p_organization_id
          and fp.period_code = v_code
        order by c.created_at desc
        limit 1
        for update of c;

        if not found then
          raise;
        end if;
    end;
  end if;

  if v_cycle.state = 'in_response'::public.cycle_state then
    return jsonb_build_object('status', 'already_open', 'cycle', to_jsonb(v_cycle));
  end if;
  if v_cycle.state <> 'draft'::public.cycle_state then
    return jsonb_build_object('status', 'not_openable', 'cycle', to_jsonb(v_cycle));
  end if;

  update public.cycles
  set starts_at = p_starts_at,
      response_deadline_at = p_response_deadline_at,
      validation_deadline_at = null,
      cycle_close_at = null,
      schedule_revision = schedule_revision + case when v_defer_schedule then 0 else 1 end
  where id = v_cycle.id
  returning * into v_cycle;

  perform public.commit_cycle_transition(
    v_cycle.id,
    p_actor_user_id,
    'in_response'::public.cycle_state,
    null,
    null,
    'draft'::public.cycle_state
  );

  if not v_defer_schedule then
    perform public.replace_cycle_schedule(v_cycle.id, p_actor_user_id);
  end if;

  select * into v_cycle
  from public.cycles
  where id = v_cycle.id;

  v_status := case when v_created then 'created_and_opened' else 'opened_existing' end;
  return jsonb_build_object('status', v_status, 'cycle', to_jsonb(v_cycle));
end;
$$;

create or replace function public.create_cycles_batch(
  p_form_id uuid,
  p_organization_ids uuid[],
  p_period_label text,
  p_actor_user_id uuid,
  p_starts_at timestamptz default null,
  p_response_deadline_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_cycle public.cycles;
  v_results jsonb := '[]'::jsonb;
  v_code text := btrim(p_period_label);
  v_defer_schedule boolean :=
    coalesce(current_setting('app.defer_cycle_schedule_materialization', true), '') = 'on';
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'cycle_batch_actor_not_authorized' using errcode = '42501';
  end if;
  if (p_starts_at is null) <> (p_response_deadline_at is null) then
    raise exception 'cycle_schedule_required' using errcode = '22023';
  end if;

  for v_organization_id in
    select ids.organization_id
    from unnest(coalesce(p_organization_ids, array[]::uuid[])) with ordinality
      as ids(organization_id, ordinal)
    group by ids.organization_id
    order by min(ids.ordinal)
  loop
    begin
      select * into v_cycle
      from public.create_cycle(
        p_form_id,
        v_organization_id,
        v_code,
        p_actor_user_id,
        p_starts_at,
        p_response_deadline_at
      );

      if p_starts_at is not null and not v_defer_schedule then
        update public.cycles
        set schedule_revision = schedule_revision + 1
        where id = v_cycle.id
        returning * into v_cycle;
        perform public.replace_cycle_schedule(v_cycle.id, p_actor_user_id);
      end if;

      v_results := v_results || jsonb_build_array(
        jsonb_build_object('status', 'created', 'cycle', to_jsonb(v_cycle))
      );
    exception
      when unique_violation then
        select c.* into v_cycle
        from public.cycles c
        join public.form_versions fv on fv.id = c.form_version_id
        join public.form_periods fp on fp.id = c.period_id
        where fv.form_id = p_form_id
          and c.organization_id = v_organization_id
          and fp.period_code = v_code
        order by c.created_at desc
        limit 1
        for update of c;

        if v_cycle.id is not null and v_cycle.state = 'draft' then
          if p_starts_at is not null or p_response_deadline_at is not null then
            if coalesce(p_response_deadline_at, v_cycle.response_deadline_at) is not null
               and coalesce(p_response_deadline_at, v_cycle.response_deadline_at) <= now() then
              raise exception 'response_deadline_must_be_future' using errcode = '22023';
            end if;
            if coalesce(p_starts_at, v_cycle.starts_at) is not null
               and coalesce(p_response_deadline_at, v_cycle.response_deadline_at) is not null
               and coalesce(p_response_deadline_at, v_cycle.response_deadline_at)
                 < coalesce(p_starts_at, v_cycle.starts_at) then
              raise exception 'deadline_before_start' using errcode = '22023';
            end if;

            perform public.set_audit_actor(p_actor_user_id);
            update public.cycles
            set starts_at = coalesce(p_starts_at, starts_at),
                response_deadline_at = coalesce(p_response_deadline_at, response_deadline_at),
                validation_deadline_at = null,
                cycle_close_at = null,
                schedule_revision = schedule_revision
                  + case when v_defer_schedule then 0 else 1 end
            where id = v_cycle.id
            returning * into v_cycle;

            if not v_defer_schedule then
              perform public.replace_cycle_schedule(v_cycle.id, p_actor_user_id);
            end if;
          end if;

          v_results := v_results || jsonb_build_array(
            jsonb_build_object('status', 'existing_draft', 'cycle', to_jsonb(v_cycle))
          );
        else
          v_results := v_results || jsonb_build_array(
            jsonb_build_object(
              'status', 'already_exists',
              'organization_id', v_organization_id,
              'cycle', case when v_cycle.id is null then null else to_jsonb(v_cycle) end,
              'message', sqlerrm
            )
          );
        end if;
      when others then
        v_results := v_results || jsonb_build_array(
          jsonb_build_object(
            'status', 'failed',
            'organization_id', v_organization_id,
            'message', sqlerrm
          )
        );
    end;
  end loop;

  return v_results;
end;
$$;

create or replace function public.process_cycles_batch_with_reference(
  p_mode text,
  p_form_id uuid,
  p_organization_ids uuid[],
  p_period_label text,
  p_reference_start_year integer,
  p_reference_end_year integer,
  p_actor_user_id uuid,
  p_starts_at timestamptz default null,
  p_response_deadline_at timestamptz default null,
  p_reminder_offsets_days integer[] default array[]::integer[],
  p_validation_deadline_at timestamptz default null,
  p_cycle_close_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
  v_cycle_ids uuid[] := array[]::uuid[];
  v_schedule_row record;
  v_jobs_created integer := 0;
  v_reminders_created integer := 0;
begin
  if p_mode not in ('draft', 'open', 'schedule') then
    raise exception 'invalid_cycle_batch_mode' using errcode = '22023';
  end if;
  if p_mode = 'draft' and (
    p_starts_at is not null
    or p_response_deadline_at is not null
    or cardinality(coalesce(p_reminder_offsets_days, array[]::integer[])) > 0
    or p_validation_deadline_at is not null
    or p_cycle_close_at is not null
  ) then
    raise exception 'draft_cannot_have_schedule' using errcode = '22023';
  end if;
  if p_mode <> 'draft' and (p_starts_at is null or p_response_deadline_at is null) then
    raise exception 'cycle_schedule_required' using errcode = '22023';
  end if;
  if p_mode = 'schedule' and p_starts_at <= now() + interval '5 minutes' then
    raise exception 'scheduled_open_must_be_future' using errcode = '22023';
  end if;

  -- As funções legadas continuam materializando o cronograma quando chamadas
  -- diretamente. Nesta fronteira atômica, a criação é adiada até que período
  -- de referência e todas as datas estejam prontos, evitando jobs transitórios.
  perform set_config('app.defer_cycle_schedule_materialization', 'on', true);

  if p_mode = 'open' then
    v_result := public.create_or_open_cycles_batch_with_reference(
      p_form_id,
      p_organization_ids,
      p_period_label,
      p_reference_start_year,
      p_reference_end_year,
      p_actor_user_id,
      p_starts_at,
      p_response_deadline_at
    );

    select coalesce(array_agg((item #>> '{cycle,id}')::uuid), array[]::uuid[])
    into v_cycle_ids
    from jsonb_array_elements(v_result) as entries(item)
    where item ->> 'status' in ('created_and_opened', 'opened_existing');
  else
    v_result := public.create_cycles_batch_with_reference(
      p_form_id,
      p_organization_ids,
      p_period_label,
      p_reference_start_year,
      p_reference_end_year,
      p_actor_user_id,
      p_starts_at,
      p_response_deadline_at
    );

    if p_mode = 'schedule' then
      select coalesce(array_agg((item #>> '{cycle,id}')::uuid), array[]::uuid[])
      into v_cycle_ids
      from jsonb_array_elements(v_result) as entries(item)
      where item ->> 'status' in ('created', 'existing_draft');
    end if;
  end if;

  perform set_config('app.defer_cycle_schedule_materialization', 'off', true);

  if cardinality(v_cycle_ids) > 0 then
    for v_schedule_row in
      select *
      from public.prepare_cycle_schedule_registration(
        v_cycle_ids,
        coalesce(p_reminder_offsets_days, array[]::integer[]),
        p_validation_deadline_at,
        p_cycle_close_at,
        p_actor_user_id
      )
    loop
      v_jobs_created := v_jobs_created + v_schedule_row.jobs_created;
      v_reminders_created := v_reminders_created + v_schedule_row.reminders_created;
    end loop;
  end if;

  return jsonb_build_object(
    'result', v_result,
    'schedules', jsonb_build_object(
      'jobsCreated', v_jobs_created,
      'remindersScheduled', v_reminders_created
    )
  );
end;
$$;

create function public.reopen_cycle(
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_reason text,
  p_response_deadline_at timestamptz,
  p_question_version_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_next_version integer;
  v_new_processing uuid;
  v_reopen_number integer;
  v_event_id uuid;
  v_qv uuid;
  v_scope_count integer := 0;
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'cycle_reopen_actor_not_authorized' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'reopen_reason_required' using errcode = '22023';
  end if;
  if char_length(btrim(p_reason)) > 2000 then
    raise exception 'reopen_reason_too_long' using errcode = '22023';
  end if;
  if p_response_deadline_at is null or p_response_deadline_at <= now() then
    raise exception 'reopen_deadline_must_be_future' using errcode = '22023';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;
  if v_cycle.state <> 'completed'::public.cycle_state then
    raise exception 'cannot_reopen: estado atual %', v_cycle.state
      using errcode = 'P0001';
  end if;

  if p_question_version_ids is not null and cardinality(p_question_version_ids) > 0 then
    foreach v_qv in array p_question_version_ids loop
      if not exists (
        select 1
        from public.form_questions fq
        where fq.form_version_id = v_cycle.form_version_id
          and fq.question_version_id = v_qv
      ) then
        raise exception 'reopen_question_not_in_form' using errcode = '22023';
      end if;
    end loop;
  end if;

  select coalesce(max(processing_version), 0) + 1 into v_next_version
  from public.cycle_processings where cycle_id = p_cycle_id;

  insert into public.cycle_processings (cycle_id, processing_version, status)
  values (p_cycle_id, v_next_version, 'working')
  returning id into v_new_processing;

  v_reopen_number := v_cycle.reopen_count + 1;

  insert into public.cycle_reopen_events (
    cycle_id, reopen_number, actor_user_id, reason,
    previous_deadline_at, new_deadline_at
  ) values (
    p_cycle_id, v_reopen_number, p_actor_user_id, btrim(p_reason),
    v_cycle.response_deadline_at, p_response_deadline_at
  )
  returning id into v_event_id;

  if p_question_version_ids is not null and cardinality(p_question_version_ids) > 0 then
    insert into public.cycle_reopen_allowed_questions (reopen_event_id, question_version_id)
    select v_event_id, distinct_qv
    from (select distinct unnest(p_question_version_ids) as distinct_qv) q;
    get diagnostics v_scope_count = row_count;
  end if;

  update public.cycles
  set state = 'in_response',
      starts_at = now(),
      response_deadline_at = p_response_deadline_at,
      validation_deadline_at = null,
      cycle_close_at = null,
      submitted_at = null,
      submitted_late_at = null,
      submission_delay_seconds = null,
      validated_at = null,
      closed_at = null,
      reopen_count = v_reopen_number,
      reopened_at = now(),
      response_collection_paused_at = null,
      response_collection_pause_reason = null,
      schedule_revision = schedule_revision + 1
  where id = p_cycle_id;

  perform public.replace_cycle_schedule(p_cycle_id, p_actor_user_id);

  return jsonb_build_object(
    'fromState', 'completed',
    'toState', 'in_response',
    'reopenCount', v_reopen_number,
    'reason', btrim(p_reason),
    'responseDeadlineAt', p_response_deadline_at,
    'newProcessingId', v_new_processing,
    'newProcessingVersion', v_next_version,
    'partialScopeCount', v_scope_count,
    'reopenEventId', v_event_id
  );
end;
$$;

create or replace function public.enforce_reopen_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.state = 'completed'::public.cycle_state
     and new.state = 'in_response'::public.cycle_state then
    if new.response_deadline_at is null or new.response_deadline_at <= now() then
      raise exception 'reopen_requires_future_deadline' using errcode = '23514';
    end if;

    if not exists (
      select 1 from public.cycle_reopen_events event
      where event.cycle_id = new.id
        and event.reopen_number = new.reopen_count
        and event.new_deadline_at = new.response_deadline_at
    ) then
      raise exception 'reopen_requires_reason_and_event' using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_valid_evidence_file()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pending public.pending_evidence_uploads%rowtype;
begin
  if new.kind <> 'file'::public.evidence_kind then
    new.file_validation_status := 'not_applicable';
    new.file_validated_at := null;
    return new;
  end if;

  -- Importação histórica sem pending verificado não afirma validade estrutural.
  if coalesce(current_setting('app.historical_import_mode', true), '') = 'on' then
    new.file_validation_status := 'rejected';
    new.file_validated_at := null;
    return new;
  end if;

  select * into v_pending
  from public.pending_evidence_uploads pending
  where pending.storage_path = new.storage_path
  for share;

  if not found then
    raise exception 'file_evidence_requires_pending_upload' using errcode = '23514';
  end if;
  if v_pending.verified_at is null then
    raise exception 'file_evidence_requires_structural_verification' using errcode = '23514';
  end if;
  if v_pending.file_validation_status <> 'valid' then
    raise exception 'file_evidence_requires_structural_validation' using errcode = '23514';
  end if;

  new.file_validation_status := 'valid';
  new.file_validated_at := v_pending.verified_at;
  return new;
end;
$$;

create or replace function public.enforce_cycle_transition_integrity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_processing_id uuid;
begin
  if old.state is distinct from new.state
     and not public.cycle_can_transition(old.state, new.state)
     and not (
       old.state = 'completed'::public.cycle_state
       and new.state = 'in_response'::public.cycle_state
     )
     and not (
       old.state = 'validated'::public.cycle_state
       and new.state = 'in_validation'::public.cycle_state
     ) then
    raise exception 'invalid_cycle_transition: % -> %', old.state, new.state
      using errcode = 'P0001';
  end if;

  if old.state = 'draft'::public.cycle_state
     and new.state = 'in_response'::public.cycle_state
     and coalesce(current_setting('app.historical_import_mode', true), '') <> 'on'
     and (new.starts_at is null or new.response_deadline_at is null) then
    raise exception 'cycle_schedule_required'
      using errcode = '23514';
  end if;

  if old.state = 'completed'::public.cycle_state
     and new.state = 'in_response'::public.cycle_state
     and (
       new.reopen_count <> old.reopen_count + 1
       or new.reopened_at is null
       or new.closed_at is not null
       or not exists (
         select 1
         from public.cycle_processings cp
         where cp.cycle_id = new.id
           and cp.status = 'working'::public.cycle_processing_status
       )
     ) then
    raise exception 'reopen_requires_official_workflow'
      using errcode = '23514';
  end if;

  if old.state = 'validated'::public.cycle_state
     and new.state = 'in_validation'::public.cycle_state
     and (
       new.validated_at is not null
       or not exists (
         select 1
         from public.cycle_processings cp
         where cp.cycle_id = new.id
           and cp.status = 'working'::public.cycle_processing_status
       )
       or not exists (
         select 1
         from public.cycle_validation_reopen_events event
         where event.cycle_id = new.id
           and event.to_state = 'in_validation'::public.cycle_state
           and event.new_cycle_processing_id = public.cycle_working_processing(new.id)
       )
     ) then
    raise exception 'validation_reopen_requires_official_workflow'
      using errcode = '23514';
  end if;

  if old.state = 'in_validation'::public.cycle_state
     and new.state = 'validated'::public.cycle_state then
    if exists (
      select 1
      from public.evidences e
      join public.responses resp on resp.id = e.response_id
      where resp.cycle_id = new.id
        and coalesce(resp.admin_applicability_status, '') <> 'not_applicable'
        and e.deactivated_at is null
        and e.validation_status in (
          'pending'::public.evidence_validation_status,
          'adjustment_requested'::public.evidence_validation_status
        )
    ) then
      raise exception 'validation_has_unresolved_evidence'
        using errcode = '23514';
    end if;

    select cp.id into v_processing_id
    from public.cycle_processings cp
    where cp.cycle_id = new.id
      and cp.status = 'completed'::public.cycle_processing_status
      and exists (
        select 1
        from public.fami_results fr
        where fr.cycle_processing_id = cp.id
          and fr.scope_type = 'global'
          and fr.scope_id is null
      )
    order by cp.processing_version desc
    limit 1;

    if v_processing_id is null
       or public.cycle_working_processing(new.id) is not null
       or exists (
         select 1
         from public.form_questions fq
         join public.question_versions qv on qv.id = fq.question_version_id
         where fq.form_version_id = new.form_version_id
           and qv.applies_to_respondent
           and not exists (
             select 1
             from public.processing_waiver_snapshots pws
             where pws.cycle_processing_id = v_processing_id
               and pws.question_version_id = qv.id
           )
           and not exists (
             select 1
             from public.response_snapshots rs
             where rs.cycle_processing_id = v_processing_id
               and rs.question_version_id = qv.id
           )
       ) then
      raise exception 'validation_requires_finalized_fami_processing'
        using errcode = '23514';
    end if;
  end if;

  if old.state = 'validated'::public.cycle_state
     and new.state = 'completed'::public.cycle_state then
    select cp.id into v_processing_id
    from public.cycle_processings cp
    where cp.cycle_id = new.id
      and cp.status = 'completed'::public.cycle_processing_status
      and exists (
        select 1
        from public.fami_results fr
        where fr.cycle_processing_id = cp.id
          and fr.scope_type = 'global'
          and fr.scope_id is null
      )
    order by cp.processing_version desc
    limit 1;

    if v_processing_id is null then
      raise exception 'cycle_close_requires_finalized_diagnosis'
        using errcode = '23514';
    end if;

    if exists (
      select 1
      from public.cycle_action_plan_supervision_blockers(new.id)
    ) then
      raise exception 'close_requires_completed_and_approved_action_plans'
        using errcode = '23514';
    end if;

    if exists (
      (select w.question_id
       from public.question_organization_waivers w
       join public.question_versions qv on qv.question_id = w.question_id
       join public.form_questions fq on fq.question_version_id = qv.id
       where w.organization_id = new.organization_id
         and fq.form_version_id = new.form_version_id)
      except
      (select s.question_id
       from public.processing_waiver_snapshots s
       where s.cycle_processing_id = v_processing_id)
    ) or exists (
      (select s.question_id
       from public.processing_waiver_snapshots s
       where s.cycle_processing_id = v_processing_id)
      except
      (select w.question_id
       from public.question_organization_waivers w
       join public.question_versions qv on qv.question_id = w.question_id
       join public.form_questions fq on fq.question_version_id = qv.id
       where w.organization_id = new.organization_id
         and fq.form_version_id = new.form_version_id)
    ) then
      raise exception 'close_waiver_snapshot_conflict'
        using errcode = '40001';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_validation_reopen_metadata()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.state = 'validated'::public.cycle_state
     and new.state = 'in_validation'::public.cycle_state then
    if not exists (
      select 1
      from public.cycle_validation_reopen_events event
      where event.cycle_id = new.id
        and event.new_cycle_processing_id = public.cycle_working_processing(new.id)
        and event.reason is not null
        and char_length(btrim(event.reason)) >= 10
    ) then
      raise exception 'validation_reopen_requires_reason_and_event'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.validation_reopen_impact(p_cycle_id uuid)
returns table (
  action_plan_count bigint,
  supervision_note_count bigint,
  exception_count bigint
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
    order by cp.processing_version desc, cp.id desc
    limit 1
  ), scoped_recommendations as (
    select r.id
    from public.recommendations r
    join latest_processing lp on lp.id = r.cycle_processing_id
  )
  select
    (select count(*) from public.action_plans ap
      where ap.recommendation_id in (select id from scoped_recommendations)),
    (select count(*) from public.action_plan_supervision_notes n
      where n.recommendation_id in (select id from scoped_recommendations)),
    (select count(*) from public.recommendation_exceptions ex
      where ex.recommendation_id in (select id from scoped_recommendations));
$$;

create or replace function public.reopen_validation_cycle(
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_next_version integer;
  v_new_processing uuid;
  v_previous_processing uuid;
  v_reopen_number integer;
  v_previous_validated_at timestamptz;
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'validation_reopen_actor_not_authorized' using errcode = '42501';
  end if;

  if char_length(btrim(coalesce(p_reason, ''))) < 10 then
    raise exception 'validation_reopen_reason_required' using errcode = '22023';
  end if;
  if char_length(btrim(p_reason)) > 2000 then
    raise exception 'validation_reopen_reason_too_long' using errcode = '22023';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;

  if v_cycle.state <> 'validated'::public.cycle_state then
    if v_cycle.state = 'in_validation'::public.cycle_state then
      raise exception 'validation_already_open: estado atual %', v_cycle.state
        using errcode = 'P0001';
    end if;
    raise exception 'cannot_reopen_validation: estado atual %', v_cycle.state
      using errcode = 'P0001';
  end if;

  if public.cycle_working_processing(p_cycle_id) is not null then
    raise exception 'validation_reopen_working_processing_exists'
      using errcode = 'P0001';
  end if;

  select cp.id into v_previous_processing
  from public.cycle_processings cp
  where cp.cycle_id = p_cycle_id
    and cp.status = 'completed'::public.cycle_processing_status
  order by cp.processing_version desc
  limit 1;

  if v_previous_processing is null then
    raise exception 'validation_reopen_requires_completed_processing'
      using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.validation_reopen_impact(p_cycle_id) impact
    where impact.action_plan_count > 0
       or impact.supervision_note_count > 0
       or impact.exception_count > 0
  ) then
    raise exception 'validation_reopen_has_improvement_history'
      using errcode = 'P0001';
  end if;

  select coalesce(max(processing_version), 0) + 1 into v_next_version
  from public.cycle_processings where cycle_id = p_cycle_id;

  insert into public.cycle_processings (cycle_id, processing_version, status)
  values (p_cycle_id, v_next_version, 'working')
  returning id into v_new_processing;

  select coalesce(max(reopen_number), 0) + 1 into v_reopen_number
  from public.cycle_validation_reopen_events
  where cycle_id = p_cycle_id;

  v_previous_validated_at := v_cycle.validated_at;

  insert into public.cycle_validation_reopen_events (
    cycle_id,
    reopen_number,
    actor_user_id,
    reason,
    from_state,
    to_state,
    previous_cycle_processing_id,
    new_cycle_processing_id,
    previous_validated_at
  ) values (
    p_cycle_id,
    v_reopen_number,
    p_actor_user_id,
    btrim(p_reason),
    'validated'::public.cycle_state,
    'in_validation'::public.cycle_state,
    v_previous_processing,
    v_new_processing,
    v_previous_validated_at
  );

  update public.cycles
  set state = 'in_validation',
      validated_at = null
  where id = p_cycle_id;

  return jsonb_build_object(
    'fromState', 'validated',
    'toState', 'in_validation',
    'reopenNumber', v_reopen_number,
    'reason', btrim(p_reason),
    'previousProcessingId', v_previous_processing,
    'newProcessingId', v_new_processing,
    'newProcessingVersion', v_next_version,
    'previousValidatedAt', v_previous_validated_at
  );
end;
$$;

create or replace function public.deactivate_misplaced_legacy_evidence_link(
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_external_link text,
  p_reason text default 'Link legado sem critério oficial correspondente; preservado apenas em metadado/auditoria.'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link text := btrim(coalesce(p_external_link, ''));
  v_ids uuid[] := array[]::uuid[];
  v_count integer := 0;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
      and p.organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;
  if v_link = '' or v_link !~* '^https?://' then
    raise exception 'invalid_external_link' using errcode = '22023';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  with deactivated as (
    update public.evidences e
       set deactivated_at = now()
      from public.responses r
     where e.response_id = r.id
       and r.cycle_id = p_cycle_id
       and e.kind = 'link'
       and e.external_link = v_link
       and e.deactivated_at is null
    returning e.id
  )
  select coalesce(array_agg(id), array[]::uuid[]), count(*)::integer
    into v_ids, v_count
  from deactivated;

  if v_count > 0 then
    insert into public.audit_logs (
      actor_user_id, event_type, entity_type, record_id, before_json, after_json
    ) values (
      p_actor_user_id,
      'legacy_evidence_orphan_deactivated',
      'cycle',
      p_cycle_id,
      jsonb_build_object('external_link', v_link, 'evidence_ids', to_jsonb(v_ids)),
      jsonb_build_object(
        'action', 'deactivated_orphan_or_misplaced',
        'reason', p_reason,
        'count', v_count
      )
    );
  end if;

  return jsonb_build_object(
    'status', case when v_count = 0 then 'noop' else 'deactivated' end,
    'count', v_count,
    'evidence_ids', to_jsonb(v_ids)
  );
end;
$$;

create or replace function public.reconcile_legacy_evidence_link(
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_target_question_version_id uuid,
  p_external_link text,
  p_legacy_source_column integer,
  p_legacy_source_header text default null,
  p_desired_validation_status public.evidence_validation_status default 'approved'::public.evidence_validation_status
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_response public.responses%rowtype;
  v_existing public.evidences%rowtype;
  v_misplaced public.evidences%rowtype;
  v_link text := btrim(coalesce(p_external_link, ''));
  v_action text;
  v_stable_key text;
begin
  if not exists (
    select 1
    from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
      and p.organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;
  if v_link = '' or v_link !~* '^https?://' then
    raise exception 'invalid_external_link' using errcode = '22023';
  end if;
  if p_legacy_source_column is null or p_legacy_source_column < 1 then
    raise exception 'invalid_legacy_source_column' using errcode = '22023';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  select *
    into v_target_response
  from public.responses
  where cycle_id = p_cycle_id
    and question_version_id = p_target_question_version_id
  for update;

  if not found then
    raise exception 'target_response_missing' using errcode = 'P0002';
  end if;

  v_stable_key := concat_ws(
    '|',
    p_cycle_id::text,
    p_target_question_version_id::text,
    v_target_response.id::text,
    v_link,
    p_legacy_source_column::text
  );

  if v_target_response.answer is distinct from 'yes'::public.answer_value then
    update public.evidences e
       set deactivated_at = coalesce(e.deactivated_at, now())
      from public.responses r
     where e.response_id = r.id
       and r.cycle_id = p_cycle_id
       and e.kind = 'link'
       and e.external_link = v_link
       and e.deactivated_at is null
       and e.response_id = v_target_response.id;

    insert into public.audit_logs (
      actor_user_id, event_type, entity_type, record_id, before_json, after_json
    ) values (
      p_actor_user_id,
      'legacy_evidence_reconcile_skipped_non_yes',
      'response',
      v_target_response.id,
      jsonb_build_object('stable_key', v_stable_key, 'answer', v_target_response.answer),
      jsonb_build_object(
        'action', 'skipped_non_yes',
        'external_link', v_link,
        'legacy_source_column', p_legacy_source_column,
        'legacy_source_header', p_legacy_source_header
      )
    );

    return jsonb_build_object(
      'status', 'skipped_non_yes',
      'stable_key', v_stable_key,
      'response_id', v_target_response.id
    );
  end if;

  select *
    into v_existing
  from public.evidences
  where response_id = v_target_response.id
    and kind = 'link'
    and external_link = v_link
    and deactivated_at is null
  order by submitted_at asc, id asc
  limit 1
  for update;

  if found then
    update public.evidences e
       set deactivated_at = now()
     where e.response_id = v_target_response.id
       and e.kind = 'link'
       and e.external_link = v_link
       and e.deactivated_at is null
       and e.id <> v_existing.id;

    v_action := 'already_on_target';
  else
    select e.*
      into v_misplaced
    from public.evidences e
    join public.responses r on r.id = e.response_id
    where r.cycle_id = p_cycle_id
      and e.kind = 'link'
      and e.external_link = v_link
      and e.deactivated_at is null
      and e.response_id <> v_target_response.id
    order by e.submitted_at asc, e.id asc
    limit 1;

    if found then
      insert into public.evidences (
        response_id,
        kind,
        storage_path,
        external_link,
        link_reason,
        original_filename,
        validation_status,
        validation_justification,
        validated_at,
        validated_by,
        submitted_by
      ) values (
        v_target_response.id,
        'link',
        null,
        v_link,
        coalesce(
          nullif(btrim(v_misplaced.link_reason), ''),
          'Comprovação importada do formulário legado do Diagnóstico de Integridade 2026.'
        ),
        coalesce(
          v_misplaced.original_filename,
          concat('Comprovação legada — coluna ', p_legacy_source_column)
        ),
        v_misplaced.validation_status,
        v_misplaced.validation_justification,
        v_misplaced.validated_at,
        v_misplaced.validated_by,
        coalesce(v_misplaced.submitted_by, p_actor_user_id)
      )
      returning * into v_existing;

      v_action := 'copied_to_target';
    else
      insert into public.evidences (
        response_id,
        kind,
        storage_path,
        external_link,
        link_reason,
        original_filename,
        validation_status,
        validated_at,
        validated_by,
        submitted_by
      ) values (
        v_target_response.id,
        'link',
        null,
        v_link,
        'Comprovação importada do formulário legado do Diagnóstico de Integridade 2026.',
        concat('Comprovação legada — coluna ', p_legacy_source_column),
        coalesce(p_desired_validation_status, 'approved'::public.evidence_validation_status),
        case
          when coalesce(p_desired_validation_status, 'approved') = 'pending'
            then null
          else now()
        end,
        case
          when coalesce(p_desired_validation_status, 'approved') = 'pending'
            then null
          else p_actor_user_id
        end,
        p_actor_user_id
      )
      returning * into v_existing;

      v_action := 'inserted_on_target';
    end if;
  end if;

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id,
    'legacy_evidence_reconciled',
    'evidence',
    v_existing.id,
    jsonb_build_object('stable_key', v_stable_key),
    jsonb_build_object(
      'action', v_action,
      'stable_key', v_stable_key,
      'cycle_id', p_cycle_id,
      'response_id', v_target_response.id,
      'question_version_id', p_target_question_version_id,
      'external_link', v_link,
      'legacy_source_column', p_legacy_source_column,
      'legacy_source_header', p_legacy_source_header,
      'validation_status', v_existing.validation_status
    )
  );

  return jsonb_build_object(
    'status', v_action,
    'stable_key', v_stable_key,
    'evidence_id', v_existing.id,
    'response_id', v_target_response.id
  );
end;
$$;

create or replace function public.publish_form(
  p_form_id uuid,
  p_actor_user_id uuid
)
returns public.form_versions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_draft_id uuid;
  v_next_version integer;
  v_new_version public.form_versions;
  v_question_count integer;
  v_question record;
  v_question_version_id uuid;
begin
  if p_actor_user_id is null then
    raise exception 'actor_required' using errcode = '22023';
  end if;
  perform public.set_audit_actor(p_actor_user_id);
  perform 1 from public.forms where id = p_form_id for update;
  if not found then
    raise exception 'form_not_found' using errcode = 'P0002';
  end if;
  select id into v_draft_id
  from public.form_drafts
  where form_id = p_form_id;
  if v_draft_id is null then
    raise exception 'form_has_no_draft' using errcode = 'foreign_key_violation';
  end if;
  select count(*) into v_question_count
  from public.form_draft_questions
  where form_draft_id = v_draft_id;
  if v_question_count = 0 then
    raise exception 'draft_is_empty' using errcode = 'check_violation';
  end if;
  select coalesce(max(version), 0) + 1 into v_next_version
  from public.form_versions
  where form_id = p_form_id;
  update public.form_versions
  set state = 'superseded'
  where form_id = p_form_id and state = 'published';
  insert into public.form_versions (form_id, version, state, published_by)
  values (p_form_id, v_next_version, 'published', p_actor_user_id)
  returning * into v_new_version;
  for v_question in
    select
      fdq.order_index,
      q.id as question_id,
      q.prompt,
      q.evidence_parameter,
      q.fami_enabled,
      q.applies_to_respondent,
      q.allows_not_applicable,
      s.id as section_id,
      s.name as section_name,
      s.ordem as section_order,
      a.id as axis_id,
      a.name as axis_name,
      case
        when qlb.question_id is null then '{}'::jsonb
        else jsonb_build_object(
          'metric', qlb.metric,
          'bindings', qlb.bindings,
          'responseMapping', qlb.response_mapping,
          'coverageScore', qlb.coverage_score
        )
      end as library_binding_snapshot
    from public.form_draft_questions fdq
    join public.questions q on q.id = fdq.question_id
    join public.sections s on s.id = q.section_id
    join public.axes a on a.id = s.axis_id
    left join public.question_library_binding qlb on qlb.question_id = q.id
    where fdq.form_draft_id = v_draft_id
    order by fdq.order_index
  loop
    perform 1 from public.questions where id = v_question.question_id for update;
    insert into public.question_versions (
      question_id,
      version,
      prompt,
      evidence_parameter,
      fami_enabled,
      applies_to_respondent,
      allows_not_applicable,
      section_id,
      section_name,
      section_order,
      axis_id,
      axis_name,
      library_binding_snapshot
    ) values (
      v_question.question_id,
      (select coalesce(max(qv.version), 0) + 1
       from public.question_versions qv
       where qv.question_id = v_question.question_id),
      v_question.prompt,
      v_question.evidence_parameter,
      v_question.fami_enabled,
      v_question.applies_to_respondent,
      v_question.allows_not_applicable,
      v_question.section_id,
      v_question.section_name,
      v_question.section_order,
      v_question.axis_id,
      v_question.axis_name,
      v_question.library_binding_snapshot
    )
    returning id into v_question_version_id;
    insert into public.form_questions (
      form_version_id,
      question_version_id,
      order_index
    ) values (
      v_new_version.id,
      v_question_version_id,
      v_question.order_index
    );
  end loop;
  update public.forms
  set current_form_version_id = v_new_version.id
  where id = p_form_id;
  return v_new_version;
end;
$$;

create or replace function public.mark_response_admin_not_applicable(
  p_response_id uuid,
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_justification text,
  p_expected_admin_status text default null,
  p_expected_decided_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response public.responses%rowtype;
  v_cycle_state public.cycle_state;
  v_allows_not_applicable boolean;
  v_justification text;
  v_decided_at timestamptz;
  v_validation_round integer;
  v_before_json jsonb;
  v_after_json jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = p_actor_user_id
      and role = 'admin'::public.app_user_role
      and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;
  perform public.set_audit_actor(p_actor_user_id);
  v_justification := nullif(btrim(coalesce(p_justification, '')), '');
  if v_justification is null then
    raise exception 'admin_na_justification_required' using errcode = '22023';
  end if;

  perform set_config('lock_timeout', '3s', true);

  begin
    select *
      into v_response
    from public.responses
    where id = p_response_id
      and cycle_id = p_cycle_id
    for update;
  exception
    when lock_not_available then
      raise exception 'admin_applicability_busy'
        using errcode = '55P03';
  end;
  if not found then
    if exists (select 1 from public.responses where id = p_response_id) then
      raise exception 'response_not_in_cycle' using errcode = '23514';
    end if;
    raise exception 'response_not_found' using errcode = 'P0002';
  end if;

  select c.state
    into v_cycle_state
  from public.cycles c
  where c.id = p_cycle_id;
  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;
  if v_cycle_state <> 'in_validation'::public.cycle_state then
    raise exception 'cycle_not_in_validation: estado do ciclo %', v_cycle_state
      using errcode = 'P0001';
  end if;

  if p_expected_admin_status is not null
     and v_response.admin_applicability_status is distinct from p_expected_admin_status then
    raise exception 'admin_applicability_conflict' using errcode = '40001';
  end if;
  if p_expected_decided_at is not null
     and v_response.admin_na_decided_at is distinct from p_expected_decided_at then
    raise exception 'admin_applicability_conflict' using errcode = '40001';
  end if;
  if v_response.admin_applicability_status = 'not_applicable' then
    raise exception 'admin_applicability_already_marked' using errcode = 'P0001';
  end if;
  if v_response.answer not in (
    'yes'::public.answer_value,
    'no'::public.answer_value
  ) then
    raise exception 'admin_applicability_requires_yes_or_no' using errcode = 'P0001';
  end if;

  select qv.allows_not_applicable into v_allows_not_applicable
  from public.question_versions qv
  where qv.id = v_response.question_version_id;
  if not coalesce(v_allows_not_applicable, false) then
    raise exception 'question_does_not_allow_admin_not_applicable' using errcode = 'P0001';
  end if;

  v_decided_at := clock_timestamp();
  select coalesce(count(*), 0) + 1 into v_validation_round
  from public.cycle_reopen_events
  where cycle_id = p_cycle_id;

  v_before_json := jsonb_build_object(
    'adminApplicabilityStatus', v_response.admin_applicability_status,
    'adminNaJustification', v_response.admin_na_justification,
    'adminNaDecidedBy', v_response.admin_na_decided_by,
    'adminNaDecidedAt', v_response.admin_na_decided_at,
    'answer', v_response.answer
  );

  update public.responses
  set admin_applicability_status = 'not_applicable',
      admin_na_justification = v_justification,
      admin_na_decided_by = p_actor_user_id,
      admin_na_decided_at = v_decided_at
  where id = p_response_id;

  v_after_json := jsonb_build_object(
    'adminApplicabilityStatus', 'not_applicable',
    'adminNaJustification', v_justification,
    'adminNaDecidedBy', p_actor_user_id,
    'adminNaDecidedAt', v_decided_at,
    'answer', v_response.answer
  );

  insert into public.response_admin_applicability_events (
    response_id,
    cycle_id,
    decision,
    previous_decision,
    original_answer,
    justification,
    decided_by,
    decided_at,
    validation_round,
    before_json,
    after_json
  ) values (
    p_response_id,
    p_cycle_id,
    'not_applicable',
    v_response.admin_applicability_status,
    v_response.answer,
    v_justification,
    p_actor_user_id,
    v_decided_at,
    v_validation_round,
    v_before_json,
    v_after_json
  );

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id,
    'response.admin_not_applicable_marked',
    'responses',
    p_response_id,
    v_before_json,
    v_after_json
  );

  return jsonb_build_object(
    'responseId', p_response_id,
    'cycleId', p_cycle_id,
    'adminApplicabilityStatus', 'not_applicable',
    'adminNaDecidedAt', v_decided_at,
    'validationRound', v_validation_round,
    'answer', v_response.answer
  );
end;
$$;

create or replace function public.revert_response_admin_not_applicable(
  p_response_id uuid,
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_justification text,
  p_expected_admin_status text default null,
  p_expected_decided_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response public.responses%rowtype;
  v_cycle_state public.cycle_state;
  v_justification text;
  v_decided_at timestamptz;
  v_validation_round integer;
  v_before_json jsonb;
  v_after_json jsonb;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = p_actor_user_id
      and role = 'admin'::public.app_user_role
      and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;
  perform public.set_audit_actor(p_actor_user_id);
  v_justification := nullif(btrim(coalesce(p_justification, '')), '');
  if v_justification is null then
    raise exception 'admin_na_justification_required' using errcode = '22023';
  end if;

  perform set_config('lock_timeout', '3s', true);

  begin
    select *
      into v_response
    from public.responses
    where id = p_response_id
      and cycle_id = p_cycle_id
    for update;
  exception
    when lock_not_available then
      raise exception 'admin_applicability_busy'
        using errcode = '55P03';
  end;
  if not found then
    if exists (select 1 from public.responses where id = p_response_id) then
      raise exception 'response_not_in_cycle' using errcode = '23514';
    end if;
    raise exception 'response_not_found' using errcode = 'P0002';
  end if;

  select c.state
    into v_cycle_state
  from public.cycles c
  where c.id = p_cycle_id;
  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;
  if v_cycle_state <> 'in_validation'::public.cycle_state then
    raise exception 'cycle_not_in_validation: estado do ciclo %', v_cycle_state
      using errcode = 'P0001';
  end if;

  if p_expected_admin_status is not null
     and v_response.admin_applicability_status is distinct from p_expected_admin_status then
    raise exception 'admin_applicability_conflict' using errcode = '40001';
  end if;
  if p_expected_decided_at is not null
     and v_response.admin_na_decided_at is distinct from p_expected_decided_at then
    raise exception 'admin_applicability_conflict' using errcode = '40001';
  end if;
  if v_response.admin_applicability_status is distinct from 'not_applicable' then
    raise exception 'admin_applicability_not_marked' using errcode = 'P0001';
  end if;

  v_decided_at := clock_timestamp();
  select coalesce(count(*), 0) + 1 into v_validation_round
  from public.cycle_reopen_events
  where cycle_id = p_cycle_id;

  v_before_json := jsonb_build_object(
    'adminApplicabilityStatus', v_response.admin_applicability_status,
    'adminNaJustification', v_response.admin_na_justification,
    'adminNaDecidedBy', v_response.admin_na_decided_by,
    'adminNaDecidedAt', v_response.admin_na_decided_at,
    'answer', v_response.answer
  );

  update public.responses
  set admin_applicability_status = null,
      admin_na_justification = null,
      admin_na_decided_by = null,
      admin_na_decided_at = null
  where id = p_response_id;

  v_after_json := jsonb_build_object(
    'adminApplicabilityStatus', null,
    'adminNaJustification', null,
    'adminNaDecidedBy', null,
    'adminNaDecidedAt', null,
    'answer', v_response.answer
  );

  insert into public.response_admin_applicability_events (
    response_id,
    cycle_id,
    decision,
    previous_decision,
    original_answer,
    justification,
    decided_by,
    decided_at,
    validation_round,
    before_json,
    after_json
  ) values (
    p_response_id,
    p_cycle_id,
    'reverted',
    'not_applicable',
    v_response.answer,
    v_justification,
    p_actor_user_id,
    v_decided_at,
    v_validation_round,
    v_before_json,
    v_after_json
  );

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id,
    'response.admin_not_applicable_reverted',
    'responses',
    p_response_id,
    v_before_json,
    v_after_json
  );

  return jsonb_build_object(
    'responseId', p_response_id,
    'cycleId', p_cycle_id,
    'adminApplicabilityStatus', null,
    'adminNaDecidedAt', null,
    'validationRound', v_validation_round,
    'answer', v_response.answer
  );
end;
$$;

create or replace function public.mark_responses_admin_not_applicable_batch(
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_response_ids uuid[],
  p_justification text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response_id uuid;
  v_results jsonb := '[]'::jsonb;
  v_result jsonb;
  v_error text;
  v_error_code text;
  v_input_count integer;
  v_distinct_count integer;
begin
  v_input_count := cardinality(coalesce(p_response_ids, array[]::uuid[]));
  select count(*)
  into v_distinct_count
  from (
    select distinct response_id
    from unnest(coalesce(p_response_ids, array[]::uuid[])) as ids(response_id)
  ) distinct_ids;
  if v_input_count = 0
     or v_input_count > 200
     or v_input_count <> v_distinct_count then
    raise exception 'invalid_batch_size' using errcode = '22023';
  end if;
  foreach v_response_id in array coalesce(p_response_ids, array[]::uuid[]) loop
    begin
      v_result := public.mark_response_admin_not_applicable(
        v_response_id,
        p_cycle_id,
        p_actor_user_id,
        p_justification
      );
      v_results := v_results || jsonb_build_array(jsonb_build_object(
        'id', v_response_id,
        'status', 'success',
        'result', v_result
      ));
    exception
      when others then
        get stacked diagnostics v_error = message_text;
        raise warning 'mark_responses_admin_not_applicable_batch failed for response %: %',
          v_response_id, v_error;
        v_error_code := case
          when v_error like 'global_admin_required%' then 'global_admin_required'
          when v_error like 'admin_applicability_conflict%' then 'admin_applicability_conflict'
          when v_error like 'response_not_found%' then 'response_not_found'
          when v_error like 'response_not_in_cycle%' then 'response_not_in_cycle'
          when v_error like 'cycle_not_in_validation%' then 'cycle_not_in_validation'
          when v_error like 'admin_na_justification_required%' then 'admin_na_justification_required'
          when v_error like 'admin_applicability_already_marked%' then 'admin_applicability_already_marked'
          when v_error like 'admin_applicability_requires_yes_or_no%' then 'admin_applicability_requires_yes_or_no'
          when v_error like 'question_does_not_allow_admin_not_applicable%' then 'question_not_eligible'
          else 'admin_applicability_failed'
        end;
        v_results := v_results || jsonb_build_array(jsonb_build_object(
          'id', v_response_id,
          'status', 'failed',
          'code', v_error_code
        ));
    end;
  end loop;
  return jsonb_build_object('results', v_results);
end;
$$;

create or replace function public.dispatch_evidence_adjustments(
  p_cycle_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_adjustment_count integer;
  v_proof_request_count integer;
  v_pending_count integer;
begin
  perform public.set_audit_actor(p_actor_user_id);

  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;

  if v_cycle.state <> 'in_validation'::public.cycle_state then
    raise exception 'cycle_not_in_validation: estado do ciclo %', v_cycle.state
      using errcode = 'P0001';
  end if;

  select count(*)::integer into v_adjustment_count
  from public.evidences e
  join public.responses r on r.id = e.response_id
  where r.cycle_id = p_cycle_id
    and e.deactivated_at is null
    and e.validation_status = 'adjustment_requested'::public.evidence_validation_status;

  select count(*)::integer into v_proof_request_count
  from public.responses r
  where r.cycle_id = p_cycle_id
    and r.admin_proof_status = 'proof_requested'
    and coalesce(r.admin_applicability_status, '') <> 'not_applicable';

  if v_adjustment_count + v_proof_request_count = 0 then
    raise exception 'no_adjustments_to_dispatch' using errcode = 'P0001';
  end if;

  select (
    (select count(*)
     from public.evidences e
     join public.responses r on r.id = e.response_id
     where r.cycle_id = p_cycle_id
       and coalesce(r.admin_applicability_status, '') <> 'not_applicable'
       and e.deactivated_at is null
       and e.validation_status = 'pending'::public.evidence_validation_status)
    +
    (select count(*)
     from public.responses r
     join public.question_versions qv on qv.id = r.question_version_id
     where r.cycle_id = p_cycle_id
       and r.answer = 'yes'::public.answer_value
       and coalesce(r.admin_applicability_status, '') <> 'not_applicable'
       and coalesce((qv.evidence_parameter->>'required')::boolean, false)
       and r.admin_proof_status is null
       and not exists (
         select 1 from public.evidences e
         where e.response_id = r.id and e.deactivated_at is null
       ))
    +
    (select count(*)
     from public.responses r
     where r.cycle_id = p_cycle_id
       and r.answer = 'not_applicable'::public.answer_value
       and r.na_validation_status = 'pending'::public.na_validation_status)
  )::integer into v_pending_count;

  if v_pending_count > 0 then
    raise exception 'validation_queue_has_pending_items: %', v_pending_count
      using errcode = 'P0001';
  end if;

  if not public.cycle_can_transition('in_validation','awaiting_adjustment') then
    raise exception 'invalid_cycle_transition: in_validation -> awaiting_adjustment'
      using errcode = 'P0001';
  end if;

  perform set_config('app.validation_transition_origin', 'evidence_queue', true);
  update public.cycles
  set state = 'awaiting_adjustment'::public.cycle_state
  where id = p_cycle_id;

  return jsonb_build_object(
    'cycleId', p_cycle_id,
    'fromState', 'in_validation',
    'toState', 'awaiting_adjustment',
    'adjustmentCount', v_adjustment_count,
    'proofRequestCount', v_proof_request_count
  );
end;
$$;

create or replace function public.apply_workbench_response(
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_question_version_id uuid,
  p_answer public.answer_value,
  p_notes text,
  p_expected_revision bigint default null,
  p_evidence jsonb default null::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_existing_response public.responses%rowtype;
  v_response_id uuid;
  v_response_revision bigint;
  v_item jsonb;
  v_items jsonb := '[]'::jsonb;
  v_pending_upload_id uuid;
  v_pending_upload public.pending_evidence_uploads%rowtype;
  v_seen_pending_upload_ids uuid[] := array[]::uuid[];
  v_persisted_id uuid;
  v_persisted_ids jsonb := '[]'::jsonb;
  v_kind text;
  v_title text;
  v_text_body text;
begin
  perform public.set_audit_actor(p_actor_user_id);

  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for share;

  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;

  if v_cycle.state not in ('in_response', 'awaiting_adjustment') then
    raise exception 'cycle_not_editable: %', v_cycle.state using errcode = 'P0001';
  end if;

  if v_cycle.response_collection_paused_at is not null then
    raise exception 'cycle_collection_paused' using errcode = 'P0001';
  end if;

  if v_cycle.state = 'in_response'::public.cycle_state
     and not app_private.is_cycle_question_collection_editable(
       p_cycle_id, p_question_version_id
     ) then
    raise exception 'question_not_in_reopen_scope' using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.form_questions fq
    where fq.form_version_id = v_cycle.form_version_id
      and fq.question_version_id = p_question_version_id
  ) then
    raise exception 'question_not_in_cycle_form' using errcode = 'P0001';
  end if;

  select * into v_existing_response
  from public.responses r
  where r.cycle_id = p_cycle_id
    and r.question_version_id = p_question_version_id
  for update;

  if found then
    if p_expected_revision is null or p_expected_revision <> v_existing_response.revision then
      raise exception 'response_revision_conflict' using errcode = '40001';
    end if;
  elsif p_expected_revision is not null then
    raise exception 'response_revision_conflict' using errcode = '40001';
  end if;

  if v_cycle.state = 'awaiting_adjustment'::public.cycle_state then
    if v_existing_response.id is null then
      raise exception 'adjustment_question_not_editable' using errcode = 'P0001';
    end if;

    if not (
      exists (
        select 1
        from public.evidences e
        where e.response_id = v_existing_response.id
          and e.deactivated_at is null
          and e.validation_status = 'adjustment_requested'::public.evidence_validation_status
      )
      or v_existing_response.admin_proof_status = 'proof_requested'
    ) then
      raise exception 'adjustment_question_not_editable' using errcode = 'P0001';
    end if;

    if p_answer is distinct from v_existing_response.answer
       or p_notes is distinct from v_existing_response.notes then
      raise exception 'adjustment_allows_evidence_only' using errcode = 'P0001';
    end if;
  end if;

  if p_evidence is not null then
    if jsonb_typeof(p_evidence) = 'array' then
      v_items := p_evidence;
    else
      raise exception 'invalid_evidence_payload' using errcode = 'P0001';
    end if;
  end if;

  if jsonb_array_length(v_items) > 20 then
    raise exception 'too_many_evidences_per_request' using errcode = 'P0001';
  end if;

  if v_cycle.state = 'awaiting_adjustment'::public.cycle_state
     and jsonb_array_length(v_items) = 0 then
    raise exception 'adjustment_requires_new_evidence' using errcode = 'P0001';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or p_answer <> 'yes'::public.answer_value
       or coalesce(v_item ->> 'kind', '') not in ('file', 'link', 'text') then
      raise exception 'invalid_evidence_payload' using errcode = 'P0001';
    end if;

    v_kind := v_item ->> 'kind';
    v_title := nullif(trim(coalesce(v_item ->> 'title', '')), '');

    if v_kind = 'file' then
      if coalesce(v_item ->> 'storage_path', '') = ''
         or coalesce(v_item ->> 'pending_upload_id', '') = '' then
        raise exception 'invalid_file_evidence_payload' using errcode = 'P0001';
      end if;

      begin
        v_pending_upload_id := (v_item ->> 'pending_upload_id')::uuid;
      exception when invalid_text_representation then
        raise exception 'invalid_pending_upload_id' using errcode = 'P0001';
      end;

      if v_pending_upload_id = any(v_seen_pending_upload_ids) then
        raise exception 'duplicate_pending_upload_id' using errcode = 'P0001';
      end if;
      v_seen_pending_upload_ids := array_append(
        v_seen_pending_upload_ids,
        v_pending_upload_id
      );

      select * into v_pending_upload
      from public.pending_evidence_uploads
      where id = v_pending_upload_id
      for update;

      if not found then
        raise exception 'pending_evidence_upload_not_found' using errcode = 'P0002';
      end if;
      if v_pending_upload.expires_at <= now() then
        raise exception 'pending_evidence_upload_expired' using errcode = 'P0001';
      end if;
      if v_pending_upload.verified_at is null
         or v_pending_upload.file_validation_status <> 'valid' then
        raise exception 'pending_evidence_upload_not_verified' using errcode = 'P0001';
      end if;
      if v_pending_upload.cycle_id <> p_cycle_id
         or v_pending_upload.organization_id <> v_cycle.organization_id
         or v_pending_upload.uploaded_by <> p_actor_user_id
         or v_pending_upload.storage_path <> v_item ->> 'storage_path' then
        raise exception 'pending_evidence_upload_scope_mismatch' using errcode = 'P0001';
      end if;
    elsif v_kind = 'link' then
      if coalesce(v_item ->> 'external_link', '') = ''
         or coalesce(v_item ->> 'link_reason', '') = '' then
        raise exception 'invalid_link_evidence_payload' using errcode = 'P0001';
      end if;
    else
      v_text_body := nullif(trim(coalesce(v_item ->> 'text_body', '')), '');
      if v_title is null or v_text_body is null then
        raise exception 'invalid_text_evidence_payload' using errcode = 'P0001';
      end if;
    end if;
  end loop;

  insert into public.responses (
    cycle_id,
    question_version_id,
    created_by,
    answer,
    notes,
    is_not_applicable,
    na_justification
  ) values (
    p_cycle_id,
    p_question_version_id,
    p_actor_user_id,
    p_answer,
    p_notes,
    p_answer = 'not_applicable'::public.answer_value,
    case
      when p_answer = 'not_applicable'::public.answer_value then p_notes
      else null
    end
  )
  on conflict (cycle_id, question_version_id)
  do update set
    answer = excluded.answer,
    notes = excluded.notes,
    is_not_applicable = excluded.is_not_applicable,
    na_justification = excluded.na_justification,
    created_by = excluded.created_by
  returning id, revision into v_response_id, v_response_revision;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_kind := v_item ->> 'kind';
    v_title := nullif(trim(coalesce(v_item ->> 'title', '')), '');

    if v_kind = 'file' then
      v_pending_upload_id := (v_item ->> 'pending_upload_id')::uuid;
      select * into strict v_pending_upload
      from public.pending_evidence_uploads
      where id = v_pending_upload_id
      for update;

      insert into public.evidences (
        response_id, kind, title, text_body, storage_path, external_link, link_reason,
        original_filename, mime_type, size_bytes, submitted_by, validation_status
      ) values (
        v_response_id, 'file',
        coalesce(v_title, v_pending_upload.original_filename, 'Arquivo'),
        null,
        v_item ->> 'storage_path', null, null,
        coalesce(nullif(v_item ->> 'original_filename', ''), v_pending_upload.original_filename),
        coalesce(v_pending_upload.verified_mime_type, v_pending_upload.mime_type),
        v_pending_upload.size_bytes, p_actor_user_id, 'pending'
      ) returning id into v_persisted_id;
      v_persisted_ids := v_persisted_ids || to_jsonb(v_persisted_id);

      delete from public.pending_evidence_uploads where id = v_pending_upload_id;
    elsif v_kind = 'link' then
      insert into public.evidences (
        response_id, kind, title, text_body, storage_path, external_link, link_reason,
        original_filename, submitted_by, validation_status
      ) values (
        v_response_id, 'link',
        coalesce(v_title, nullif(trim(v_item ->> 'link_reason'), ''), 'Link'),
        null, null,
        v_item ->> 'external_link',
        v_item ->> 'link_reason',
        null,
        p_actor_user_id, 'pending'
      ) returning id into v_persisted_id;
      v_persisted_ids := v_persisted_ids || to_jsonb(v_persisted_id);
    else
      v_text_body := nullif(trim(coalesce(v_item ->> 'text_body', '')), '');
      insert into public.evidences (
        response_id, kind, title, text_body, storage_path, external_link, link_reason,
        original_filename, submitted_by, validation_status
      ) values (
        v_response_id, 'text',
        v_title,
        v_text_body,
        null, null, null, null,
        p_actor_user_id, 'pending'
      ) returning id into v_persisted_id;
      v_persisted_ids := v_persisted_ids || to_jsonb(v_persisted_id);
    end if;
  end loop;

  return jsonb_build_object(
    'responseId', v_response_id,
    'revision', v_response_revision,
    'answer', p_answer,
    'notes', p_notes,
    'evidenceIds', v_persisted_ids,
    'retiredStoragePath', null
  );
end;
$$;

CREATE OR REPLACE FUNCTION public.commit_cycle_transition(
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_to_state public.cycle_state,
  p_fami_rows jsonb DEFAULT NULL::jsonb,
  p_snapshot_payload jsonb DEFAULT NULL::jsonb,
  p_expected_from_state public.cycle_state DEFAULT NULL::public.cycle_state
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_from public.cycle_state;
  v_processing_id uuid;
  v_is_cycle_closing boolean;
begin
  perform public.set_audit_actor(p_actor_user_id);

  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;

  v_from := v_cycle.state;
  v_is_cycle_closing := (
    v_from = 'validated'::public.cycle_state
    and p_to_state = 'completed'::public.cycle_state
  );

  if p_expected_from_state is not null and v_from <> p_expected_from_state then
    raise exception 'cycle_state_conflict: esperado %, atual %',
      p_expected_from_state, v_from using errcode = 'P0001';
  end if;

  if p_to_state is not null and p_to_state <> v_from
     and not public.cycle_can_transition(v_from, p_to_state) then
    raise exception 'invalid_cycle_transition: % -> %', v_from, p_to_state
      using errcode = 'P0001';
  end if;

  -- Nenhuma transição genérica pode criar ou alterar FAMI. A única fronteira
  -- autorizada é finalize_validation_cycle.
  if p_fami_rows is not null or p_snapshot_payload is not null then
    raise exception 'fami_materialization_only_at_validation'
      using errcode = 'P0001';
  end if;

  if (
    (v_from = 'in_response'::public.cycle_state
      and p_to_state = 'submitted'::public.cycle_state)
    or
    (v_from = 'awaiting_adjustment'::public.cycle_state
      and p_to_state = 'in_validation'::public.cycle_state)
  ) and exists (
    select 1
    from public.form_questions fq
    join public.question_versions qv on qv.id = fq.question_version_id
    left join public.responses resp
      on resp.cycle_id = v_cycle.id
     and resp.question_version_id = qv.id
    where fq.form_version_id = v_cycle.form_version_id
      and qv.applies_to_respondent
      and not exists (
        select 1
        from public.question_organization_waivers w
        where w.organization_id = v_cycle.organization_id
          and w.question_id = qv.question_id
      )
      and not coalesce(resp.is_not_applicable, false)
      and (
        resp.id is null
        or (
          v_from = 'awaiting_adjustment'::public.cycle_state
          and exists (
            select 1
            from public.evidences requested
            where requested.response_id = resp.id
              and requested.deactivated_at is null
              and requested.validation_status = 'adjustment_requested'::public.evidence_validation_status
              and not exists (
                select 1
                from public.match_evidence_adjustment_replacements(resp.id) matched
                where matched.requested_evidence_id = requested.id
              )
          )
        )
        or (
          v_from = 'awaiting_adjustment'::public.cycle_state
          and resp.admin_proof_status = 'proof_requested'
          and not exists (
            select 1
            from public.evidences e
            where e.response_id = resp.id
              and e.deactivated_at is null
              and e.validation_status = 'pending'::public.evidence_validation_status
          )
        )
      )
  ) then
    raise exception 'submission_not_ready'
      using errcode = '23514';
  end if;

  if v_from = 'awaiting_adjustment'::public.cycle_state
     and p_to_state = 'in_validation'::public.cycle_state then
    update public.responses
    set admin_proof_status = null,
        admin_proof_observation = null,
        admin_proof_decided_by = null,
        admin_proof_decided_at = null
    where cycle_id = p_cycle_id
      and admin_proof_status = 'proof_requested'
      and exists (
        select 1
        from public.evidences e
        where e.response_id = responses.id
          and e.deactivated_at is null
      );
  end if;

  if v_is_cycle_closing then
    select cp.id into v_processing_id
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
    limit 1;

    if v_processing_id is null then
      raise exception 'cycle_close_requires_finalized_diagnosis'
        using errcode = '23514';
    end if;
  else
    v_processing_id := public.cycle_working_processing(p_cycle_id);
    if v_processing_id is null then
      raise exception 'no_working_processing for cycle %', p_cycle_id
        using errcode = 'P0002';
    end if;
  end if;

  if v_from = 'awaiting_adjustment'::public.cycle_state
     and p_to_state = 'in_validation'::public.cycle_state then
    -- A evidência devolvida permanece visível durante a correção. No reenvio,
    -- cada devolutiva pareada com uma substituição própria é preservada no
    -- histórico e retirada da fila ativa. Uma nova evidência nunca atende duas
    -- solicitações distintas.
    update public.evidences requested
    set deactivated_at = now()
    from public.responses response_row,
      lateral public.match_evidence_adjustment_replacements(response_row.id) matched
    where response_row.cycle_id = p_cycle_id
      and requested.id = matched.requested_evidence_id
      and requested.response_id = response_row.id
      and requested.deactivated_at is null
      and requested.validation_status = 'adjustment_requested'::public.evidence_validation_status;
  end if;

  if p_to_state is not null and p_to_state <> v_from then
    update public.cycles
    set state = p_to_state,
        submitted_at = case
          when p_to_state = 'submitted'::public.cycle_state
            or (
              v_from = 'awaiting_adjustment'::public.cycle_state
              and p_to_state = 'in_validation'::public.cycle_state
            )
          then now()
          else submitted_at
        end,
        validated_at = case when p_to_state = 'validated' then now() else validated_at end,
        closed_at = case when p_to_state = 'completed' then now() else closed_at end
    where id = p_cycle_id;
  end if;

  return jsonb_build_object(
    'fromState', v_from,
    'toState', coalesce(p_to_state, v_from),
    'processingId', v_processing_id,
    'closed', v_is_cycle_closing
  );
end;
$$;

create or replace function public.decide_response_without_proof(
  p_response_id uuid,
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_action text,
  p_observation text,
  p_expected_status text default null,
  p_expected_decided_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_response public.responses%rowtype;
  v_cycle public.cycles%rowtype;
  v_cycle_id uuid;
  v_requires_evidence boolean;
  v_allows_not_applicable boolean;
  v_observation text;
  v_action text;
  v_decided_at timestamptz;
  v_validation_round integer;
  v_before_json jsonb;
  v_after_json jsonb;
  v_active_evidence_count integer;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = p_actor_user_id
      and role = 'admin'::public.app_user_role
      and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;
  perform public.set_audit_actor(p_actor_user_id);

  v_action := lower(btrim(coalesce(p_action, '')));
  if v_action not in ('validate_without_proof', 'request_proof', 'consider_insufficient') then
    raise exception 'admin_proof_action_invalid' using errcode = '22023';
  end if;

  v_observation := nullif(btrim(coalesce(p_observation, '')), '');
  if v_observation is null then
    raise exception 'admin_proof_observation_required' using errcode = '22023';
  end if;

  select resp.cycle_id into v_cycle_id
  from public.responses resp
  where resp.id = p_response_id;
  if not found then
    raise exception 'response_not_found' using errcode = 'P0002';
  end if;
  if v_cycle_id <> p_cycle_id then
    raise exception 'response_not_in_cycle' using errcode = '23514';
  end if;

  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;
  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;
  if v_cycle.state <> 'in_validation'::public.cycle_state then
    raise exception 'cycle_not_in_validation: estado do ciclo %', v_cycle.state
      using errcode = 'P0001';
  end if;

  select * into v_response
  from public.responses
  where id = p_response_id
    and cycle_id = p_cycle_id
  for update;
  if not found then
    raise exception 'response_not_in_cycle' using errcode = '23514';
  end if;

  if p_expected_status is not null and (
    v_response.admin_proof_status is distinct from p_expected_status
    or v_response.admin_proof_decided_at is distinct from p_expected_decided_at
  ) then
    raise exception 'admin_proof_conflict' using errcode = '40001';
  end if;

  if v_response.admin_applicability_status = 'not_applicable' then
    raise exception 'admin_proof_blocked_by_not_applicable' using errcode = 'P0001';
  end if;

  select
    coalesce((qv.evidence_parameter->>'required')::boolean, false),
    coalesce(qv.allows_not_applicable, false)
  into v_requires_evidence, v_allows_not_applicable
  from public.question_versions qv
  where qv.id = v_response.question_version_id;

  if v_response.answer = 'no'::public.answer_value then
    -- Mesmo trio de vereditos do rodapé unificado; só para critério elegível a N/A admin.
    if not v_allows_not_applicable then
      raise exception 'admin_proof_requires_yes' using errcode = 'P0001';
    end if;
  elsif v_response.answer = 'yes'::public.answer_value then
    if not v_requires_evidence then
      raise exception 'admin_proof_requires_evidence_criterion' using errcode = 'P0001';
    end if;
    select count(*)::integer into v_active_evidence_count
    from public.evidences e
    where e.response_id = p_response_id
      and e.deactivated_at is null;
    if v_active_evidence_count > 0 then
      raise exception 'admin_proof_requires_absent_document' using errcode = 'P0001';
    end if;
  else
    raise exception 'admin_proof_requires_yes' using errcode = 'P0001';
  end if;

  v_decided_at := clock_timestamp();
  select coalesce(count(*), 0) + 1 into v_validation_round
  from public.cycle_reopen_events
  where cycle_id = p_cycle_id;

  v_before_json := jsonb_build_object(
    'adminProofStatus', v_response.admin_proof_status,
    'adminProofObservation', v_response.admin_proof_observation,
    'adminProofDecidedBy', v_response.admin_proof_decided_by,
    'adminProofDecidedAt', v_response.admin_proof_decided_at,
    'answer', v_response.answer
  );

  update public.responses
  set admin_proof_status = case
        when v_action = 'validate_without_proof' then 'validated_without_proof'
        when v_action = 'consider_insufficient' then 'considered_insufficient'
        else 'proof_requested'
      end,
      admin_proof_observation = v_observation,
      admin_proof_decided_by = p_actor_user_id,
      admin_proof_decided_at = v_decided_at
  where id = p_response_id;

  v_after_json := jsonb_build_object(
    'adminProofStatus', case
      when v_action = 'validate_without_proof' then 'validated_without_proof'
      when v_action = 'consider_insufficient' then 'considered_insufficient'
      else 'proof_requested'
    end,
    'adminProofObservation', v_observation,
    'adminProofDecidedBy', p_actor_user_id,
    'adminProofDecidedAt', v_decided_at,
    'answer', v_response.answer
  );

  insert into public.response_admin_proof_events (
    response_id, cycle_id, decision, previous_decision, original_answer,
    observation, decided_by, decided_at, validation_round, before_json, after_json
  ) values (
    p_response_id,
    p_cycle_id,
    case
      when v_action = 'validate_without_proof' then 'validated_without_proof'
      when v_action = 'consider_insufficient' then 'considered_insufficient'
      else 'proof_requested'
    end,
    v_response.admin_proof_status,
    v_response.answer,
    v_observation,
    p_actor_user_id,
    v_decided_at,
    v_validation_round,
    v_before_json,
    v_after_json
  );

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id,
    case
      when v_action = 'validate_without_proof'
        then 'response.admin_validated_without_proof'
      when v_action = 'consider_insufficient'
        then 'response.admin_considered_insufficient'
      else 'response.admin_proof_requested'
    end,
    'responses',
    p_response_id,
    v_before_json,
    v_after_json
  );

  return jsonb_build_object(
    'responseId', p_response_id,
    'cycleId', p_cycle_id,
    'adminProofStatus', case
      when v_action = 'validate_without_proof' then 'validated_without_proof'
      when v_action = 'consider_insufficient' then 'considered_insufficient'
      else 'proof_requested'
    end,
    'adminProofDecidedAt', v_decided_at,
    'validationRound', v_validation_round,
    'answer', v_response.answer
  );
end;
$$;

create or replace function public.calculate_live_fami_rows(p_cycle_id uuid)
returns table (
  scope_type text,
  scope_id uuid,
  points_obtained numeric,
  points_possible numeric,
  percentage numeric,
  maturity_level smallint
)
language sql
stable
set search_path = public
as $$
  with cycle_scope as (
    select c.form_version_id, c.organization_id
    from public.cycles c
    where c.id = p_cycle_id
  ),
  question_state as (
    select
      qv.section_id,
      qv.axis_id,
      (
        qv.applies_to_respondent
        and qv.fami_enabled
        and w.question_id is null
        and not coalesce(
          resp.answer = 'not_applicable'::public.answer_value
          and resp.na_validation_status = 'approved'::public.na_validation_status,
          false
        )
        and not coalesce(
          resp.admin_applicability_status = 'not_applicable',
          false
        )
      ) as eligible,
      case
        when jsonb_typeof(qv.evidence_parameter -> 'required') = 'boolean'
          then (qv.evidence_parameter ->> 'required')::boolean
        else false
      end as requires_evidence,
      resp.answer,
      resp.admin_proof_status,
      exists (
        select 1
        from public.evidences e
        where e.response_id = resp.id
          and e.deactivated_at is null
          and e.validation_status = 'approved'::public.evidence_validation_status
      ) as has_approved_evidence,
      exists (
        select 1
        from public.evidences e
        where e.response_id = resp.id
          and e.deactivated_at is null
          and e.validation_status = 'invalidated'::public.evidence_validation_status
      ) as has_invalidated_evidence,
      exists (
        select 1
        from public.evidences e
        where e.response_id = resp.id
          and e.deactivated_at is null
          and e.validation_status in (
            'pending'::public.evidence_validation_status,
            'adjustment_requested'::public.evidence_validation_status
          )
      ) as has_open_evidence
    from cycle_scope cs
    join public.form_questions fq on fq.form_version_id = cs.form_version_id
    join public.question_versions qv on qv.id = fq.question_version_id
    left join public.responses resp
      on resp.cycle_id = p_cycle_id
     and resp.question_version_id = qv.id
    left join public.question_organization_waivers w
      on w.organization_id = cs.organization_id
     and w.question_id = qv.question_id
  ),
  scored as (
    select
      section_id,
      axis_id,
      case
        when eligible then case when requires_evidence then 2::numeric else 1::numeric end
        else 0::numeric
      end as points_possible,
      case
        when eligible and answer = 'yes'::public.answer_value then
          case
            when not requires_evidence then 1::numeric
            when has_approved_evidence then 2::numeric
            else 0::numeric
          end
        else 0::numeric
      end as points_obtained
    from question_state
  ),
  section_totals as (
    select
      'section'::text as scope_type,
      section_id as scope_id,
      sum(points_obtained)::numeric as points_obtained,
      sum(points_possible)::numeric as points_possible
    from scored
    group by section_id
  ),
  axis_totals as (
    select
      'axis'::text as scope_type,
      axis_id as scope_id,
      sum(points_obtained)::numeric as points_obtained,
      sum(points_possible)::numeric as points_possible
    from scored
    group by axis_id
  ),
  global_totals as (
    select
      'global'::text as scope_type,
      null::uuid as scope_id,
      coalesce(sum(points_obtained), 0)::numeric as points_obtained,
      coalesce(sum(points_possible), 0)::numeric as points_possible
    from scored
  ),
  totals as (
    select * from section_totals
    union all
    select * from axis_totals
    union all
    select * from global_totals
  ),
  normalized as (
    select
      scope_type,
      scope_id,
      round(points_obtained, 2) as points_obtained,
      round(points_possible, 2) as points_possible,
      case
        when points_possible = 0 then 0::numeric
        else round((points_obtained / points_possible) * 100, 2)
      end as percentage
    from totals
  )
  select
    scope_type,
    scope_id,
    points_obtained,
    points_possible,
    percentage,
    case
      when points_possible = 0 then null::smallint
      when percentage <= 20 then 1::smallint
      when percentage <= 40 then 2::smallint
      when percentage <= 60 then 3::smallint
      when percentage <= 80 then 4::smallint
      else 5::smallint
    end as maturity_level
  from normalized;
$$;

create or replace function public.calculate_live_recommendations(p_cycle_id uuid)
returns table (
  question_version_id uuid,
  tipo public.recommendation_type,
  recommendation_trigger text,
  recommendation_text text
)
language sql
stable
set search_path = public
as $$
  with cycle_scope as (
    select c.form_version_id, c.organization_id
    from public.cycles c
    where c.id = p_cycle_id
  ),
  question_state as (
    select
      qv.id as question_version_id,
      qv.applies_to_respondent,
      w.question_id is not null as waived,
      coalesce(
        resp.answer = 'not_applicable'::public.answer_value
        and resp.na_validation_status = 'approved'::public.na_validation_status,
        false
      )
      or coalesce(resp.admin_applicability_status = 'not_applicable', false)
        as effective_not_applicable,
      case
        when jsonb_typeof(qv.evidence_parameter -> 'required') = 'boolean'
          then (qv.evidence_parameter ->> 'required')::boolean
        else false
      end as requires_evidence,
      resp.answer,
      resp.admin_proof_status,
      exists (
        select 1
        from public.evidences e
        where e.response_id = resp.id
          and e.deactivated_at is null
      ) as has_active_evidence,
      exists (
        select 1
        from public.evidences e
        where e.response_id = resp.id
          and e.deactivated_at is null
          and e.validation_status = 'approved'::public.evidence_validation_status
      ) as has_approved_evidence,
      exists (
        select 1
        from public.evidences e
        where e.response_id = resp.id
          and e.deactivated_at is null
          and e.validation_status = 'invalidated'::public.evidence_validation_status
      ) as has_invalidated_evidence,
      coalesce(
        nullif(btrim(qv.library_binding_snapshot #>> '{bindings,defaultRecommendation,textoBaseFixo}'), ''),
        nullif(btrim(qv.library_binding_snapshot #>> '{bindings,defaultRecommendation,textoBaseParametrizavel}'), ''),
        nullif(btrim(qv.library_binding_snapshot #>> '{bindings,defaultRecommendation,title}'), '')
      ) as recommendation_text
    from cycle_scope cs
    join public.form_questions fq on fq.form_version_id = cs.form_version_id
    join public.question_versions qv on qv.id = fq.question_version_id
    left join public.responses resp
      on resp.cycle_id = p_cycle_id
     and resp.question_version_id = qv.id
    left join public.question_organization_waivers w
      on w.organization_id = cs.organization_id
     and w.question_id = qv.question_id
  )
  select
    question_version_id,
    case
      when answer = 'no'::public.answer_value
        then 'nao_implementacao'::public.recommendation_type
      when answer = 'yes'::public.answer_value
       and requires_evidence
       and (
         admin_proof_status = 'considered_insufficient'
         or (
           has_active_evidence
           and not has_approved_evidence
           and has_invalidated_evidence
         )
       )
        then 'evidencia_insuficiente'::public.recommendation_type
      when answer = 'yes'::public.answer_value
       and requires_evidence
       and not has_active_evidence
        then 'ausencia_evidencia'::public.recommendation_type
      else null::public.recommendation_type
    end as tipo,
    case
      when answer = 'no'::public.answer_value
        then 'resposta_nao'
      when answer = 'yes'::public.answer_value
       and requires_evidence
       and (
         admin_proof_status = 'considered_insufficient'
         or (
           has_active_evidence
           and not has_approved_evidence
           and has_invalidated_evidence
         )
       )
        then 'evidencia_invalida'
      when answer = 'yes'::public.answer_value
       and requires_evidence
       and not has_active_evidence
        then 'evidencia_ausente'
      else null
    end as recommendation_trigger,
    recommendation_text
  from question_state
  where applies_to_respondent
    and not waived
    and not effective_not_applicable
    and answer is not null
    and (
      answer = 'no'::public.answer_value
      or (
        answer = 'yes'::public.answer_value
        and requires_evidence
        and (
          admin_proof_status = 'considered_insufficient'
          or not has_active_evidence
          or (not has_approved_evidence and has_invalidated_evidence)
        )
      )
    );
$$;

create or replace function public.get_validation_finalization_readiness(
  p_cycle_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_cycle public.cycles%rowtype;
  v_pending_evidence_count integer := 0;
  v_pending_na_count integer := 0;
  v_undecided_absent_count integer := 0;
  v_incomplete_response_count integer := 0;
  v_missing_recommendation_count integer := 0;
  v_has_working_processing boolean := false;
begin
  if p_cycle_id is null then
    raise exception 'validation_finalization_readiness_requires_cycle'
      using errcode = '22023';
  end if;

  select *
    into v_cycle
  from public.cycles
  where id = p_cycle_id;

  if not found then
    raise exception 'validation_finalization_readiness_cycle_not_found'
      using errcode = 'P0002';
  end if;

  select count(*)::integer
    into v_pending_evidence_count
  from public.evidences e
  join public.responses resp on resp.id = e.response_id
  where resp.cycle_id = p_cycle_id
    and coalesce(resp.admin_applicability_status, '') <> 'not_applicable'
    and e.deactivated_at is null
    and e.validation_status in (
      'pending'::public.evidence_validation_status,
      'adjustment_requested'::public.evidence_validation_status
    );

  select count(*)::integer
    into v_pending_na_count
  from public.responses resp
  where resp.cycle_id = p_cycle_id
    and resp.answer = 'not_applicable'::public.answer_value
    and resp.na_validation_status = 'pending'::public.na_validation_status;

  select count(*)::integer
    into v_undecided_absent_count
  from public.responses resp
  join public.question_versions qv on qv.id = resp.question_version_id
  where resp.cycle_id = p_cycle_id
    and resp.answer = 'yes'::public.answer_value
    and coalesce(resp.admin_applicability_status, '') <> 'not_applicable'
    and coalesce((qv.evidence_parameter->>'required')::boolean, false)
    and resp.admin_proof_status is distinct from 'validated_without_proof'
    and resp.admin_proof_status is distinct from 'considered_insufficient'
    and not exists (
      select 1
      from public.evidences e
      where e.response_id = resp.id
        and e.deactivated_at is null
    )
    and (
      resp.admin_proof_status is null
      or resp.admin_proof_status = 'proof_requested'
    );

  select count(*)::integer
    into v_incomplete_response_count
  from public.form_questions fq
  join public.question_versions qv on qv.id = fq.question_version_id
  left join public.responses resp
    on resp.cycle_id = p_cycle_id
   and resp.question_version_id = qv.id
  where fq.form_version_id = v_cycle.form_version_id
    and qv.applies_to_respondent
    and not exists (
      select 1
      from public.question_organization_waivers w
      where w.organization_id = v_cycle.organization_id
        and w.question_id = qv.question_id
    )
    and not coalesce(
      resp.answer = 'not_applicable'::public.answer_value
      and resp.na_validation_status = 'approved'::public.na_validation_status,
      false
    )
    and not coalesce(
      resp.admin_applicability_status = 'not_applicable',
      false
    )
    and resp.id is null;

  v_has_working_processing := public.cycle_working_processing(p_cycle_id) is not null;

  select count(*)::integer
    into v_missing_recommendation_count
  from public.calculate_live_recommendations(p_cycle_id) rec
  where rec.recommendation_text is null;

  return jsonb_build_object(
    'cycleId', p_cycle_id,
    'state', v_cycle.state,
    'ready',
      v_cycle.state = 'in_validation'::public.cycle_state
      and v_pending_evidence_count = 0
      and v_pending_na_count = 0
      and v_undecided_absent_count = 0
      and v_incomplete_response_count = 0
      and v_missing_recommendation_count = 0
      and v_has_working_processing,
    'blockers', jsonb_build_object(
      'pendingEvidence', v_pending_evidence_count,
      'pendingNotApplicable', v_pending_na_count,
      'undecidedAbsentProof', v_undecided_absent_count,
      'incompleteResponses', v_incomplete_response_count,
      'missingRecommendations', v_missing_recommendation_count,
      'missingWorkingProcessing', not v_has_working_processing
    )
  );
end;
$$;

create or replace function public.list_validation_finalization_readiness(
  p_cycle_ids uuid[]
)
returns table (
  cycle_id uuid,
  ready boolean,
  blockers jsonb
)
language sql
security definer
set search_path = public, pg_temp
stable
as $$
  select
    requested.cycle_id,
    coalesce((readiness.payload->>'ready')::boolean, false) as ready,
    coalesce(readiness.payload->'blockers', '{}'::jsonb) as blockers
  from unnest(coalesce(p_cycle_ids, array[]::uuid[])) with ordinality
    as requested(cycle_id, position)
  join public.cycles c on c.id = requested.cycle_id
  cross join lateral (
    select public.get_validation_finalization_readiness(c.id) as payload
  ) readiness
  order by requested.position;
$$;

create or replace function public.get_validation_queue_summary(
  p_cycle_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_form_version_id uuid;
  v_evidence jsonb;
  v_na jsonb;
  v_evidence_sections jsonb;
  v_na_sections jsonb;
  v_form_sections jsonb;
begin
  if p_cycle_id is null then
    raise exception 'validation_queue_summary_requires_cycle' using errcode = '22023';
  end if;
  select form_version_id
    into v_form_version_id
  from public.cycles
  where id = p_cycle_id;
  if v_form_version_id is null then
    raise exception 'validation_queue_summary_cycle_not_found' using errcode = 'P0002';
  end if;

  with evidence_groups as (
    select
      r.id as response_id,
      qv.section_id,
      qv.section_name,
      qv.section_order,
      qv.axis_id,
      qv.axis_name,
      
      case
        when count(e.id) = 0 and r.admin_proof_status = 'validated_without_proof'
          then 'validated_without_proof'
        when count(e.id) = 0 and r.admin_proof_status = 'considered_insufficient'
          then 'considered_insufficient'
        when count(e.id) = 0 and r.admin_proof_status = 'proof_requested'
          then 'proof_requested'
        when count(e.id) = 0 then 'not_presented'
        when bool_or(e.validation_status = 'adjustment_requested'::public.evidence_validation_status)
          then 'adjustment_requested'
        when bool_or(e.validation_status = 'pending'::public.evidence_validation_status)
          then 'pending'
        when bool_or(e.validation_status = 'approved'::public.evidence_validation_status)
          then 'approved'
        else 'invalidated'
      end as group_status
    from public.responses r
    join public.question_versions qv
      on qv.id = r.question_version_id
    left join public.evidences e
      on e.response_id = r.id
     and e.deactivated_at is null
    where r.cycle_id = p_cycle_id
      and r.answer = 'yes'::public.answer_value
      and coalesce(r.admin_applicability_status, '') <> 'not_applicable'
      and coalesce((qv.evidence_parameter->>'required')::boolean, false)
    group by
      r.id,
      qv.section_id,
      qv.section_name,
      qv.section_order,
      qv.axis_id,
      qv.axis_name
  )
  select jsonb_build_object(
    'total', count(*)::integer,
    'pending', count(*) filter (where group_status = 'pending')::integer,
    'approved', count(*) filter (where group_status = 'approved')::integer,
    'invalid', count(*) filter (where group_status in ('invalidated', 'considered_insufficient'))::integer,
    'adjustmentRequested', count(*) filter (where group_status = 'adjustment_requested')::integer,
    'notPresented', count(*) filter (where group_status = 'not_presented')::integer,
    'validatedWithoutProof', count(*) filter (where group_status = 'validated_without_proof')::integer,
    'proofRequested', count(*) filter (where group_status = 'proof_requested')::integer
  )
  into v_evidence
  from evidence_groups;

  with na_groups as (
    select
      r.id as response_id,
      case
        when r.admin_applicability_status = 'not_applicable' then 'approved'
        when r.na_validation_status = 'approved'::public.na_validation_status then 'approved'
        when r.na_validation_status = 'rejected'::public.na_validation_status then 'rejected'
        when r.answer = 'not_applicable'::public.answer_value then 'pending'
        else 'pending'
      end as group_status
    from public.responses r
    join public.question_versions qv
      on qv.id = r.question_version_id
    where r.cycle_id = p_cycle_id
      and (
        r.answer = 'not_applicable'::public.answer_value
        or r.na_validation_status = 'rejected'::public.na_validation_status
        or r.admin_applicability_status = 'not_applicable'
      )
  )
  select jsonb_build_object(
    'total', count(*)::integer,
    'pending', count(*) filter (where group_status = 'pending')::integer,
    'approved', count(*) filter (where group_status = 'approved')::integer,
    'rejected', count(*) filter (where group_status = 'rejected')::integer,
    'eligible', count(*) filter (where group_status = 'eligible')::integer
  )
  into v_na
  from na_groups;

  with evidence_groups as (
    select
      qv.section_id,
      qv.section_name,
      qv.section_order,
      qv.axis_id,
      qv.axis_name,
      
      case
        when count(e.id) = 0 and r.admin_proof_status = 'validated_without_proof'
          then 'validated_without_proof'
        when count(e.id) = 0 and r.admin_proof_status = 'considered_insufficient'
          then 'considered_insufficient'
        when count(e.id) = 0 and r.admin_proof_status = 'proof_requested'
          then 'proof_requested'
        when count(e.id) = 0 then 'not_presented'
        when bool_or(e.validation_status = 'adjustment_requested'::public.evidence_validation_status)
          then 'adjustment_requested'
        when bool_or(e.validation_status = 'pending'::public.evidence_validation_status)
          then 'pending'
        when bool_or(e.validation_status = 'approved'::public.evidence_validation_status)
          then 'approved'
        else 'invalidated'
      end as group_status
    from public.responses r
    join public.question_versions qv
      on qv.id = r.question_version_id
    left join public.evidences e
      on e.response_id = r.id
     and e.deactivated_at is null
    where r.cycle_id = p_cycle_id
      and r.answer = 'yes'::public.answer_value
      and coalesce(r.admin_applicability_status, '') <> 'not_applicable'
      and coalesce((qv.evidence_parameter->>'required')::boolean, false)
    group by
      r.id,
      qv.section_id,
      qv.section_name,
      qv.section_order,
      qv.axis_id,
      qv.axis_name
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', section_id,
        'title', section_name,
        'axisId', axis_id,
        'axisName', axis_name,
        'sectionOrder', section_order,
        'pendingCount', pending_count,
        'completedCount', completed_count,
        'totalCount', total_count
      )
      order by axis_name, section_order, section_name
    ),
    '[]'::jsonb
  )
  into v_evidence_sections
  from (
    select
      section_id,
      section_name,
      section_order,
      axis_id,
      axis_name,
      count(*) filter (
        where group_status in ('pending', 'adjustment_requested', 'not_presented', 'proof_requested')
      )::integer as pending_count,
      count(*) filter (
        where group_status not in ('pending', 'adjustment_requested', 'not_presented', 'proof_requested')
      )::integer as completed_count,
      count(*)::integer as total_count
    from evidence_groups
    group by section_id, section_name, section_order, axis_id, axis_name
  ) section_rows;

  with na_groups as (
    select
      qv.section_id,
      qv.section_name,
      qv.section_order,
      qv.axis_id,
      qv.axis_name,
      case
        when r.admin_applicability_status = 'not_applicable' then 'approved'
        when r.na_validation_status = 'approved'::public.na_validation_status then 'approved'
        when r.na_validation_status = 'rejected'::public.na_validation_status then 'rejected'
        when r.answer = 'not_applicable'::public.answer_value then 'pending'
        else 'pending'
      end as group_status
    from public.responses r
    join public.question_versions qv
      on qv.id = r.question_version_id
    where r.cycle_id = p_cycle_id
      and (
        r.answer = 'not_applicable'::public.answer_value
        or r.na_validation_status = 'rejected'::public.na_validation_status
        or r.admin_applicability_status = 'not_applicable'
      )
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', section_id,
        'title', section_name,
        'axisId', axis_id,
        'axisName', axis_name,
        'sectionOrder', section_order,
        'pendingCount', pending_count,
        'completedCount', completed_count,
        'totalCount', total_count
      )
      order by axis_name, section_order, section_name
    ),
    '[]'::jsonb
  )
  into v_na_sections
  from (
    select
      section_id,
      section_name,
      section_order,
      axis_id,
      axis_name,
      count(*) filter (where group_status = 'pending')::integer as pending_count,
      count(*) filter (where group_status <> 'pending')::integer as completed_count,
      count(*)::integer as total_count
    from na_groups
    group by section_id, section_name, section_order, axis_id, axis_name
  ) section_rows;

  with form_section_rows as (
    select
      qv.section_id,
      min(qv.section_name) as section_name,
      min(qv.section_order) as section_order,
      (array_agg(qv.axis_id order by qv.section_order, qv.prompt))[1] as axis_id,
      (array_agg(qv.axis_name order by qv.section_order, qv.prompt))[1] as axis_name,
      count(*)::integer as criteria_count
    from public.form_questions fq
    join public.question_versions qv
      on qv.id = fq.question_version_id
    where fq.form_version_id = v_form_version_id
    group by qv.section_id
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', fs.section_id,
        'title', fs.section_name,
        'axisId', fs.axis_id,
        'axisName', fs.axis_name,
        'sectionOrder', fs.section_order,
        'criteriaCount', fs.criteria_count,
        'pendingCount', coalesce((ev.obj->>'pendingCount')::integer, 0),
        'completedCount', coalesce((ev.obj->>'completedCount')::integer, 0),
        'totalCount', coalesce((ev.obj->>'totalCount')::integer, 0),
        'naPendingCount', coalesce((na.obj->>'pendingCount')::integer, 0),
        'naCompletedCount', coalesce((na.obj->>'completedCount')::integer, 0),
        'naTotalCount', coalesce((na.obj->>'totalCount')::integer, 0)
      )
      order by fs.axis_name, fs.section_order, fs.section_name
    ),
    '[]'::jsonb
  )
  into v_form_sections
  from form_section_rows fs
  left join lateral (
    select value as obj
    from jsonb_array_elements(coalesce(v_evidence_sections, '[]'::jsonb)) value
    where value->>'id' = fs.section_id::text
    limit 1
  ) ev on true
  left join lateral (
    select value as obj
    from jsonb_array_elements(coalesce(v_na_sections, '[]'::jsonb)) value
    where value->>'id' = fs.section_id::text
    limit 1
  ) na on true;

  return jsonb_build_object(
    'evidence', coalesce(v_evidence, jsonb_build_object(
      'total', 0,
      'pending', 0,
      'approved', 0,
      'invalid', 0,
      'adjustmentRequested', 0,
      'notPresented', 0,
      'validatedWithoutProof', 0,
      'proofRequested', 0
    )),
    'notApplicable', coalesce(v_na, jsonb_build_object(
      'total', 0, 'pending', 0, 'approved', 0, 'rejected', 0, 'eligible', 0
    )),
    'finalization', public.get_validation_finalization_readiness(p_cycle_id),
    'evidenceSections', coalesce(v_evidence_sections, '[]'::jsonb),
    'notApplicableSections', coalesce(v_na_sections, '[]'::jsonb),
    'formSections', coalesce(v_form_sections, '[]'::jsonb)
  );
end;
$$;

create or replace function public.list_validation_queue_page(
  p_cycle_id uuid,
  p_kind text,
  p_section_id uuid default null,
  p_limit integer default 10,
  p_offset integer default 0
)
returns table (
  response_id uuid,
  total_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_kind text := lower(btrim(coalesce(p_kind, 'evidencias')));
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_form_version_id uuid;
begin
  if p_cycle_id is null then
    raise exception 'validation_queue_page_requires_cycle' using errcode = '22023';
  end if;
  if v_kind not in ('evidencias', 'nao-se-aplica') then
    raise exception 'validation_queue_page_invalid_kind' using errcode = '22023';
  end if;
  select form_version_id
    into v_form_version_id
  from public.cycles
  where id = p_cycle_id;
  if v_form_version_id is null then
    raise exception 'validation_queue_page_cycle_not_found' using errcode = 'P0002';
  end if;
  if v_kind = 'evidencias' then
    return query
    with ranked as (
      select
        r.id as response_id,
        case
          when count(e.id) = 0 and r.admin_proof_status = 'validated_without_proof' then 3
          when count(e.id) = 0 and r.admin_proof_status = 'considered_insufficient' then 2
          when count(e.id) = 0 and r.admin_proof_status = 'proof_requested' then 1
          when count(e.id) = 0 then 0
          when bool_or(e.validation_status = 'adjustment_requested'::public.evidence_validation_status)
            then 1
          when bool_or(e.validation_status = 'pending'::public.evidence_validation_status)
            then 0
          when bool_or(e.validation_status = 'approved'::public.evidence_validation_status)
            then 3
          else 2
        end as status_rank,
        qv.axis_name,
        qv.section_order,
        qv.section_name,
        coalesce(fq.order_index, 2147483647) as order_index
      from public.responses r
      join public.question_versions qv
        on qv.id = r.question_version_id
      left join public.evidences e
        on e.response_id = r.id
       and e.deactivated_at is null
      left join public.form_questions fq
        on fq.form_version_id = v_form_version_id
       and fq.question_version_id = r.question_version_id
      where r.cycle_id = p_cycle_id
        and r.answer = 'yes'::public.answer_value
        and coalesce(r.admin_applicability_status, '') <> 'not_applicable'
        and coalesce((qv.evidence_parameter->>'required')::boolean, false)
        and (p_section_id is null or qv.section_id = p_section_id)
      group by
        r.id,
        r.admin_proof_status,
        qv.axis_name,
        qv.section_order,
        qv.section_name,
        fq.order_index
    )
    select
      ranked.response_id,
      count(*) over()::bigint as total_count
    from ranked
    order by
      ranked.status_rank,
      ranked.axis_name,
      ranked.section_order,
      ranked.section_name,
      ranked.order_index,
      ranked.response_id
    limit v_limit
    offset v_offset;
    return;
  end if;
  return query
  with ranked as (
    select
      r.id as response_id,
      case
        when r.admin_applicability_status = 'not_applicable' then 2
        when r.na_validation_status = 'rejected'::public.na_validation_status then 1
        when r.answer = 'not_applicable'::public.answer_value
             and (
               r.na_validation_status = 'pending'::public.na_validation_status
               or r.na_validation_status is null
             ) then 0
        when r.na_validation_status = 'approved'::public.na_validation_status then 2
        else 2
      end as status_rank,
      qv.axis_name,
      qv.section_order,
      qv.section_name,
      coalesce(fq.order_index, 2147483647) as order_index
    from public.responses r
    join public.question_versions qv
      on qv.id = r.question_version_id
    left join public.form_questions fq
      on fq.form_version_id = v_form_version_id
     and fq.question_version_id = r.question_version_id
    where r.cycle_id = p_cycle_id
      and (
        r.answer = 'not_applicable'::public.answer_value
        or r.na_validation_status = 'rejected'::public.na_validation_status
        or r.admin_applicability_status = 'not_applicable'
      )
      and (p_section_id is null or qv.section_id = p_section_id)
  )
  select
    ranked.response_id,
    count(*) over()::bigint as total_count
  from ranked
  order by
    ranked.status_rank,
    ranked.axis_name,
    ranked.section_order,
    ranked.section_name,
    ranked.order_index,
    ranked.response_id
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.finalize_validation_cycle(
  p_cycle_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_processing_id uuid;
  v_existing_completed_processing_id uuid;
  v_pending_count integer;
  v_pending_na_count integer;
  v_incomplete_count integer;
  v_missing_recommendation_text_count integer;
  v_undecided_absent_count integer;
  v_created integer := 0;
  v_removed integer := 0;
  v_from_state public.cycle_state;
  v_readiness jsonb;
  v_blockers jsonb;
begin
  perform public.set_audit_actor(p_actor_user_id);
  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;
  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;
  v_from_state := v_cycle.state;
  if v_cycle.state not in (
    'in_validation'::public.cycle_state,
    'validated'::public.cycle_state
  ) then
    raise exception 'cycle_not_ready_for_validation_finalization: %', v_cycle.state
      using errcode = 'P0001';
  end if;
  select cp.id into v_existing_completed_processing_id
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
  limit 1;
  if v_cycle.state = 'validated'::public.cycle_state then
    if v_existing_completed_processing_id is not null
       and public.cycle_working_processing(p_cycle_id) is null then
      return jsonb_build_object(
        'cycle_id', p_cycle_id,
        'from_state', v_cycle.state,
        'to_state', v_cycle.state,
        'processing_id', v_existing_completed_processing_id,
        'already_finalized', true,
        'recommendations_synced', 0,
        'recommendations_removed', 0
      );
    end if;
    raise exception 'validated_cycle_without_finalized_processing'
      using errcode = '23514';
  end if;
  perform 1
  from public.responses resp
  where resp.cycle_id = p_cycle_id
  for update;
  perform 1
  from public.evidences e
  join public.responses resp on resp.id = e.response_id
  where resp.cycle_id = p_cycle_id
  for update of e;
  perform 1
  from public.question_organization_waivers w
  join public.question_versions qv on qv.question_id = w.question_id
  join public.form_questions fq on fq.question_version_id = qv.id
  where w.organization_id = v_cycle.organization_id
    and fq.form_version_id = v_cycle.form_version_id
  for share of w;
  v_readiness := public.get_validation_finalization_readiness(p_cycle_id);
  v_blockers := coalesce(v_readiness->'blockers', '{}'::jsonb);
  v_pending_count := coalesce((v_blockers->>'pendingEvidence')::integer, 0);
  v_pending_na_count := coalesce((v_blockers->>'pendingNotApplicable')::integer, 0);
  v_undecided_absent_count := coalesce((v_blockers->>'undecidedAbsentProof')::integer, 0);
  v_incomplete_count := coalesce((v_blockers->>'incompleteResponses')::integer, 0);
  v_missing_recommendation_text_count := coalesce((v_blockers->>'missingRecommendations')::integer, 0);

  if v_pending_count > 0 then
    raise exception 'validation_unresolved_evidence: % evidência(s) pendente(s) ou aguardando ajuste', v_pending_count
      using errcode = 'P0001';
  end if;
  if v_pending_na_count > 0 then
    raise exception 'validation_unresolved_na: % resposta(s) N/A pendente(s) de validação', v_pending_na_count
      using errcode = 'P0001';
  end if;
  if v_undecided_absent_count > 0 then
    raise exception 'validation_unresolved_absent_proof: % critério(s) Sim sem comprovação aguardando decisão administrativa', v_undecided_absent_count
      using errcode = 'P0001';
  end if;
  if v_incomplete_count > 0 then
    raise exception 'validation_incomplete_submission: % critério(s) sem resposta', v_incomplete_count
      using errcode = '23514';
  end if;

  v_processing_id := public.cycle_working_processing(p_cycle_id);
  if v_processing_id is null then
    raise exception 'no_working_processing for cycle %', p_cycle_id
      using errcode = 'P0002';
  end if;
  if v_missing_recommendation_text_count > 0 then
    raise exception 'recommendation_binding_missing: % critério(s) sem recomendação-base publicada',
      v_missing_recommendation_text_count
      using errcode = '23514';
  end if;
  insert into public.recommendations (
    cycle_id,
    cycle_processing_id,
    question_version_id,
    tipo,
    text,
    source,
    origin
  )
  select
    p_cycle_id,
    v_processing_id,
    rec.question_version_id,
    rec.tipo,
    rec.recommendation_text,
    'engine',
    jsonb_build_object(
      'trigger', rec.recommendation_trigger,
      'mode', 'validated',
      'generated_at', now()
    )
  from public.calculate_live_recommendations(p_cycle_id) rec
  on conflict (cycle_id, question_version_id, cycle_processing_id)
  do update set
    tipo = excluded.tipo,
    text = excluded.text,
    source = excluded.source,
    origin = excluded.origin;
  get diagnostics v_created = row_count;
  with deleted as (
    delete from public.recommendations existing
    where existing.cycle_processing_id = v_processing_id
      and existing.source = 'engine'
      and not exists (
        select 1
        from public.calculate_live_recommendations(p_cycle_id) desired
        where desired.question_version_id = existing.question_version_id
      )
    returning 1
  )
  select count(*) into v_removed from deleted;
  update public.cycle_processings cp
  set fami_policy_version = 'v7',
      fami_scoring_model = 'evidence_weighted',
      yes_without_evidence_weight = 1,
      yes_with_approved_evidence_weight = 2,
      thresholds = '[{"level":1,"maxPercentage":20},
                     {"level":2,"maxPercentage":40},
                     {"level":3,"maxPercentage":60},
                     {"level":4,"maxPercentage":80},
                     {"level":5,"maxPercentage":100}]'::jsonb
  where cp.id = v_processing_id;
  insert into public.response_snapshots (
    cycle_processing_id,
    question_version_id,
    answer,
    is_not_applicable,
    na_justification,
    admin_applicability_status,
    admin_na_justification,
    admin_proof_status,
    admin_proof_observation
  )
  select
    v_processing_id,
    resp.question_version_id,
    resp.answer,
    (
      resp.answer = 'not_applicable'::public.answer_value
      and resp.na_validation_status = 'approved'::public.na_validation_status
    ),
    case
      when resp.answer = 'not_applicable'::public.answer_value
       and resp.na_validation_status = 'approved'::public.na_validation_status
        then resp.na_justification
      else null
    end,
    resp.admin_applicability_status,
    case
      when resp.admin_applicability_status = 'not_applicable'
        then resp.admin_na_justification
      else null
    end,
    resp.admin_proof_status,
    resp.admin_proof_observation
  from public.responses resp
  join public.form_questions fq
    on fq.form_version_id = v_cycle.form_version_id
   and fq.question_version_id = resp.question_version_id
  where resp.cycle_id = p_cycle_id;
  insert into public.evidence_snapshots (
    cycle_processing_id,
    response_snapshot_id,
    question_version_id,
    evidence_id,
    kind,
    title,
    text_body,
    storage_path,
    external_link,
    link_reason,
    validation_status,
    validation_justification,
    original_filename,
    mime_type,
    size_bytes,
    sha256
  )
  select
    v_processing_id,
    rs.id,
    resp.question_version_id,
    e.id,
    e.kind,
    e.title,
    e.text_body,
    e.storage_path,
    e.external_link,
    e.link_reason,
    e.validation_status,
    e.validation_justification,
    e.original_filename,
    e.mime_type,
    e.size_bytes,
    e.sha256
  from public.evidences e
  join public.responses resp on resp.id = e.response_id
  join public.response_snapshots rs
    on rs.cycle_processing_id = v_processing_id
   and rs.question_version_id = resp.question_version_id
  where resp.cycle_id = p_cycle_id
    and e.deactivated_at is null;
  insert into public.processing_waiver_snapshots (
    cycle_processing_id,
    question_version_id,
    question_id,
    reason
  )
  select
    v_processing_id,
    qv.id,
    w.question_id,
    w.reason
  from public.question_organization_waivers w
  join public.question_versions qv on qv.question_id = w.question_id
  join public.form_questions fq
    on fq.question_version_id = qv.id
   and fq.form_version_id = v_cycle.form_version_id
  where w.organization_id = v_cycle.organization_id;
  insert into public.fami_results (
    cycle_id,
    cycle_processing_id,
    scope_type,
    scope_id,
    points_obtained,
    points_possible,
    percentage,
    maturity_level
  )
  select
    p_cycle_id,
    v_processing_id,
    row_data.scope_type,
    row_data.scope_id,
    row_data.points_obtained,
    row_data.points_possible,
    row_data.percentage,
    row_data.maturity_level
  from public.calculate_live_fami_rows(p_cycle_id) row_data;
  if not exists (
    select 1
    from public.fami_results fr
    where fr.cycle_processing_id = v_processing_id
      and fr.scope_type = 'global'
      and fr.scope_id is null
  ) then
    raise exception 'validation_fami_materialization_failed'
      using errcode = '23514';
  end if;
  update public.cycle_processings
  set status = 'completed'::public.cycle_processing_status,
      completed_at = now()
  where id = v_processing_id;
  perform set_config('app.validation_transition_origin', 'evidence_queue', true);
  update public.cycles
  set state = 'validated'::public.cycle_state,
      validated_at = now()
  where id = p_cycle_id;
  return jsonb_build_object(
    'cycle_id', p_cycle_id,
    'from_state', v_from_state,
    'to_state', 'validated',
    'processing_id', v_processing_id,
    'already_finalized', false,
    'recommendations_synced', v_created,
    'recommendations_removed', v_removed
  );
end;
$$;

create or replace function public.find_validation_queue_page_for_evidence(
  p_cycle_id uuid,
  p_evidence_id uuid,
  p_section_id uuid default null,
  p_page_size integer default 10
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_response_id uuid;
  v_section_id uuid;
  v_page_size integer := greatest(1, least(coalesce(p_page_size, 10), 50));
  v_offset integer := 0;
  v_index integer := 0;
  v_form_version_id uuid;
begin
  select e.response_id, qv.section_id
    into v_response_id, v_section_id
  from public.evidences e
  join public.responses r on r.id = e.response_id
  join public.question_versions qv on qv.id = r.question_version_id
  where e.id = p_evidence_id
    and r.cycle_id = p_cycle_id
    and e.deactivated_at is null
    and r.answer = 'yes'::public.answer_value
    and coalesce(r.admin_applicability_status, '') <> 'not_applicable'
    and coalesce((qv.evidence_parameter->>'required')::boolean, false);
  if v_response_id is null then
    return jsonb_build_object(
      'found', false,
      'page', 1,
      'sectionId', p_section_id
    );
  end if;

  select form_version_id
    into v_form_version_id
  from public.cycles
  where id = p_cycle_id;

  -- Ranking e ordenação idênticos a list_validation_queue_page (evidencias).
  with grouped as (
    select
      r.id as response_id,
      case
        when count(e.id) = 0 and r.admin_proof_status = 'validated_without_proof' then 3
        when count(e.id) = 0 and r.admin_proof_status = 'considered_insufficient' then 2
        when count(e.id) = 0 and r.admin_proof_status = 'proof_requested' then 1
        when count(e.id) = 0 then 0
        when bool_or(e.validation_status = 'adjustment_requested'::public.evidence_validation_status)
          then 1
        when bool_or(e.validation_status = 'pending'::public.evidence_validation_status)
          then 0
        when bool_or(e.validation_status = 'approved'::public.evidence_validation_status)
          then 3
        else 2
      end as status_rank,
      qv.axis_name,
      qv.section_order,
      qv.section_name,
      coalesce(fq.order_index, 2147483647) as order_index
    from public.responses r
    join public.question_versions qv
      on qv.id = r.question_version_id
    left join public.evidences e
      on e.response_id = r.id
     and e.deactivated_at is null
    left join public.form_questions fq
      on fq.form_version_id = v_form_version_id
     and fq.question_version_id = r.question_version_id
    where r.cycle_id = p_cycle_id
      and r.answer = 'yes'::public.answer_value
      and coalesce(r.admin_applicability_status, '') <> 'not_applicable'
      and coalesce((qv.evidence_parameter->>'required')::boolean, false)
      and (
        p_section_id is null
        or qv.section_id = p_section_id
      )
    group by
      r.id,
      r.admin_proof_status,
      qv.axis_name,
      qv.section_order,
      qv.section_name,
      fq.order_index
  ),
  ranked as (
    select
      grouped.response_id,
      row_number() over (
        order by
          grouped.status_rank,
          grouped.axis_name,
          grouped.section_order,
          grouped.section_name,
          grouped.order_index,
          grouped.response_id
      ) as row_num
    from grouped
  )
  select greatest(row_num - 1, 0)::integer
    into v_index
  from ranked
  where response_id = v_response_id;

  v_offset := (v_index / v_page_size) * v_page_size;
  return jsonb_build_object(
    'found', true,
    'responseId', v_response_id,
    'sectionId', coalesce(p_section_id, v_section_id),
    'page', (v_offset / v_page_size) + 1,
    'pageSize', v_page_size
  );
end;
$$;

create or replace function public.capture_original_response_deadline()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.response_deadline_at is not null
     and new.original_response_deadline_at is null then
    new.original_response_deadline_at := new.response_deadline_at;
  end if;
  return new;
end;
$$;

create or replace function public.notify_cycle_deadline_change(
  p_cycle_id uuid,
  p_action text,
  p_new_deadline_at timestamptz,
  p_justification text,
  p_batch_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_form_name text;
  v_period text;
  v_user record;
  v_title text;
  v_message text;
  v_kind text;
  v_created integer := 0;
begin
  select
    c.organization_id,
    c.period_label,
    coalesce(f.name, 'Diagnóstico')
  into v_org, v_period, v_form_name
  from public.cycles c
  join public.form_versions fv on fv.id = c.form_version_id
  join public.forms f on f.id = fv.form_id
  where c.id = p_cycle_id;

  if v_org is null then
    return 0;
  end if;

  v_kind := case p_action
    when 'suspend' then 'cycle_collection_suspended'
    when 'resume' then 'cycle_collection_resumed'
    when 'reopen_responses' then 'cycle_reopened_for_responses'
    when 'early_close' then 'cycle_deadline_early_closed'
    else 'cycle_deadline_changed'
  end;

  v_title := case p_action
    when 'suspend' then 'Coleta suspensa temporariamente'
    when 'resume' then 'Coleta retomada'
    when 'reopen_responses' then 'Diagnóstico reaberto para respostas'
    when 'early_close' then 'Prazo encerrado antecipadamente'
    else 'Prazo de resposta atualizado'
  end;

  v_message := format(
    '%s (%s). %s%s',
    v_form_name,
    v_period,
    case
      when p_action in ('suspend', 'resume') then ''
      when p_new_deadline_at is null then ''
      else format('Novo prazo: %s. ', to_char(p_new_deadline_at at time zone 'America/Fortaleza', 'DD/MM/YYYY HH24:MI'))
    end,
    btrim(p_justification)
  );

  for v_user in
    select p.user_id
    from public.profiles p
    where p.organization_id = v_org
      and p.role = 'respondent'::public.app_user_role
  loop
    v_created := v_created + public.notify_respondent_user(
      v_user.user_id,
      v_kind,
      v_title,
      v_message,
      format('/respondente/ciclos/%s', p_cycle_id),
      format('cycle-deadline:%s:%s:%s', p_cycle_id, p_action, p_batch_id),
      jsonb_build_object(
        'cycle_id', p_cycle_id,
        'action', p_action,
        'new_deadline_at', p_new_deadline_at,
        'batch_id', p_batch_id
      )
    );
  end loop;

  return v_created;
end;
$$;

create or replace function public.admin_change_cycle_response_deadlines(
  p_cycle_ids uuid[],
  p_new_deadline_at timestamptz,
  p_action text,
  p_scope text,
  p_justification text,
  p_actor_user_id uuid,
  p_batch_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_form_id uuid;
  v_cycle_id uuid;
  v_updated integer := 0;
  v_notifications integer := 0;
  v_allow_past boolean := p_action = 'early_close';
  v_effective_deadline timestamptz := p_new_deadline_at;
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'deadline_actor_not_authorized' using errcode = '42501';
  end if;

  if p_action not in ('change_deadline', 'extend_deadline', 'early_close') then
    raise exception 'deadline_action_invalid' using errcode = '22023';
  end if;
  if p_scope not in ('all', 'selected', 'overdue', 'single') then
    raise exception 'deadline_scope_invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_justification, ''))) < 10 then
    raise exception 'deadline_justification_required' using errcode = '22023';
  end if;
  if p_cycle_ids is null or cardinality(p_cycle_ids) = 0 then
    raise exception 'deadline_cycles_required' using errcode = '22023';
  end if;

  if p_action = 'early_close' then
    v_effective_deadline := least(coalesce(p_new_deadline_at, now()), now());
  elsif p_new_deadline_at is null or p_new_deadline_at <= now() then
    raise exception 'deadline_must_be_future' using errcode = '22023';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  foreach v_cycle_id in array p_cycle_ids loop
    select * into v_cycle
    from public.cycles
    where id = v_cycle_id
    for update;

    if not found then
      raise exception 'cycle_not_found' using errcode = 'P0002';
    end if;

    if v_cycle.state not in (
      'in_response'::public.cycle_state,
      'awaiting_adjustment'::public.cycle_state
    ) then
      raise exception 'deadline_cycle_not_editable: %', v_cycle.state
        using errcode = 'P0001';
    end if;

    if v_cycle.response_collection_paused_at is not null
       and p_action <> 'early_close' then
      raise exception 'deadline_cycle_paused' using errcode = 'P0001';
    end if;

    if p_action = 'extend_deadline'
       and (
         v_cycle.response_deadline_at is null
         or v_cycle.response_deadline_at >= now()
       ) then
      raise exception 'deadline_extend_requires_overdue' using errcode = 'P0001';
    end if;

    if not v_allow_past
       and v_cycle.starts_at is not null
       and v_effective_deadline < v_cycle.starts_at then
      raise exception 'deadline_before_start' using errcode = '22023';
    end if;

    select fv.form_id into v_form_id
    from public.form_versions fv
    where fv.id = v_cycle.form_version_id;

    insert into public.cycle_deadline_events (
      batch_id, cycle_id, form_id, period_label, organization_id,
      action, scope, previous_deadline_at, new_deadline_at,
      justification, actor_user_id
    ) values (
      p_batch_id, v_cycle.id, v_form_id, v_cycle.period_label, v_cycle.organization_id,
      p_action, p_scope, v_cycle.response_deadline_at, v_effective_deadline,
      btrim(p_justification), p_actor_user_id
    );

    update public.cycles
    set response_deadline_at = v_effective_deadline,
        original_response_deadline_at = coalesce(
          original_response_deadline_at,
          response_deadline_at,
          v_effective_deadline
        ),
        deadline_change_count = deadline_change_count + 1,
        validation_deadline_at = case
          when validation_deadline_at is not null
               and validation_deadline_at <= v_effective_deadline
            then null
          else validation_deadline_at
        end,
        cycle_close_at = case
          when cycle_close_at is not null
               and (
                 validation_deadline_at is null
                 or cycle_close_at <= coalesce(validation_deadline_at, v_effective_deadline)
               )
            then null
          else cycle_close_at
        end,
        schedule_revision = schedule_revision + 1
    where id = v_cycle.id;

    perform public.replace_cycle_schedule(v_cycle.id, p_actor_user_id);
    v_notifications := v_notifications + public.notify_cycle_deadline_change(
      v_cycle.id, p_action, v_effective_deadline, btrim(p_justification), p_batch_id
    );
    v_updated := v_updated + 1;
  end loop;

  return jsonb_build_object(
    'batchId', p_batch_id,
    'updated', v_updated,
    'notifications', v_notifications,
    'action', p_action,
    'newDeadlineAt', v_effective_deadline
  );
end;
$$;

create or replace function public.admin_set_cycle_collection_pause(
  p_cycle_ids uuid[],
  p_pause boolean,
  p_scope text,
  p_justification text,
  p_actor_user_id uuid,
  p_batch_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_form_id uuid;
  v_cycle_id uuid;
  v_action text := case when p_pause then 'suspend' else 'resume' end;
  v_updated integer := 0;
  v_notifications integer := 0;
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'pause_actor_not_authorized' using errcode = '42501';
  end if;
  if p_scope not in ('all', 'selected', 'overdue', 'single') then
    raise exception 'pause_scope_invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_justification, ''))) < 10 then
    raise exception 'pause_justification_required' using errcode = '22023';
  end if;
  if p_cycle_ids is null or cardinality(p_cycle_ids) = 0 then
    raise exception 'pause_cycles_required' using errcode = '22023';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  foreach v_cycle_id in array p_cycle_ids loop
    select * into v_cycle
    from public.cycles
    where id = v_cycle_id
    for update;

    if not found then
      raise exception 'cycle_not_found' using errcode = 'P0002';
    end if;

    if v_cycle.state not in (
      'in_response'::public.cycle_state,
      'awaiting_adjustment'::public.cycle_state
    ) then
      raise exception 'pause_cycle_not_editable: %', v_cycle.state
        using errcode = 'P0001';
    end if;

    if p_pause and v_cycle.response_collection_paused_at is not null then
      continue;
    end if;
    if not p_pause and v_cycle.response_collection_paused_at is null then
      continue;
    end if;

    select fv.form_id into v_form_id
    from public.form_versions fv
    where fv.id = v_cycle.form_version_id;

    insert into public.cycle_deadline_events (
      batch_id, cycle_id, form_id, period_label, organization_id,
      action, scope, previous_deadline_at, new_deadline_at,
      justification, actor_user_id
    ) values (
      p_batch_id, v_cycle.id, v_form_id, v_cycle.period_label, v_cycle.organization_id,
      v_action, p_scope, v_cycle.response_deadline_at, v_cycle.response_deadline_at,
      btrim(p_justification), p_actor_user_id
    );

    update public.cycles
    set response_collection_paused_at = case when p_pause then now() else null end,
        response_collection_pause_reason = case when p_pause then btrim(p_justification) else null end
    where id = v_cycle.id;

    v_notifications := v_notifications + public.notify_cycle_deadline_change(
      v_cycle.id, v_action, v_cycle.response_deadline_at, btrim(p_justification), p_batch_id
    );
    v_updated := v_updated + 1;
  end loop;

  return jsonb_build_object(
    'batchId', p_batch_id,
    'updated', v_updated,
    'notifications', v_notifications,
    'action', v_action
  );
end;
$$;

create or replace function app_private.is_cycle_question_collection_editable(
  p_cycle_id uuid,
  p_question_version_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_event_id uuid;
  v_has_scope boolean;
begin
  select * into v_cycle from public.cycles where id = p_cycle_id;
  if not found then
    return false;
  end if;
  if v_cycle.response_collection_paused_at is not null then
    return false;
  end if;
  if v_cycle.state = 'awaiting_adjustment'::public.cycle_state then
    return true;
  end if;
  if v_cycle.state <> 'in_response'::public.cycle_state then
    return false;
  end if;
  if v_cycle.reopen_count <= 0 then
    return true;
  end if;

  select e.id into v_event_id
  from public.cycle_reopen_events e
  where e.cycle_id = p_cycle_id
    and e.reopen_number = v_cycle.reopen_count
  limit 1;

  if v_event_id is null then
    return true;
  end if;

  select exists (
    select 1 from public.cycle_reopen_allowed_questions a
    where a.reopen_event_id = v_event_id
  ) into v_has_scope;

  if not v_has_scope then
    return true;
  end if;

  return exists (
    select 1 from public.cycle_reopen_allowed_questions a
    where a.reopen_event_id = v_event_id
      and a.question_version_id = p_question_version_id
  );
end;
$$;

create or replace function public.admin_reopen_cycles_for_responses(
  p_cycle_ids uuid[],
  p_new_deadline_at timestamptz,
  p_scope text,
  p_justification text,
  p_actor_user_id uuid,
  p_batch_id uuid default gen_random_uuid(),
  p_question_version_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid;
  v_cycle public.cycles%rowtype;
  v_form_id uuid;
  v_reopened integer := 0;
  v_notifications integer := 0;
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'reopen_actor_not_authorized' using errcode = '42501';
  end if;
  if p_scope not in ('all', 'selected', 'overdue', 'single') then
    raise exception 'reopen_scope_invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_justification, ''))) < 10 then
    raise exception 'reopen_reason_required' using errcode = '22023';
  end if;
  if p_new_deadline_at is null or p_new_deadline_at <= now() then
    raise exception 'reopen_deadline_must_be_future' using errcode = '22023';
  end if;
  if p_cycle_ids is null or cardinality(p_cycle_ids) = 0 then
    raise exception 'reopen_cycles_required' using errcode = '22023';
  end if;

  foreach v_cycle_id in array p_cycle_ids loop
    select * into v_cycle from public.cycles where id = v_cycle_id;
    if not found then
      raise exception 'cycle_not_found' using errcode = 'P0002';
    end if;
    if v_cycle.state = 'validated'::public.cycle_state then
      raise exception 'reopen_requires_validation_round'
        using errcode = 'P0001',
          hint = 'Órgão com FAMI/validação concluída exige reabertura da validação (nova rodada) antes da recoleta.';
    end if;

    select fv.form_id into v_form_id
    from public.form_versions fv
    where fv.id = v_cycle.form_version_id;

    perform public.reopen_cycle(
      v_cycle_id,
      p_actor_user_id,
      btrim(p_justification),
      p_new_deadline_at,
      p_question_version_ids
    );

    insert into public.cycle_deadline_events (
      batch_id, cycle_id, form_id, period_label, organization_id,
      action, scope, previous_deadline_at, new_deadline_at,
      justification, actor_user_id
    ) values (
      p_batch_id,
      v_cycle.id,
      v_form_id,
      v_cycle.period_label,
      v_cycle.organization_id,
      'reopen_responses',
      p_scope,
      v_cycle.response_deadline_at,
      p_new_deadline_at,
      btrim(p_justification),
      p_actor_user_id
    );

    v_notifications := v_notifications + public.notify_cycle_deadline_change(
      v_cycle_id, 'reopen_responses', p_new_deadline_at, btrim(p_justification), p_batch_id
    );
    v_reopened := v_reopened + 1;
  end loop;

  return jsonb_build_object(
    'batchId', p_batch_id,
    'reopened', v_reopened,
    'notifications', v_notifications,
    'newDeadlineAt', p_new_deadline_at,
    'partialScopeCount', coalesce(cardinality(p_question_version_ids), 0)
  );
end;
$$;

create or replace function public.admin_reopen_validation_cycles(
  p_cycle_ids uuid[],
  p_scope text,
  p_justification text,
  p_actor_user_id uuid,
  p_batch_id uuid default gen_random_uuid()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid;
  v_reopened integer := 0;
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'validation_reopen_actor_not_authorized' using errcode = '42501';
  end if;
  if p_scope not in ('all', 'selected', 'overdue', 'single') then
    raise exception 'validation_reopen_scope_invalid' using errcode = '22023';
  end if;
  if char_length(btrim(coalesce(p_justification, ''))) < 10 then
    raise exception 'validation_reopen_reason_required' using errcode = '22023';
  end if;
  if p_cycle_ids is null or cardinality(p_cycle_ids) = 0 then
    raise exception 'validation_reopen_cycles_required' using errcode = '22023';
  end if;

  foreach v_cycle_id in array p_cycle_ids loop
    -- Histórico oficial fica em cycle_validation_reopen_events (RPC).
    perform public.reopen_validation_cycle(
      v_cycle_id,
      p_actor_user_id,
      btrim(p_justification)
    );
    v_reopened := v_reopened + 1;
  end loop;

  return jsonb_build_object(
    'batchId', p_batch_id,
    'reopened', v_reopened,
    'action', 'reopen_validation'
  );
end;
$$;

create or replace function public.validation_form_axis_rank(p_axis_name text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when lower(coalesce(p_axis_name, '')) like 'governan%' then 0
    when lower(coalesce(p_axis_name, '')) like 'ambiental%' then 1
    when lower(coalesce(p_axis_name, '')) like 'social%' then 2
    else 100
  end;
$$;

create or replace function public.get_validation_form_summary(
  p_cycle_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_form_version_id uuid;
  v_summary jsonb;
  v_sections jsonb;
begin
  if p_cycle_id is null then
    raise exception 'validation_form_summary_requires_cycle' using errcode = '22023';
  end if;

  select form_version_id
    into v_form_version_id
  from public.cycles
  where id = p_cycle_id;

  if v_form_version_id is null then
    raise exception 'validation_form_summary_cycle_not_found' using errcode = 'P0002';
  end if;

  with base as (
    select
      r.id as response_id,
      r.answer,
      qv.section_id,
      qv.section_name,
      qv.section_order,
      qv.axis_id,
      qv.axis_name,
      coalesce((qv.evidence_parameter->>'required')::boolean, false) as requires_evidence,
      qv.allows_not_applicable,
      coalesce(doc.document_count, 0) as document_count,
      case
        when r.admin_applicability_status = 'not_applicable' then 'admin_na'
        when r.answer = 'not_applicable'::public.answer_value
             and coalesce(r.na_validation_status, 'pending'::public.na_validation_status)
               = 'pending'::public.na_validation_status
          then 'na_pending'
        when r.answer = 'not_applicable'::public.answer_value
             and r.na_validation_status = 'approved'::public.na_validation_status
          then 'na_approved'
        when r.answer = 'not_applicable'::public.answer_value
             and r.na_validation_status = 'rejected'::public.na_validation_status
          then 'na_rejected'
        when r.answer = 'no'::public.answer_value
             and qv.allows_not_applicable
             and r.admin_proof_status is null
             and r.admin_applicability_status is null
             and r.na_validation_status is distinct from 'rejected'::public.na_validation_status
          then 'na_eligible'
        when r.answer = 'no'::public.answer_value then 'no_regular'
        when r.answer = 'yes'::public.answer_value
             and not coalesce((qv.evidence_parameter->>'required')::boolean, false)
          then 'yes_no_evidence'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.document_count, 0) = 0
             and r.admin_proof_status = 'validated_without_proof'
          then 'validated_without_proof'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.document_count, 0) = 0
             and r.admin_proof_status = 'considered_insufficient'
          then 'considered_insufficient'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.document_count, 0) = 0
             and r.admin_proof_status = 'proof_requested'
          then 'proof_requested'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.document_count, 0) = 0
          then 'not_presented'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.has_adjustment, false)
          then 'adjustment_requested'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.has_pending, false)
          then 'pending'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.has_approved, false)
          then 'approved'
        when r.answer = 'yes'::public.answer_value
          then 'invalidated'
        else 'other'
      end as bucket
    from public.responses r
    join public.question_versions qv
      on qv.id = r.question_version_id
    left join lateral (
      select
        count(e.id)::integer as document_count,
        bool_or(e.validation_status = 'adjustment_requested'::public.evidence_validation_status) as has_adjustment,
        bool_or(e.validation_status = 'pending'::public.evidence_validation_status) as has_pending,
        bool_or(e.validation_status = 'approved'::public.evidence_validation_status) as has_approved
      from public.evidences e
      where e.response_id = r.id
        and e.deactivated_at is null
    ) doc on true
    where r.cycle_id = p_cycle_id
  ),
  classified as (
    select
      *,
      case
        when bucket in (
          'na_pending',
          'pending',
          'not_presented',
          'proof_requested',
          'adjustment_requested'
        ) then 'pending_admin'
        when bucket in (
          'admin_na',
          'na_approved',
          'na_rejected',
          'approved',
          'invalidated',
          'considered_insufficient',
          'validated_without_proof'
        ) then 'analyzed'
        else 'no_validation'
      end as validation_need
    from base
  )
  select jsonb_build_object(
    'totalCriteria', count(*)::integer,
    'answerYes', count(*) filter (where answer = 'yes'::public.answer_value)::integer,
    'answerNo', count(*) filter (where answer = 'no'::public.answer_value)::integer,
    'answerNotApplicable', count(*) filter (where answer = 'not_applicable'::public.answer_value)::integer,
    'pendingAnalysis', count(*) filter (where validation_need = 'pending_admin')::integer,
    'analyzed', count(*) filter (where validation_need = 'analyzed')::integer,
    'noValidationNeeded', count(*) filter (where validation_need = 'no_validation')::integer
  )
  into v_summary
  from classified;

  with base as (
    select
      r.id as response_id,
      qv.section_id,
      qv.section_name,
      qv.section_order,
      qv.axis_id,
      qv.axis_name,
      case
        when r.admin_applicability_status = 'not_applicable' then 'analyzed'
        when r.answer = 'not_applicable'::public.answer_value
             and coalesce(r.na_validation_status, 'pending'::public.na_validation_status)
               = 'pending'::public.na_validation_status
          then 'pending_admin'
        when r.answer = 'not_applicable'::public.answer_value then 'analyzed'
        when r.answer = 'no'::public.answer_value then 'no_validation'
        when r.answer = 'yes'::public.answer_value
             and not coalesce((qv.evidence_parameter->>'required')::boolean, false)
          then 'no_validation'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.document_count, 0) = 0
             and r.admin_proof_status in (
               'validated_without_proof',
               'considered_insufficient'
             )
          then 'analyzed'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.document_count, 0) = 0
          then 'pending_admin'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.has_adjustment, false)
          then 'pending_admin'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.has_pending, false)
          then 'pending_admin'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.has_approved, false)
          then 'analyzed'
        when r.answer = 'yes'::public.answer_value
          then 'analyzed'
        else 'no_validation'
      end as validation_need
    from public.responses r
    join public.question_versions qv
      on qv.id = r.question_version_id
    left join lateral (
      select
        count(e.id)::integer as document_count,
        bool_or(e.validation_status = 'adjustment_requested'::public.evidence_validation_status) as has_adjustment,
        bool_or(e.validation_status = 'pending'::public.evidence_validation_status) as has_pending,
        bool_or(e.validation_status = 'approved'::public.evidence_validation_status) as has_approved
      from public.evidences e
      where e.response_id = r.id
        and e.deactivated_at is null
    ) doc on true
    where r.cycle_id = p_cycle_id
  ),
  form_sections as (
    select
      qv.section_id as id,
      qv.section_name as title,
      qv.axis_id as "axisId",
      qv.axis_name as "axisName",
      qv.section_order as "sectionOrder",
      count(*)::integer as "criteriaCount"
    from public.form_questions fq
    join public.question_versions qv
      on qv.id = fq.question_version_id
    where fq.form_version_id = v_form_version_id
    group by
      qv.section_id,
      qv.section_name,
      qv.axis_id,
      qv.axis_name,
      qv.section_order
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', fs.id,
        'title', fs.title,
        'axisId', fs."axisId",
        'axisName', fs."axisName",
        'sectionOrder', fs."sectionOrder",
        'criteriaCount', fs."criteriaCount",
        'pendingCount', coalesce(sec.pending_count, 0),
        'completedCount', coalesce(sec.completed_count, 0),
        'totalCount', coalesce(sec.total_count, 0)
      )
      order by
        public.validation_form_axis_rank(fs."axisName"),
        fs."sectionOrder",
        fs.title
    ),
    '[]'::jsonb
  )
  into v_sections
  from form_sections fs
  left join (
    select
      section_id,
      count(*) filter (where validation_need = 'pending_admin')::integer as pending_count,
      count(*) filter (where validation_need = 'analyzed')::integer as completed_count,
      count(*)::integer as total_count
    from base
    group by section_id
  ) sec on sec.section_id = fs.id;

  return jsonb_build_object(
    'summary', coalesce(v_summary, '{}'::jsonb),
    'formSections', coalesce(v_sections, '[]'::jsonb)
  );
end;
$$;

create or replace function public.list_validation_form_page(
  p_cycle_id uuid,
  p_scope text default 'pendentes',
  p_section_id uuid default null,
  p_answer text default null,
  p_situation text default null,
  p_decision text default null,
  p_proof text default null,
  p_search text default null,
  p_limit integer default 10,
  p_offset integer default 0,
  p_mode text default 'fila',
  p_axis_id uuid default null
)
returns table (
  response_id uuid,
  total_count bigint
)
language plpgsql
security definer
set search_path = public, pg_temp
stable
as $$
declare
  v_mode text := lower(btrim(coalesce(p_mode, 'fila')));
  v_scope text := lower(btrim(coalesce(p_scope, 'pendentes')));
  v_answer text := nullif(lower(btrim(coalesce(p_answer, ''))), '');
  v_situation text := nullif(lower(btrim(coalesce(p_situation, ''))), '');
  v_decision text := nullif(lower(btrim(coalesce(p_decision, ''))), '');
  v_proof text := nullif(lower(btrim(coalesce(p_proof, ''))), '');
  v_search text := nullif(lower(btrim(coalesce(p_search, ''))), '');
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_form_version_id uuid;
begin
  if p_cycle_id is null then
    raise exception 'validation_form_page_requires_cycle' using errcode = '22023';
  end if;
  if v_mode not in ('fila', 'formulario', 'queue', 'form') then
    raise exception 'validation_form_page_invalid_mode' using errcode = '22023';
  end if;
  if v_mode = 'queue' then v_mode := 'fila'; end if;
  if v_mode = 'form' then v_mode := 'formulario'; end if;

  if v_scope in ('todos-itens', 'fila') then v_scope := 'todos'; end if;
  if v_scope in ('concluidos', 'concluida') then v_scope := 'analisados'; end if;
  if v_scope not in ('pendentes', 'todos', 'analisados', 'pending', 'all', 'analyzed') then
    raise exception 'validation_form_page_invalid_scope' using errcode = '22023';
  end if;
  if v_scope = 'pending' then v_scope := 'pendentes'; end if;
  if v_scope = 'all' then v_scope := 'todos'; end if;
  if v_scope = 'analyzed' then v_scope := 'analisados'; end if;

  -- Na fila, o escopo "todos" significa todos os itens da fila (não o formulário).
  if v_mode = 'fila' and v_scope = 'todos' and v_situation is null then
    v_situation := null;
  end if;

  select form_version_id
    into v_form_version_id
  from public.cycles
  where id = p_cycle_id;
  if v_form_version_id is null then
    raise exception 'validation_form_page_cycle_not_found' using errcode = 'P0002';
  end if;

  return query
  with ranked as (
    select
      r.id as response_id,
      r.answer,
      qv.prompt,
      qv.section_id,
      qv.section_name,
      qv.section_order,
      qv.axis_id,
      qv.axis_name,
      coalesce(fq.order_index, 2147483647) as order_index,
      coalesce((qv.evidence_parameter->>'required')::boolean, false) as requires_evidence,
      qv.allows_not_applicable,
      coalesce(doc.document_count, 0) as document_count,
      coalesce(r.notes, '') as notes,
      coalesce(r.na_justification, '') as na_justification,
      case
        when r.admin_applicability_status = 'not_applicable' then 'admin_na'
        when r.answer = 'not_applicable'::public.answer_value
             and coalesce(r.na_validation_status, 'pending'::public.na_validation_status)
               = 'pending'::public.na_validation_status
          then 'na_pending'
        when r.answer = 'not_applicable'::public.answer_value
             and r.na_validation_status = 'approved'::public.na_validation_status
          then 'na_approved'
        when r.answer = 'not_applicable'::public.answer_value
             and r.na_validation_status = 'rejected'::public.na_validation_status
          then 'na_rejected'
        when r.answer = 'no'::public.answer_value
             and qv.allows_not_applicable
             and r.admin_proof_status is null
             and r.admin_applicability_status is null
             and r.na_validation_status is distinct from 'rejected'::public.na_validation_status
          then 'na_eligible'
        when r.answer = 'no'::public.answer_value then 'no_regular'
        when r.answer = 'yes'::public.answer_value
             and not coalesce((qv.evidence_parameter->>'required')::boolean, false)
          then 'yes_no_evidence'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.document_count, 0) = 0
             and r.admin_proof_status = 'validated_without_proof'
          then 'validated_without_proof'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.document_count, 0) = 0
             and r.admin_proof_status = 'considered_insufficient'
          then 'considered_insufficient'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.document_count, 0) = 0
             and r.admin_proof_status = 'proof_requested'
          then 'proof_requested'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.document_count, 0) = 0
          then 'not_presented'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.has_adjustment, false)
          then 'adjustment_requested'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.has_pending, false)
          then 'pending'
        when r.answer = 'yes'::public.answer_value
             and coalesce(doc.has_approved, false)
          then 'approved'
        when r.answer = 'yes'::public.answer_value
          then 'invalidated'
        else 'other'
      end as bucket
    from public.responses r
    join public.question_versions qv
      on qv.id = r.question_version_id
    left join public.form_questions fq
      on fq.form_version_id = v_form_version_id
     and fq.question_version_id = r.question_version_id
    left join lateral (
      select
        count(e.id)::integer as document_count,
        bool_or(e.validation_status = 'adjustment_requested'::public.evidence_validation_status) as has_adjustment,
        bool_or(e.validation_status = 'pending'::public.evidence_validation_status) as has_pending,
        bool_or(e.validation_status = 'approved'::public.evidence_validation_status) as has_approved
      from public.evidences e
      where e.response_id = r.id
        and e.deactivated_at is null
    ) doc on true
    where r.cycle_id = p_cycle_id
      and (p_section_id is null or qv.section_id = p_section_id)
      and (p_axis_id is null or qv.axis_id = p_axis_id)
  ),
  classified as (
    select
      ranked.*,
      case
        when bucket in (
          'na_pending',
          'pending',
          'not_presented',
          'proof_requested',
          'adjustment_requested'
        ) then 'pending_admin'
        when bucket in (
          'admin_na',
          'na_approved',
          'na_rejected',
          'approved',
          'invalidated',
          'considered_insufficient',
          'validated_without_proof'
        ) then 'analyzed'
        else 'no_validation'
      end as validation_need,
      case
        when bucket in ('proof_requested', 'adjustment_requested') then 'awaiting_complement'
        when bucket in (
          'na_pending',
          'pending',
          'not_presented'
        ) then 'pending'
        when bucket in (
          'admin_na',
          'na_approved',
          'na_rejected',
          'approved',
          'invalidated',
          'considered_insufficient',
          'validated_without_proof'
        ) then 'completed'
        else 'no_validation_needed'
      end as analysis_situation,
      case
        when bucket = 'admin_na' then 'not_applicable'
        when bucket = 'na_approved' then 'not_applicable'
        when bucket = 'approved' then 'approved'
        when bucket = 'validated_without_proof' then 'validated_without_proof'
        when bucket in ('invalidated', 'considered_insufficient') then 'insufficient'
        else 'none'
      end as admin_decision,
      case
        when not requires_evidence then 'not_required'
        when document_count > 0 then 'with_documents'
        else 'without_documents'
      end as proof_bucket
    from ranked
  ),
  filtered as (
    select *
    from classified
    where
      (
        v_mode = 'formulario'
        or validation_need in ('pending_admin', 'analyzed')
      )
      and (
        v_mode = 'formulario'
        or (
          -- Fila: situação/escopo operam sobre itens elegíveis
          (
            v_situation is null
            and (
              (v_scope = 'pendentes' and analysis_situation in ('pending', 'awaiting_complement'))
              or (v_scope = 'analisados' and analysis_situation = 'completed')
              or v_scope = 'todos'
            )
          )
          or (
            v_situation is not null
            and (
              (v_situation in ('pendente', 'pending') and analysis_situation = 'pending')
              or (
                v_situation in ('aguardando-complementacao', 'awaiting_complement')
                and analysis_situation = 'awaiting_complement'
              )
              or (v_situation in ('concluidos', 'concluida', 'completed') and analysis_situation = 'completed')
              or v_situation in ('todas', 'all', 'todos-itens')
            )
          )
        )
      )
      and (
        v_mode = 'fila'
        or v_scope = 'todos'
        or (v_scope = 'pendentes' and validation_need = 'pending_admin')
        or (v_scope = 'analisados' and validation_need = 'analyzed')
      )
      and (
        v_answer is null
        or v_answer in ('todas', 'all')
        or (v_answer in ('sim', 'yes') and answer = 'yes'::public.answer_value)
        or (v_answer in ('nao', 'não', 'no') and answer = 'no'::public.answer_value)
        or (
          v_answer in ('nao-se-aplica', 'not_applicable', 'na')
          and answer = 'not_applicable'::public.answer_value
        )
      )
      and (
        v_mode = 'fila'
        or v_situation is null
        or v_situation in ('todas', 'all', 'todos-itens')
        or (v_situation in ('pendente', 'pending') and analysis_situation = 'pending')
        or (v_situation in ('concluida', 'concluidos', 'completed') and analysis_situation = 'completed')
        or (
          v_situation in ('aguardando-complementacao', 'awaiting_complement')
          and analysis_situation = 'awaiting_complement'
        )
        or (
          v_situation in ('sem-necessidade', 'no_validation_needed')
          and analysis_situation = 'no_validation_needed'
        )
      )
      and (
        v_decision is null
        or v_decision in ('todas', 'all')
        or (v_decision in ('sem-decisao', 'none') and admin_decision = 'none')
        or (v_decision in ('aprovada', 'approved') and admin_decision = 'approved')
        or (
          v_decision in ('validada-sem-comprovacao', 'validated_without_proof')
          and admin_decision = 'validated_without_proof'
        )
        or (
          v_decision in ('insuficiente', 'insufficient')
          and admin_decision = 'insufficient'
        )
        or (
          v_decision in ('nao-se-aplica', 'not_applicable')
          and admin_decision = 'not_applicable'
        )
      )
      and (
        v_proof is null
        or v_proof in ('todas', 'all')
        or (v_proof in ('com-documentos', 'with_documents') and proof_bucket = 'with_documents')
        or (v_proof in ('sem-documentos', 'without_documents') and proof_bucket = 'without_documents')
        or (v_proof in ('nao-exige', 'not_required') and proof_bucket = 'not_required')
      )
      and (
        v_search is null
        or strpos(lower(prompt), v_search) > 0
        or strpos(lower(section_name), v_search) > 0
        or strpos(lower(axis_name), v_search) > 0
        or strpos(lower(notes), v_search) > 0
        or strpos(lower(na_justification), v_search) > 0
        or strpos((order_index + 1)::text, v_search) > 0
      )
  )
  select
    filtered.response_id,
    count(*) over()::bigint as total_count
  from filtered
  order by
    public.validation_form_axis_rank(filtered.axis_name),
    filtered.section_order,
    filtered.section_name,
    filtered.order_index,
    filtered.response_id
  limit v_limit
  offset v_offset;
end;
$$;

create or replace function public.mark_validation_analysis_draft_applied(
  p_cycle_id uuid,
  p_target_kind text,
  p_evidence_id uuid default null,
  p_response_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.validation_analysis_drafts
  set
    applied_at = clock_timestamp(),
    revision = revision + 1
  where cycle_id = p_cycle_id
    and target_kind = p_target_kind
    and applied_at is null
    and evidence_id is not distinct from p_evidence_id
    and response_id is not distinct from p_response_id;
end;
$$;

create or replace function public.trg_apply_validation_analysis_draft_on_evidence()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle_id uuid;
begin
  if tg_op = 'UPDATE'
     and old.validation_status is distinct from new.validation_status
     and new.validation_status <> 'pending'::public.evidence_validation_status then
    select r.cycle_id into v_cycle_id
    from public.responses r
    where r.id = new.response_id;

    if v_cycle_id is not null then
      perform public.mark_validation_analysis_draft_applied(
        v_cycle_id,
        'evidence',
        new.id,
        null
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.trg_apply_validation_analysis_draft_on_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' then
    if old.na_validation_status is distinct from new.na_validation_status
       and new.na_validation_status is not null
       and new.na_validation_status <> 'pending'::public.na_validation_status then
      perform public.mark_validation_analysis_draft_applied(
        new.cycle_id,
        'not_applicable',
        null,
        new.id
      );
    end if;

    -- Marca o rascunho também quando a comprovação é limpa (null) no reenvio.
    if old.admin_proof_status is distinct from new.admin_proof_status
       and (
         new.admin_proof_status is not null
         or old.admin_proof_status is not null
       ) then
      perform public.mark_validation_analysis_draft_applied(
        new.cycle_id,
        'absent_proof',
        null,
        new.id
      );
    end if;

    if old.admin_applicability_status is distinct from new.admin_applicability_status then
      perform public.mark_validation_analysis_draft_applied(
        new.cycle_id,
        'admin_not_applicable',
        null,
        new.id
      );
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.save_validation_analysis_draft(
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_target_kind text,
  p_evidence_id uuid default null,
  p_response_id uuid default null,
  p_action text default null,
  p_justification text default null,
  p_notes text default null,
  p_expected_revision bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_action text;
  v_justification text;
  v_notes text;
  v_draft public.validation_analysis_drafts%rowtype;
  v_applied public.validation_analysis_drafts%rowtype;
  v_evidence public.evidences%rowtype;
  v_response public.responses%rowtype;
begin
  if not exists (
    select 1 from public.profiles
    where user_id = p_actor_user_id
      and role = 'admin'::public.app_user_role
      and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  if p_target_kind not in (
    'evidence',
    'not_applicable',
    'absent_proof',
    'admin_not_applicable'
  ) then
    raise exception 'validation_draft_target_kind_invalid' using errcode = '22023';
  end if;

  v_action := nullif(btrim(coalesce(p_action, '')), '');
  v_justification := nullif(btrim(coalesce(p_justification, '')), '');
  v_notes := nullif(btrim(coalesce(p_notes, '')), '');

  if v_justification is not null and char_length(v_justification) > 2000 then
    raise exception 'validation_draft_justification_too_long' using errcode = '22023';
  end if;
  if v_notes is not null and char_length(v_notes) > 2000 then
    raise exception 'validation_draft_notes_too_long' using errcode = '22023';
  end if;

  if v_action is not null then
    if p_target_kind = 'evidence'
       and v_action not in ('approve', 'invalidate', 'request_adjustment') then
      raise exception 'validation_draft_action_invalid' using errcode = '22023';
    end if;
    if p_target_kind = 'not_applicable'
       and v_action not in ('approve', 'reject') then
      raise exception 'validation_draft_action_invalid' using errcode = '22023';
    end if;
    if p_target_kind = 'absent_proof'
       and v_action not in (
         'validate_without_proof',
         'request_proof',
         'consider_insufficient'
       ) then
      raise exception 'validation_draft_action_invalid' using errcode = '22023';
    end if;
    if p_target_kind = 'admin_not_applicable'
       and v_action not in ('mark', 'revert') then
      raise exception 'validation_draft_action_invalid' using errcode = '22023';
    end if;
  end if;

  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;

  if v_cycle.state <> 'in_validation'::public.cycle_state then
    raise exception 'cycle_not_in_validation: estado do ciclo %', v_cycle.state
      using errcode = 'P0001';
  end if;

  if p_target_kind = 'evidence' then
    if p_evidence_id is null or p_response_id is not null then
      raise exception 'validation_draft_target_invalid' using errcode = '22023';
    end if;

    select e.* into v_evidence
    from public.evidences e
    join public.responses r on r.id = e.response_id
    where e.id = p_evidence_id
      and r.cycle_id = p_cycle_id
      and e.deactivated_at is null
    for update of e;

    if not found then
      raise exception 'evidence_not_in_cycle' using errcode = '23514';
    end if;
  else
    if p_response_id is null or p_evidence_id is not null then
      raise exception 'validation_draft_target_invalid' using errcode = '22023';
    end if;

    select * into v_response
    from public.responses
    where id = p_response_id
      and cycle_id = p_cycle_id
    for update;

    if not found then
      raise exception 'response_not_in_cycle' using errcode = '23514';
    end if;
  end if;

  select * into v_draft
  from public.validation_analysis_drafts
  where cycle_id = p_cycle_id
    and target_kind = p_target_kind
    and applied_at is null
    and evidence_id is not distinct from p_evidence_id
    and response_id is not distinct from p_response_id
  for update;

  if found then
    if p_expected_revision is not null
       and v_draft.revision is distinct from p_expected_revision then
      raise exception 'validation_draft_conflict' using errcode = '40001';
    end if;

    if v_draft.action is not distinct from v_action
       and v_draft.justification is not distinct from v_justification
       and v_draft.notes is not distinct from v_notes then
      return jsonb_build_object(
        'id', v_draft.id,
        'cycleId', v_draft.cycle_id,
        'targetKind', v_draft.target_kind,
        'evidenceId', v_draft.evidence_id,
        'responseId', v_draft.response_id,
        'action', v_draft.action,
        'justification', v_draft.justification,
        'notes', v_draft.notes,
        'revision', v_draft.revision,
        'updatedAt', v_draft.updated_at,
        'appliedAt', v_draft.applied_at,
        'unchanged', true
      );
    end if;

    update public.validation_analysis_drafts
    set
      action = v_action,
      justification = v_justification,
      notes = v_notes,
      revision = v_draft.revision + 1,
      updated_by = p_actor_user_id
    where id = v_draft.id
    returning * into v_draft;
  else
    -- Autosave atrasado após Confirmar: expected_revision aponta para rascunho já aplicado.
    if p_expected_revision is not null and p_expected_revision > 0 then
      select * into v_applied
      from public.validation_analysis_drafts
      where cycle_id = p_cycle_id
        and target_kind = p_target_kind
        and evidence_id is not distinct from p_evidence_id
        and response_id is not distinct from p_response_id
        and applied_at is not null
        and revision >= p_expected_revision
      order by applied_at desc
      limit 1;

      if found then
        raise exception 'validation_draft_already_applied' using errcode = '40001';
      end if;

      raise exception 'validation_draft_conflict' using errcode = '40001';
    end if;

    insert into public.validation_analysis_drafts (
      cycle_id,
      target_kind,
      evidence_id,
      response_id,
      action,
      justification,
      notes,
      revision,
      created_by,
      updated_by
    ) values (
      p_cycle_id,
      p_target_kind,
      p_evidence_id,
      p_response_id,
      v_action,
      v_justification,
      v_notes,
      1,
      p_actor_user_id,
      p_actor_user_id
    )
    returning * into v_draft;
  end if;

  return jsonb_build_object(
    'id', v_draft.id,
    'cycleId', v_draft.cycle_id,
    'targetKind', v_draft.target_kind,
    'evidenceId', v_draft.evidence_id,
    'responseId', v_draft.response_id,
    'action', v_draft.action,
    'justification', v_draft.justification,
    'notes', v_draft.notes,
    'revision', v_draft.revision,
    'updatedAt', v_draft.updated_at,
    'appliedAt', v_draft.applied_at,
    'unchanged', false
  );
end;
$$;

create or replace function public.ensure_form_period(
  p_form_version_id uuid,
  p_period_code text,
  p_label text default null,
  p_starts_at timestamptz default null,
  p_response_deadline_at timestamptz default null
)
returns public.form_periods
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := btrim(p_period_code);
  v_label text := coalesce(nullif(btrim(coalesce(p_label, '')), ''), v_code);
  v_period public.form_periods;
begin
  if v_code is null or v_code = '' then
    raise exception 'invalid_period_code' using errcode = 'check_violation';
  end if;

  select * into v_period
  from public.form_periods
  where form_version_id = p_form_version_id
    and period_code = v_code
  for update;

  if found then
    update public.form_periods
    set label = case
          when label = period_code and v_label <> period_code then v_label
          else label
        end,
        starts_at = coalesce(starts_at, p_starts_at),
        response_deadline_at = coalesce(response_deadline_at, p_response_deadline_at)
    where id = v_period.id
    returning * into v_period;
    return v_period;
  end if;

  insert into public.form_periods (
    form_version_id, period_code, label, starts_at, response_deadline_at, status
  )
  values (
    p_form_version_id, v_code, v_label, p_starts_at, p_response_deadline_at, 'open'
  )
  returning * into v_period;

  return v_period;
exception
  when unique_violation then
    select * into v_period
    from public.form_periods
    where form_version_id = p_form_version_id
      and period_code = v_code;
    return v_period;
end;
$$;

create or replace function public.supersede_absent_proof_with_evidence(
  p_cycle_id uuid,
  p_actor_user_id uuid,
  p_response_id uuid,
  p_evidence jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_response public.responses%rowtype;
  v_requires_evidence boolean;
  v_items jsonb := '[]'::jsonb;
  v_item jsonb;
  v_kind text;
  v_title text;
  v_text_body text;
  v_persisted_id uuid;
  v_persisted_ids jsonb := '[]'::jsonb;
  v_before jsonb;
  v_after jsonb;
  v_previous_status text;
  v_active_count integer;
begin
  perform public.set_audit_actor(p_actor_user_id);

  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'supersede_absent_proof_actor_not_authorized' using errcode = '42501';
  end if;

  select * into v_cycle
  from public.cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'cycle_not_found' using errcode = 'P0002';
  end if;

  if v_cycle.state <> 'in_validation'::public.cycle_state then
    raise exception 'cycle_not_in_validation: estado do ciclo %', v_cycle.state
      using errcode = 'P0001';
  end if;

  select * into v_response
  from public.responses r
  where r.id = p_response_id
    and r.cycle_id = p_cycle_id
  for update;

  if not found then
    raise exception 'response_not_found' using errcode = 'P0002';
  end if;

  if v_response.answer <> 'yes'::public.answer_value then
    raise exception 'supersede_absent_proof_requires_yes' using errcode = 'P0001';
  end if;

  select coalesce((qv.evidence_parameter->>'required')::boolean, false)
    into v_requires_evidence
  from public.question_versions qv
  where qv.id = v_response.question_version_id;

  if not v_requires_evidence then
    raise exception 'supersede_absent_proof_requires_evidence_criterion'
      using errcode = 'P0001';
  end if;

  if v_response.admin_proof_status is distinct from 'validated_without_proof' then
    raise exception 'supersede_absent_proof_requires_validated_without_proof: status=%',
      v_response.admin_proof_status
      using errcode = 'P0001';
  end if;

  select count(*)::integer into v_active_count
  from public.evidences e
  where e.response_id = p_response_id
    and e.deactivated_at is null;

  if v_active_count > 0 then
    raise exception 'supersede_absent_proof_already_has_evidence'
      using errcode = 'P0001';
  end if;

  if p_evidence is null or jsonb_typeof(p_evidence) <> 'array'
     or jsonb_array_length(p_evidence) < 1 then
    raise exception 'supersede_absent_proof_requires_evidence_payload'
      using errcode = 'P0001';
  end if;

  v_items := p_evidence;
  if jsonb_array_length(v_items) > 20 then
    raise exception 'too_many_evidences_per_request' using errcode = 'P0001';
  end if;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item ->> 'kind', '') not in ('file', 'link', 'text') then
      raise exception 'invalid_evidence_payload' using errcode = 'P0001';
    end if;
    v_kind := v_item ->> 'kind';
    v_title := nullif(trim(coalesce(v_item ->> 'title', '')), '');
    if v_kind = 'text' then
      v_text_body := nullif(trim(coalesce(v_item ->> 'text_body', '')), '');
      if v_title is null or v_text_body is null then
        raise exception 'invalid_text_evidence_payload' using errcode = 'P0001';
      end if;
    elsif v_kind = 'link' then
      if coalesce(v_item ->> 'external_link', '') = ''
         or coalesce(v_item ->> 'link_reason', '') = '' then
        raise exception 'invalid_link_evidence_payload' using errcode = 'P0001';
      end if;
    else
      -- file via esta RPC exige storage_path já persistível; backfill CBM usa text.
      if coalesce(v_item ->> 'storage_path', '') = '' then
        raise exception 'invalid_file_evidence_payload' using errcode = 'P0001';
      end if;
    end if;
  end loop;

  v_previous_status := v_response.admin_proof_status;
  v_before := jsonb_build_object(
    'adminProofStatus', v_response.admin_proof_status,
    'adminProofObservation', v_response.admin_proof_observation,
    'adminProofDecidedBy', v_response.admin_proof_decided_by,
    'adminProofDecidedAt', v_response.admin_proof_decided_at,
    'answer', v_response.answer
  );

  update public.responses
  set admin_proof_status = null,
      admin_proof_observation = null,
      admin_proof_decided_by = null,
      admin_proof_decided_at = null
  where id = p_response_id;

  for v_item in select value from jsonb_array_elements(v_items)
  loop
    v_kind := v_item ->> 'kind';
    v_title := nullif(trim(coalesce(v_item ->> 'title', '')), '');
    if v_kind = 'text' then
      v_text_body := nullif(trim(coalesce(v_item ->> 'text_body', '')), '');
      insert into public.evidences (
        response_id, kind, title, text_body, storage_path, external_link, link_reason,
        original_filename, submitted_by, validation_status
      ) values (
        p_response_id, 'text', v_title, v_text_body,
        null, null, null, null,
        p_actor_user_id, 'pending'
      ) returning id into v_persisted_id;
    elsif v_kind = 'link' then
      insert into public.evidences (
        response_id, kind, title, text_body, storage_path, external_link, link_reason,
        original_filename, submitted_by, validation_status
      ) values (
        p_response_id, 'link',
        coalesce(v_title, nullif(trim(v_item ->> 'link_reason'), ''), 'Link'),
        null, null,
        v_item ->> 'external_link',
        v_item ->> 'link_reason',
        null,
        p_actor_user_id, 'pending'
      ) returning id into v_persisted_id;
    else
      insert into public.evidences (
        response_id, kind, title, text_body, storage_path, external_link, link_reason,
        original_filename, submitted_by, validation_status
      ) values (
        p_response_id, 'file',
        coalesce(v_title, nullif(v_item ->> 'original_filename', ''), 'Arquivo'),
        null,
        v_item ->> 'storage_path', null, null,
        nullif(v_item ->> 'original_filename', ''),
        p_actor_user_id, 'pending'
      ) returning id into v_persisted_id;
    end if;
    v_persisted_ids := v_persisted_ids || to_jsonb(v_persisted_id);
  end loop;

  if (
    select admin_proof_status from public.responses where id = p_response_id
  ) is not null then
    raise exception 'supersede_absent_proof_incoherent_admin_status'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.evidences e
    where e.response_id = p_response_id
      and e.deactivated_at is null
  ) then
    raise exception 'supersede_absent_proof_missing_evidence'
      using errcode = 'P0001';
  end if;

  v_after := jsonb_build_object(
    'adminProofStatus', null,
    'previousAdminProofStatus', v_previous_status,
    'evidenceIds', v_persisted_ids,
    'answer', v_response.answer
  );

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id,
    'response.admin_proof_superseded_by_evidence',
    'responses',
    p_response_id,
    v_before,
    v_after
  );

  return jsonb_build_object(
    'responseId', p_response_id,
    'cycleId', p_cycle_id,
    'previousAdminProofStatus', v_previous_status,
    'adminProofStatus', null,
    'evidenceIds', v_persisted_ids
  );
end;
$$;

create or replace function public.carry_forward_action_plan_documents_on_revision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.revision is distinct from old.revision then
    update public.action_plan_documents
    set action_revision = new.revision
    where action_plan_id = new.id
      and action_revision = old.revision
      and deactivated_at is null;
  end if;
  return new;
end;
$$;

create or replace function public.materialize_fami_preliminary(
  p_cycle_id uuid,
  p_reference_year integer,
  p_quadrimester smallint,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.cycles%rowtype;
  v_source public.cycle_processings%rowtype;
  v_source_global public.fami_results%rowtype;
  v_preliminary_id uuid;
  v_version integer;
  v_period_start date;
  v_period_end date;
  v_cutoff_exclusive timestamptz;
  v_reconstructed_official numeric;
  v_reconstructed_possible numeric;
  v_global public.fami_preliminary_results%rowtype;
begin
  if p_reference_year < 1900 or p_reference_year > 2100 then
    raise exception 'preliminary_invalid_reference_year' using errcode = '22023';
  end if;
  if p_quadrimester not between 1 and 3 then
    raise exception 'preliminary_invalid_quadrimester' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'preliminary_admin_required' using errcode = '42501';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  select * into v_cycle
  from public.cycles c
  where c.id = p_cycle_id
  for update;
  if not found then
    raise exception 'preliminary_cycle_not_found' using errcode = 'P0002';
  end if;

  v_period_start := make_date(
    p_reference_year,
    case p_quadrimester when 1 then 1 when 2 then 5 else 9 end,
    1
  );
  v_period_end := case p_quadrimester
    when 1 then make_date(p_reference_year, 4, 30)
    when 2 then make_date(p_reference_year, 8, 31)
    else make_date(p_reference_year, 12, 31)
  end;
  v_cutoff_exclusive := ((v_period_end + 1)::timestamp at time zone 'America/Fortaleza');

  if (current_timestamp at time zone 'America/Fortaleza')::date <= v_period_end then
    raise exception 'preliminary_period_not_closed'
      using errcode = '23514',
            hint = 'O FAMI preliminar só pode ser materializado após o encerramento do quadrimestre.';
  end if;

  -- Processamento FAMI oficial que já existia na data de corte. Um reprocessamento
  -- posterior não pode alterar retroativamente a base do quadrimestre.
  select cp.* into v_source
  from public.cycle_processings cp
  join public.fami_results fr
    on fr.cycle_processing_id = cp.id
   and fr.scope_type = 'global'
   and fr.scope_id is null
  where cp.cycle_id = p_cycle_id
    and cp.status = 'completed'::public.cycle_processing_status
    and fr.created_at < v_cutoff_exclusive
  order by cp.processing_version desc, fr.created_at desc
  limit 1;

  if not found then
    raise exception 'preliminary_source_fami_not_available_for_period'
      using errcode = '23514',
            hint = 'O quadrimestre não possui Resultado FAMI oficial anterior ou igual à data de corte.';
  end if;

  select fr.* into v_source_global
  from public.fami_results fr
  where fr.cycle_processing_id = v_source.id
    and fr.scope_type = 'global'
    and fr.scope_id is null
  order by fr.created_at desc
  limit 1;

  select coalesce(max(fp.calculation_version), 0) + 1
    into v_version
  from public.fami_preliminary_processings fp
  where fp.cycle_id = p_cycle_id
    and fp.reference_year = p_reference_year
    and fp.quadrimester = p_quadrimester;

  insert into public.fami_preliminary_processings (
    cycle_id,
    source_cycle_processing_id,
    source_processing_version,
    source_policy_version,
    reference_year,
    quadrimester,
    calculation_version,
    methodology_version,
    period_start,
    period_end,
    calculated_by
  ) values (
    p_cycle_id,
    v_source.id,
    v_source.processing_version,
    v_source.fami_policy_version,
    p_reference_year,
    p_quadrimester,
    v_version,
    'prelim_v1',
    v_period_start,
    v_period_end,
    p_actor_user_id
  )
  returning id into v_preliminary_id;

  -- Snapshot point-in-time das ações do processamento oficial de origem.
  -- Toda criação de ação registra action_plan_progress_updates, logo o último
  -- evento <= corte é a fonte canônica do percentual/status histórico.
  insert into public.fami_preliminary_action_snapshots (
    preliminary_processing_id,
    action_plan_id,
    recommendation_id,
    status,
    progress_percentage,
    effective_at
  )
  select
    v_preliminary_id,
    ap.id,
    ap.recommendation_id,
    hist.new_status,
    hist.new_percentage,
    hist.created_at
  from public.action_plans ap
  join public.recommendations r
    on r.id = ap.recommendation_id
   and r.cycle_processing_id = v_source.id
  join lateral (
    select u.new_status, u.new_percentage, u.created_at
    from public.action_plan_progress_updates u
    where u.action_plan_id = ap.id
      and u.created_at < v_cutoff_exclusive
    order by u.created_at desc, u.id desc
    limit 1
  ) hist on true
  where ap.created_at < v_cutoff_exclusive;

  -- Memória por critério: reproduz a pontuação oficial do processamento congelado
  -- e aplica recuperação somente ao gap associado à recomendação daquele mesmo
  -- processamento. Exceção aprovada no corte zera a recuperação.
  insert into public.fami_preliminary_criterion_results (
    preliminary_processing_id,
    question_version_id,
    section_id,
    axis_id,
    recommendation_id,
    approved_exception_id,
    included_in_calculation,
    official_points,
    points_possible,
    recoverable_gap,
    active_action_count,
    action_progress_percentage,
    recovered_points,
    preliminary_points
  )
  with question_base as (
    select
      qv.id as question_version_id,
      qv.section_id,
      qv.axis_id,
      qv.applies_to_respondent,
      qv.fami_enabled,
      case
        when jsonb_typeof(qv.evidence_parameter -> 'required') = 'boolean'
          then (qv.evidence_parameter ->> 'required')::boolean
        else false
      end as requires_evidence,
      rs.answer,
      rs.is_not_applicable,
      rs.admin_applicability_status,
      rs.admin_proof_status,
      (pws.question_version_id is not null) as waived,
      exists (
        select 1
        from public.evidence_snapshots es
        where es.cycle_processing_id = v_source.id
          and es.question_version_id = qv.id
          and es.validation_status = 'approved'::public.evidence_validation_status
      ) as has_approved_evidence,
      r.id as recommendation_id
    from public.cycles c
    join public.form_questions fq on fq.form_version_id = c.form_version_id
    join public.question_versions qv on qv.id = fq.question_version_id
    left join public.response_snapshots rs
      on rs.cycle_processing_id = v_source.id
     and rs.question_version_id = qv.id
    left join public.processing_waiver_snapshots pws
      on pws.cycle_processing_id = v_source.id
     and pws.question_version_id = qv.id
    left join public.recommendations r
      on r.cycle_processing_id = v_source.id
     and r.question_version_id = qv.id
    where c.id = p_cycle_id
  ),
  official_score as (
    select
      qb.*,
      (
        qb.applies_to_respondent
        and qb.fami_enabled
        and not qb.waived
        and not coalesce(qb.is_not_applicable, false)
        and coalesce(qb.admin_applicability_status, '') <> 'not_applicable'
      ) as included,
      case
        when not (
          qb.applies_to_respondent
          and qb.fami_enabled
          and not qb.waived
          and not coalesce(qb.is_not_applicable, false)
          and coalesce(qb.admin_applicability_status, '') <> 'not_applicable'
        ) then 0::numeric
        when qb.requires_evidence then v_source.yes_with_approved_evidence_weight
        else v_source.yes_without_evidence_weight
      end as possible,
      case
        when not (
          qb.applies_to_respondent
          and qb.fami_enabled
          and not qb.waived
          and not coalesce(qb.is_not_applicable, false)
          and coalesce(qb.admin_applicability_status, '') <> 'not_applicable'
        ) then 0::numeric
        when qb.answer is distinct from 'yes'::public.answer_value then 0::numeric
        when not qb.requires_evidence then v_source.yes_without_evidence_weight
        when qb.has_approved_evidence then v_source.yes_with_approved_evidence_weight
        when v_source.fami_policy_version in ('v5', 'v6')
          and coalesce(qb.admin_proof_status, '') <> 'considered_insufficient'
          then 1::numeric
        else 0::numeric
      end as official
    from question_base qb
  ),
  exception_at_cutoff as (
    select distinct on (ex.recommendation_id)
      ex.recommendation_id,
      ex.id
    from public.recommendation_exceptions ex
    where ex.status = 'approved'
      and ex.decided_at is not null
      and ex.decided_at < v_cutoff_exclusive
    order by ex.recommendation_id, ex.decided_at desc, ex.id desc
  ),
  action_progress as (
    select
      s.recommendation_id,
      count(*) filter (where s.status <> 'cancelled'::public.action_plan_status)::integer as active_count,
      coalesce(
        avg(s.progress_percentage) filter (where s.status <> 'cancelled'::public.action_plan_status),
        0
      )::numeric as avg_progress
    from public.fami_preliminary_action_snapshots s
    where s.preliminary_processing_id = v_preliminary_id
    group by s.recommendation_id
  ),
  calculated as (
    select
      os.*,
      ex.id as approved_exception_id,
      case
        when not os.included then 0::integer
        when os.recommendation_id is null then 0::integer
        when ex.id is not null then 0::integer
        else coalesce(ap.active_count, 0)
      end as active_count,
      case
        when not os.included then 0::numeric
        when os.recommendation_id is null then 0::numeric
        when ex.id is not null then 0::numeric
        when coalesce(ap.active_count, 0) = 0 then 0::numeric
        else round(ap.avg_progress, 4)
      end as progress
    from official_score os
    left join exception_at_cutoff ex on ex.recommendation_id = os.recommendation_id
    left join action_progress ap on ap.recommendation_id = os.recommendation_id
  )
  select
    v_preliminary_id,
    c.question_version_id,
    c.section_id,
    c.axis_id,
    c.recommendation_id,
    c.approved_exception_id,
    c.included,
    round(c.official, 4),
    round(c.possible, 4),
    round(c.possible - c.official, 4),
    c.active_count,
    c.progress,
    round((c.possible - c.official) * (c.progress / 100), 4),
    round(c.official + ((c.possible - c.official) * (c.progress / 100)), 4)
  from calculated c;

  -- Defesa contra deriva histórica: o score por critério reconstruído precisa
  -- fechar com o Resultado FAMI oficial congelado que serve de baseline.
  -- Se uma política histórica não puder ser reproduzida, o checkpoint aborta
  -- em vez de publicar um preliminar com base diferente do oficial.
  select
    coalesce(sum(cr.official_points), 0),
    coalesce(sum(cr.points_possible), 0)
  into v_reconstructed_official, v_reconstructed_possible
  from public.fami_preliminary_criterion_results cr
  where cr.preliminary_processing_id = v_preliminary_id;

  if abs(v_reconstructed_official - v_source_global.points_obtained) > 0.01
     or abs(v_reconstructed_possible - v_source_global.points_possible) > 0.01 then
    raise exception 'preliminary_official_reconstruction_mismatch'
      using errcode = '23514',
            detail = format(
              'Reconstruído %s/%s; oficial congelado %s/%s.',
              v_reconstructed_official,
              v_reconstructed_possible,
              v_source_global.points_obtained,
              v_source_global.points_possible
            ),
            hint = 'Revise a compatibilidade da política histórica antes de materializar o FAMI preliminar.';
  end if;

  insert into public.fami_preliminary_results (
    preliminary_processing_id,
    cycle_id,
    scope_type,
    scope_id,
    points_obtained,
    points_possible,
    percentage,
    maturity_level
  )
  with scoped as (
    select
      'section'::text as scope_type,
      cr.section_id as scope_id,
      sum(cr.preliminary_points)::numeric as obtained,
      sum(cr.points_possible)::numeric as possible
    from public.fami_preliminary_criterion_results cr
    where cr.preliminary_processing_id = v_preliminary_id
    group by cr.section_id
    union all
    select
      'axis'::text,
      cr.axis_id,
      sum(cr.preliminary_points)::numeric,
      sum(cr.points_possible)::numeric
    from public.fami_preliminary_criterion_results cr
    where cr.preliminary_processing_id = v_preliminary_id
    group by cr.axis_id
    union all
    select
      'global'::text,
      null::uuid,
      coalesce(sum(cr.preliminary_points), 0)::numeric,
      coalesce(sum(cr.points_possible), 0)::numeric
    from public.fami_preliminary_criterion_results cr
    where cr.preliminary_processing_id = v_preliminary_id
  ),
  normalized as (
    select
      scope_type,
      scope_id,
      round(obtained, 2) as obtained,
      round(possible, 2) as possible,
      case when possible = 0 then 0::numeric
        else round((obtained / possible) * 100, 2)
      end as percentage
    from scoped
  )
  select
    v_preliminary_id,
    p_cycle_id,
    n.scope_type,
    n.scope_id,
    n.obtained,
    n.possible,
    n.percentage,
    case
      when n.possible = 0 then null::smallint
      when n.percentage <= 20 then 1::smallint
      when n.percentage <= 40 then 2::smallint
      when n.percentage <= 60 then 3::smallint
      when n.percentage <= 80 then 4::smallint
      else 5::smallint
    end
  from normalized n;

  select * into v_global
  from public.fami_preliminary_results r
  where r.preliminary_processing_id = v_preliminary_id
    and r.scope_type = 'global'
    and r.scope_id is null;

  return jsonb_build_object(
    'id', v_preliminary_id,
    'cycleId', p_cycle_id,
    'referenceYear', p_reference_year,
    'quadrimester', p_quadrimester,
    'calculationVersion', v_version,
    'methodologyVersion', 'prelim_v1',
    'sourceCycleProcessingId', v_source.id,
    'sourceProcessingVersion', v_source.processing_version,
    'sourcePolicyVersion', v_source.fami_policy_version,
    'periodStart', v_period_start,
    'periodEnd', v_period_end,
    'global', jsonb_build_object(
      'pointsObtained', v_global.points_obtained,
      'pointsPossible', v_global.points_possible,
      'percentage', v_global.percentage,
      'maturityLevel', v_global.maturity_level
    )
  );
end;
$$;
