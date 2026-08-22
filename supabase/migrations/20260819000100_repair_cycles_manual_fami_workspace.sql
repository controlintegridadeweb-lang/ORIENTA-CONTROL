-- Reparo da carga 2026: ciclos importados sem cycle_processings, alguns
-- marcados validated sem FAMI oficial, e prazo do período não copiado.
-- O FAMI continua nascendo só em finalize_validation_cycle (ação manual).

create or replace function public.cycle_has_official_fami(p_cycle_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.cycle_processings cp
    join public.fami_results fr on fr.cycle_processing_id = cp.id
    where cp.cycle_id = p_cycle_id
      and cp.status = 'completed'::public.cycle_processing_status
      and fr.scope_type = 'global'
      and fr.scope_id is null
  );
$$;

revoke all on function public.cycle_has_official_fami(uuid) from public;
grant execute on function public.cycle_has_official_fami(uuid) to service_role;

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
       or (
         public.cycle_has_official_fami(new.id)
         and not exists (
           select 1
           from public.cycle_validation_reopen_events event
           where event.cycle_id = new.id
             and event.to_state = 'in_validation'::public.cycle_state
             and event.new_cycle_processing_id = public.cycle_working_processing(new.id)
         )
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
     and new.state = 'in_validation'::public.cycle_state
     and public.cycle_has_official_fami(new.id) then
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

create or replace function public.repair_cycles_for_manual_fami(
  p_form_id uuid,
  p_period_id uuid,
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_period public.form_periods%rowtype;
  v_cycle public.cycles%rowtype;
  v_batch_id uuid := gen_random_uuid();
  v_next_version integer;
  v_processing_created boolean;
  v_deadline_restored boolean;
  v_auto_validation_cleared boolean;
  v_from_state public.cycle_state;
  v_items jsonb := '[]'::jsonb;
  v_repaired integer := 0;
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

  select fp.*
    into v_period
  from public.form_periods fp
  join public.form_versions fv on fv.id = fp.form_version_id
  where fp.id = p_period_id
    and fv.form_id = p_form_id;

  if not found then
    raise exception 'form_period_not_found' using errcode = 'P0002';
  end if;

  if v_period.response_deadline_at is null or v_period.starts_at is null then
    raise exception 'form_period_schedule_required' using errcode = '22023';
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  for v_cycle in
    select c.*
    from public.cycles c
    where c.period_id = v_period.id
    order by c.organization_id
    for update
  loop
    v_from_state := v_cycle.state;
    v_processing_created := false;
    v_deadline_restored := false;
    v_auto_validation_cleared := false;

    if public.cycle_working_processing(v_cycle.id) is null
       and not public.cycle_has_official_fami(v_cycle.id) then
      select coalesce(max(cp.processing_version), 0) + 1
        into v_next_version
      from public.cycle_processings cp
      where cp.cycle_id = v_cycle.id;

      insert into public.cycle_processings (cycle_id, processing_version, status)
      values (v_cycle.id, v_next_version, 'working'::public.cycle_processing_status);
      v_processing_created := true;
    end if;

    if v_cycle.state = 'validated'::public.cycle_state
       and not public.cycle_has_official_fami(v_cycle.id) then
      update public.cycles
      set state = 'in_validation'::public.cycle_state,
          validated_at = null
      where id = v_cycle.id
      returning * into v_cycle;
    end if;

    if v_cycle.response_deadline_at is null then
      insert into public.cycle_deadline_events (
        batch_id, cycle_id, form_id, period_label, organization_id,
        action, scope, previous_deadline_at, new_deadline_at,
        justification, actor_user_id
      ) values (
        v_batch_id,
        v_cycle.id,
        p_form_id,
        v_cycle.period_label,
        v_cycle.organization_id,
        'change_deadline',
        'all',
        v_cycle.response_deadline_at,
        v_period.response_deadline_at,
        'Carga inicial não gravou o prazo do período neste ciclo. O prazo foi restaurado a partir do período oficial, sem gerar FAMI.',
        p_actor_user_id
      );

      update public.cycles
      set starts_at = coalesce(starts_at, v_period.starts_at),
          response_deadline_at = v_period.response_deadline_at,
          schedule_revision = schedule_revision + 1
      where id = v_cycle.id
      returning * into v_cycle;
      v_deadline_restored := true;
    end if;

    if v_cycle.validation_deadline_at is not null or v_cycle.cycle_close_at is not null then
      update public.cycles
      set validation_deadline_at = null,
          cycle_close_at = null,
          schedule_revision = schedule_revision + 1
      where id = v_cycle.id
      returning * into v_cycle;
      v_auto_validation_cleared := true;
    end if;

    if v_deadline_restored or v_auto_validation_cleared then
      perform public.replace_cycle_schedule(v_cycle.id, p_actor_user_id);
    end if;

    if v_processing_created or v_deadline_restored or v_auto_validation_cleared
       or v_from_state is distinct from v_cycle.state then
      v_repaired := v_repaired + 1;
    end if;

    v_items := v_items || jsonb_build_array(
      jsonb_build_object(
        'cycleId', v_cycle.id,
        'fromState', v_from_state,
        'toState', v_cycle.state,
        'processingCreated', v_processing_created,
        'deadlineRestored', v_deadline_restored,
        'autoValidationCleared', v_auto_validation_cleared
      )
    );
  end loop;

  return jsonb_build_object(
    'batchId', v_batch_id,
    'repaired', v_repaired,
    'items', v_items
  );
end;
$$;

revoke all on function public.repair_cycles_for_manual_fami(uuid, uuid, uuid) from public;
grant execute on function public.repair_cycles_for_manual_fami(uuid, uuid, uuid) to service_role;

comment on function public.cycle_has_official_fami(uuid) is
  'Verdadeiro quando o ciclo tem processing concluído com FAMI global oficial.';

comment on function public.repair_cycles_for_manual_fami(uuid, uuid, uuid) is
  'Recompõe o workspace de validação da carga 2026: processing working, retorno de validated sem FAMI para in_validation, prazo do período e sem finalização automática.';
