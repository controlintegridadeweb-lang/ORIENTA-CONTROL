-- O rascunho de validação só precisa ler ciclo e alvo. FOR UPDATE no ciclo
-- ou na resposta serializa o autosave com o veredito; no CI o Kong estoura
-- timeout no POST de “Não se aplica” enquanto o rascunho ainda segura o lock.

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
set lock_timeout = '5s'
set statement_timeout = '8s'
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
      and e.deactivated_at is null;

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
      and cycle_id = p_cycle_id;

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
  'Persiste rascunho de análise. Lê ciclo e alvo sem bloqueá-los; o lock exclusivo fica só no próprio rascunho.';

-- O parecer de NA lê ciclo e resposta sem bloqueá-los. O rascunho é marcado
-- aplicado antes do UPDATE da resposta, na mesma ordem de lock do autosave
-- (rascunho → resposta). Se o trigger tentar de novo, a linha já não está ativa.

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
set lock_timeout = '5s'
set statement_timeout = '8s'
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
  where id = p_cycle_id;

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
    and cycle_id = p_cycle_id;

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

  perform public.mark_validation_analysis_draft_applied(
    p_cycle_id,
    'not_applicable',
    null,
    p_response_id
  );

  v_validated_at := clock_timestamp();

  if p_action = 'approve' then
    update public.responses
    set answer = 'not_applicable'::public.answer_value,
        is_not_applicable = true,
        na_validation_status = 'approved'::public.na_validation_status,
        na_validated_at = v_validated_at,
        na_validated_by = p_actor_user_id,
        na_rejection_reason = null
    where id = p_response_id
      and (
        p_expected_status is null
        or (
          na_validation_status::text is not distinct from p_expected_status
          and na_validated_at is not distinct from p_expected_validated_at
        )
      );

    if not found then
      raise exception 'validation_conflict' using errcode = '40001';
    end if;

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
  where id = p_response_id
    and (
      p_expected_status is null
      or (
        na_validation_status::text is not distinct from p_expected_status
        and na_validated_at is not distinct from p_expected_validated_at
      )
    );

  if not found then
    raise exception 'validation_conflict' using errcode = '40001';
  end if;

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

comment on function public.validate_not_applicable_response(
  uuid, uuid, text, uuid, text, text, timestamptz
) is
  'Aprova ou rejeita “não se aplica”. Marca o rascunho antes de atualizar a resposta; a concorrência do veredito fica no UPDATE com o estado esperado.';

-- Toda mutação HTTP passa por esta RPC antes do handler. Sem lock_timeout, um
-- INSERT ON CONFLICT preso na linha do bucket espera até o Kong estourar
-- (~60s) e a rota devolve 500 opaco — o parecer de NA no E2E caía nisso
-- sem o PostgreSQL ter começado validate_not_applicable_response.

create or replace function public.consume_api_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = public
set lock_timeout = '5s'
set statement_timeout = '8s'
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

-- O after() de /api/notifications chama esta RPC e segura uma conexão do
-- PostgREST enquanto varre prazos. Sem teto, ela compete com o parecer de NA
-- até o Kong estourar. O cron horário continua sendo a fonte da outbox.
alter function public.enqueue_operational_notifications()
  set statement_timeout = '8s';
