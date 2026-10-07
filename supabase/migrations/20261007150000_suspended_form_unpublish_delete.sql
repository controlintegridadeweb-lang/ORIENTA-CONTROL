-- Formulário com a coleta suspensa pode ser despublicado ou excluído.
-- A coleta está suspensa quando ainda há órgãos em preenchimento ou correção
-- e todos eles estão pausados. Órgãos já concluídos não bloqueiam a operação.

alter table public.cycle_deadline_events
  drop constraint if exists cycle_deadline_events_action_check;

alter table public.cycle_deadline_events
  add constraint cycle_deadline_events_action_check
  check (action in (
    'change_deadline',
    'extend_deadline',
    'early_close',
    'reopen_responses',
    'suspend',
    'resume',
    'unpublish',
    'delete'
  ));

create or replace function public.form_collection_is_fully_suspended(p_form_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cycles c
    join public.form_versions fv on fv.id = c.form_version_id
    where fv.form_id = p_form_id
      and c.state in (
        'in_response'::public.cycle_state,
        'awaiting_adjustment'::public.cycle_state
      )
  )
  and not exists (
    select 1
    from public.cycles c
    join public.form_versions fv on fv.id = c.form_version_id
    where fv.form_id = p_form_id
      and c.state in (
        'in_response'::public.cycle_state,
        'awaiting_adjustment'::public.cycle_state
      )
      and c.response_collection_paused_at is null
  );
$$;

create or replace function public.admin_unpublish_suspended_form(
  p_form_id uuid,
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
  v_form public.forms%rowtype;
  v_updated integer := 0;
  v_cycle public.cycles%rowtype;
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'unpublish_actor_not_authorized' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_justification, ''))) < 10
     or char_length(btrim(p_justification)) > 2000 then
    raise exception 'unpublish_justification_required' using errcode = '22023';
  end if;

  select * into v_form from public.forms where id = p_form_id for update;
  if not found then
    raise exception 'form_not_found' using errcode = 'P0002';
  end if;
  if not public.form_collection_is_fully_suspended(p_form_id) then
    raise exception 'form_collection_not_fully_suspended' using errcode = 'P0001';
  end if;
  if not exists (
    select 1
    from public.form_versions fv
    where fv.id = v_form.current_form_version_id
      and fv.state = 'published'::public.form_version_state
  ) then
    raise exception 'form_not_published' using errcode = 'P0001';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  for v_cycle in
    select c.*
    from public.cycles c
    join public.form_versions fv on fv.id = c.form_version_id
    where fv.form_id = p_form_id
      and c.state in (
        'in_response'::public.cycle_state,
        'awaiting_adjustment'::public.cycle_state
      )
      and c.response_collection_paused_at is not null
  loop
    insert into public.cycle_deadline_events (
      batch_id, cycle_id, form_id, period_label, organization_id,
      action, scope, previous_deadline_at, new_deadline_at,
      justification, actor_user_id
    ) values (
      p_batch_id, v_cycle.id, p_form_id, v_cycle.period_label, v_cycle.organization_id,
      'unpublish', 'all', v_cycle.response_deadline_at, v_cycle.response_deadline_at,
      btrim(p_justification), p_actor_user_id
    );
    v_updated := v_updated + 1;
  end loop;

  update public.form_versions
  set state = 'archived'::public.form_version_state
  where form_id = p_form_id
    and state = 'published'::public.form_version_state;

  update public.forms
  set current_form_version_id = null
  where id = p_form_id;

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id, 'form.unpublished', 'forms', p_form_id, to_jsonb(v_form),
    jsonb_build_object('justification', btrim(p_justification), 'batch_id', p_batch_id)
  );

  return jsonb_build_object(
    'batchId', p_batch_id,
    'updated', v_updated,
    'action', 'unpublish'
  );
end;
$$;

create or replace function public.admin_delete_suspended_form(
  p_form_id uuid,
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
  v_form public.forms%rowtype;
  v_cycle_ids uuid[];
  v_evidence_paths jsonb := '[]'::jsonb;
  v_report_paths jsonb := '[]'::jsonb;
  v_action_plan_paths jsonb := '[]'::jsonb;
  v_triggers_disabled boolean := false;
begin
  if not exists (
    select 1 from public.profiles p
    where p.user_id = p_actor_user_id
      and p.role = 'admin'::public.app_user_role
  ) then
    raise exception 'delete_actor_not_authorized' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_justification, ''))) < 10
     or char_length(btrim(p_justification)) > 2000 then
    raise exception 'delete_justification_required' using errcode = '22023';
  end if;

  select * into v_form from public.forms where id = p_form_id for update;
  if not found then
    raise exception 'form_not_found' using errcode = 'P0002';
  end if;
  if not public.form_collection_is_fully_suspended(p_form_id) then
    raise exception 'form_collection_not_fully_suspended' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(c.id), array[]::uuid[])
  into v_cycle_ids
  from public.cycles c
  join public.form_versions fv on fv.id = c.form_version_id
  where fv.form_id = p_form_id;

  select coalesce(jsonb_agg(distinct e.storage_path), '[]'::jsonb)
  into v_evidence_paths
  from (
    select ev.storage_path
    from public.evidences ev
    join public.responses r on r.id = ev.response_id
    where r.cycle_id = any(v_cycle_ids)
      and ev.storage_path is not null
    union
    select pending.storage_path
    from public.pending_evidence_uploads pending
    where pending.cycle_id = any(v_cycle_ids)
  ) e;

  select coalesce(jsonb_agg(distinct r.file_path), '[]'::jsonb)
  into v_report_paths
  from public.reports r
  where r.cycle_id = any(v_cycle_ids)
    and r.file_path is not null;

  select coalesce(jsonb_agg(distinct path), '[]'::jsonb)
  into v_action_plan_paths
  from (
    select doc.storage_path as path
    from public.action_plan_documents doc
    join public.action_plans plan on plan.id = doc.action_plan_id
    join public.recommendations rec on rec.id = plan.recommendation_id
    where rec.cycle_id = any(v_cycle_ids)
      and doc.storage_path is not null
    union
    select pending.storage_path
    from public.pending_action_plan_document_uploads pending
    join public.action_plans plan on plan.id = pending.action_plan_id
    join public.recommendations rec on rec.id = plan.recommendation_id
    where rec.cycle_id = any(v_cycle_ids)
  ) files;

  perform public.set_audit_actor(p_actor_user_id);

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id, 'form.deleted', 'forms', p_form_id, to_jsonb(v_form),
    jsonb_build_object(
      'justification', btrim(p_justification),
      'batch_id', p_batch_id,
      'cycle_count', cardinality(v_cycle_ids),
      'suspended_form', true
    )
  );

  alter table public.reports disable trigger reports_immutable;
  alter table public.response_snapshots disable trigger response_snapshots_immutable;
  alter table public.evidence_snapshots disable trigger evidence_snapshots_immutable;
  alter table public.processing_waiver_snapshots disable trigger processing_waiver_snapshots_immutable;
  alter table public.fami_preliminary_processings disable trigger fami_preliminary_processings_immutable;
  alter table public.fami_preliminary_action_snapshots disable trigger fami_preliminary_action_snapshots_immutable;
  alter table public.fami_preliminary_criterion_results disable trigger fami_preliminary_criterion_results_immutable;
  alter table public.fami_preliminary_results disable trigger fami_preliminary_results_immutable;
  alter table public.action_plan_bimonthly_reports disable trigger action_plan_bimonthly_reports_immutable;
  alter table public.action_plan_bimonthly_action_snapshots disable trigger action_plan_bimonthly_action_snapshots_immutable;
  alter table public.action_plan_bimonthly_criterion_snapshots disable trigger action_plan_bimonthly_criterion_snapshots_immutable;
  v_triggers_disabled := true;

  delete from public.action_plan_bimonthly_action_snapshots snap
  using public.action_plan_bimonthly_reports report
  where snap.report_id = report.id
    and report.cycle_id = any(v_cycle_ids);

  delete from public.action_plan_bimonthly_criterion_snapshots snap
  using public.action_plan_bimonthly_reports report
  where snap.report_id = report.id
    and report.cycle_id = any(v_cycle_ids);

  delete from public.action_plan_bimonthly_reports
  where cycle_id = any(v_cycle_ids);

  delete from public.fami_preliminary_action_snapshots snap
  using public.fami_preliminary_processings proc
  where snap.preliminary_processing_id = proc.id
    and proc.cycle_id = any(v_cycle_ids);

  delete from public.fami_preliminary_criterion_results result
  using public.fami_preliminary_processings proc
  where result.preliminary_processing_id = proc.id
    and proc.cycle_id = any(v_cycle_ids);

  delete from public.fami_preliminary_results result
  where result.cycle_id = any(v_cycle_ids);

  delete from public.fami_preliminary_processings
  where cycle_id = any(v_cycle_ids);

  delete from public.action_plan_deadline_change_requests request
  using public.recommendations rec
  where request.recommendation_id = rec.id
    and rec.cycle_id = any(v_cycle_ids);

  delete from public.action_plan_supervision_notes note
  using public.recommendations rec
  where note.recommendation_id = rec.id
    and rec.cycle_id = any(v_cycle_ids);

  update public.reports
  set supersedes_report_id = null
  where supersedes_report_id in (
    select id from public.reports where cycle_id = any(v_cycle_ids)
  );

  delete from public.report_emission_failures
  where cycle_id = any(v_cycle_ids);

  delete from public.reports
  where cycle_id = any(v_cycle_ids);

  delete from public.response_snapshots snap
  using public.cycle_processings proc
  where snap.cycle_processing_id = proc.id
    and proc.cycle_id = any(v_cycle_ids);

  delete from public.evidence_snapshots snap
  using public.cycle_processings proc
  where snap.cycle_processing_id = proc.id
    and proc.cycle_id = any(v_cycle_ids);

  delete from public.processing_waiver_snapshots snap
  where snap.cycle_processing_id in (
    select proc.id from public.cycle_processings proc
    where proc.cycle_id = any(v_cycle_ids)
  );

  delete from public.action_plans plan
  using public.recommendations rec
  where plan.recommendation_id = rec.id
    and rec.cycle_id = any(v_cycle_ids);

  update public.form_versions
  set state = 'archived'::public.form_version_state
  where form_id = p_form_id
    and state = 'published'::public.form_version_state;

  update public.forms
  set current_form_version_id = null
  where id = p_form_id;

  delete from public.cycles
  where id = any(v_cycle_ids);

  delete from public.form_periods period
  using public.form_versions fv
  where period.form_version_id = fv.id
    and fv.form_id = p_form_id;

  delete from public.forms
  where id = p_form_id;

  alter table public.reports enable trigger reports_immutable;
  alter table public.response_snapshots enable trigger response_snapshots_immutable;
  alter table public.evidence_snapshots enable trigger evidence_snapshots_immutable;
  alter table public.processing_waiver_snapshots enable trigger processing_waiver_snapshots_immutable;
  alter table public.fami_preliminary_processings enable trigger fami_preliminary_processings_immutable;
  alter table public.fami_preliminary_action_snapshots enable trigger fami_preliminary_action_snapshots_immutable;
  alter table public.fami_preliminary_criterion_results enable trigger fami_preliminary_criterion_results_immutable;
  alter table public.fami_preliminary_results enable trigger fami_preliminary_results_immutable;
  alter table public.action_plan_bimonthly_reports enable trigger action_plan_bimonthly_reports_immutable;
  alter table public.action_plan_bimonthly_action_snapshots enable trigger action_plan_bimonthly_action_snapshots_immutable;
  alter table public.action_plan_bimonthly_criterion_snapshots enable trigger action_plan_bimonthly_criterion_snapshots_immutable;

  return jsonb_build_object(
    'batchId', p_batch_id,
    'updated', cardinality(v_cycle_ids),
    'action', 'delete',
    'evidencePaths', v_evidence_paths,
    'reportPaths', v_report_paths,
    'actionPlanPaths', v_action_plan_paths
  );
exception
  when others then
    if v_triggers_disabled then
      alter table public.reports enable trigger reports_immutable;
      alter table public.response_snapshots enable trigger response_snapshots_immutable;
      alter table public.evidence_snapshots enable trigger evidence_snapshots_immutable;
      alter table public.processing_waiver_snapshots enable trigger processing_waiver_snapshots_immutable;
      alter table public.fami_preliminary_processings enable trigger fami_preliminary_processings_immutable;
      alter table public.fami_preliminary_action_snapshots enable trigger fami_preliminary_action_snapshots_immutable;
      alter table public.fami_preliminary_criterion_results enable trigger fami_preliminary_criterion_results_immutable;
      alter table public.fami_preliminary_results enable trigger fami_preliminary_results_immutable;
      alter table public.action_plan_bimonthly_reports enable trigger action_plan_bimonthly_reports_immutable;
      alter table public.action_plan_bimonthly_action_snapshots enable trigger action_plan_bimonthly_action_snapshots_immutable;
      alter table public.action_plan_bimonthly_criterion_snapshots enable trigger action_plan_bimonthly_criterion_snapshots_immutable;
    end if;
    raise;
end;
$$;

revoke all on function public.form_collection_is_fully_suspended(uuid) from public;
grant execute on function public.form_collection_is_fully_suspended(uuid) to service_role;

revoke all on function public.admin_unpublish_suspended_form(uuid, text, uuid, uuid) from public;
grant execute on function public.admin_unpublish_suspended_form(uuid, text, uuid, uuid) to service_role;

revoke all on function public.admin_delete_suspended_form(uuid, text, uuid, uuid) from public;
grant execute on function public.admin_delete_suspended_form(uuid, text, uuid, uuid) to service_role;
