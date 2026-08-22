-- O rascunho de validação só precisa ler o estado do ciclo. FOR UPDATE no
-- ciclo serializava o autosave com o veredito e com a transição, e no CI o
-- POST do rascunho ficava preso em “Salvando rascunho...”.

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
  where id = p_cycle_id;

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

comment on function public.save_validation_analysis_draft(
  uuid, uuid, text, uuid, uuid, text, text, text, bigint
) is
  'Persiste rascunho de análise. Lê o estado do ciclo sem bloqueá-lo; o lock exclusivo fica no alvo (evidência ou resposta) e no próprio rascunho.';
