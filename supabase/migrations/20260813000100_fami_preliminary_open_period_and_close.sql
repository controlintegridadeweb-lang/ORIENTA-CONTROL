-- ORIENTA — acompanhamento quadrimestral: cálculo durante o período aberto,
-- snapshot imutável no corte e fechamento automático idempotente.
-- O FAMI anual (fami_results) permanece domínio separado.

alter table public.fami_preliminary_processings
  add column if not exists calculation_kind text not null default 'manual',
  add column if not exists closed_at timestamptz;

alter table public.fami_preliminary_processings
  alter column calculated_by drop not null;

alter table public.fami_preliminary_processings
  disable trigger fami_preliminary_processings_immutable;

update public.fami_preliminary_processings fp
set
  calculation_kind = 'automatic',
  closed_at = fp.calculated_at
from (
  select distinct on (cycle_id, reference_year, quadrimester)
    id
  from public.fami_preliminary_processings
  order by cycle_id, reference_year, quadrimester, calculation_version desc
) latest
where fp.id = latest.id
  and fp.closed_at is null;

alter table public.fami_preliminary_processings
  enable trigger fami_preliminary_processings_immutable;

alter table public.fami_preliminary_processings
  drop constraint if exists fami_preliminary_calculation_kind_check,
  drop constraint if exists fami_preliminary_kind_state_check;

alter table public.fami_preliminary_processings
  add constraint fami_preliminary_calculation_kind_check
    check (calculation_kind in ('manual', 'automatic')),
  add constraint fami_preliminary_kind_state_check
    check (
      (calculation_kind = 'manual' and calculated_by is not null and closed_at is null)
      or (calculation_kind = 'automatic' and closed_at is not null)
    );

create unique index if not exists fami_preliminary_processings_closed_unique
  on public.fami_preliminary_processings (cycle_id, reference_year, quadrimester)
  where closed_at is not null;

create or replace function public.fami_preliminary_checkpoint_payload(
  p_processing_id uuid,
  p_idempotent boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', fp.id,
    'cycleId', fp.cycle_id,
    'referenceYear', fp.reference_year,
    'quadrimester', fp.quadrimester,
    'calculationVersion', fp.calculation_version,
    'methodologyVersion', fp.methodology_version,
    'calculationKind', fp.calculation_kind,
    'calculatedBy', fp.calculated_by,
    'calculatedAt', fp.calculated_at,
    'closedAt', fp.closed_at,
    'sourceCycleProcessingId', fp.source_cycle_processing_id,
    'sourceProcessingVersion', fp.source_processing_version,
    'sourcePolicyVersion', fp.source_policy_version,
    'periodStart', fp.period_start,
    'periodEnd', fp.period_end,
    'idempotent', p_idempotent,
    'global', jsonb_build_object(
      'pointsObtained', r.points_obtained,
      'pointsPossible', r.points_possible,
      'percentage', r.percentage,
      'maturityLevel', r.maturity_level
    )
  )
  from public.fami_preliminary_processings fp
  join public.fami_preliminary_results r
    on r.preliminary_processing_id = fp.id
   and r.scope_type = 'global'
   and r.scope_id is null
  where fp.id = p_processing_id;
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
  v_existing_closed public.fami_preliminary_processings%rowtype;
  v_preliminary_id uuid;
  v_version integer;
  v_period_start date;
  v_period_end date;
  v_cutoff_exclusive timestamptz;
  v_today date;
  v_period_closed boolean;
  v_kind text;
  v_reconstructed_official numeric;
  v_reconstructed_possible numeric;
  v_payload jsonb;
begin
  if p_reference_year < 1900 or p_reference_year > 2100 then
    raise exception 'preliminary_invalid_reference_year' using errcode = '22023';
  end if;
  if p_quadrimester not between 1 and 3 then
    raise exception 'preliminary_invalid_quadrimester' using errcode = '22023';
  end if;

  v_kind := case when p_actor_user_id is null then 'automatic' else 'manual' end;

  if v_kind = 'manual' then
    if not exists (
      select 1 from public.profiles p
      where p.user_id = p_actor_user_id and p.role = 'admin'::public.app_user_role
    ) then
      raise exception 'preliminary_admin_required' using errcode = '42501';
    end if;
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
  v_today := (current_timestamp at time zone 'America/Fortaleza')::date;
  v_period_closed := v_today > v_period_end;

  if v_today < v_period_start then
    raise exception 'preliminary_period_not_started'
      using errcode = '23514',
            hint = 'O quadrimestre ainda não começou.';
  end if;

  select * into v_existing_closed
  from public.fami_preliminary_processings fp
  where fp.cycle_id = p_cycle_id
    and fp.reference_year = p_reference_year
    and fp.quadrimester = p_quadrimester
    and fp.closed_at is not null
  order by fp.calculation_version desc
  limit 1;

  if found then
    if v_kind = 'manual' then
      raise exception 'preliminary_period_already_closed'
        using errcode = '23514',
              hint = 'O snapshot do quadrimestre já foi fechado e não pode ser alterado.';
    end if;
    v_payload := public.fami_preliminary_checkpoint_payload(v_existing_closed.id, true);
    if v_payload is null then
      raise exception 'preliminary_closed_snapshot_incomplete' using errcode = 'P0002';
    end if;
    return v_payload;
  end if;

  if v_kind = 'manual' and v_period_closed then
    raise exception 'preliminary_period_already_closed'
      using errcode = '23514',
            hint = 'Após a data de corte somente o fechamento automático consolida o quadrimestre.';
  end if;

  if v_kind = 'automatic' and not v_period_closed then
    raise exception 'preliminary_period_not_closed'
      using errcode = '23514',
            hint = 'O fechamento automático só ocorre depois da data de corte.';
  end if;

  -- Manual: dados válidos até o instante da execução.
  -- Automático: dados válidos até o fim da data de corte (Fortaleza).
  v_cutoff_exclusive := case
    when v_kind = 'manual' then current_timestamp
    else ((v_period_end + 1)::timestamp at time zone 'America/Fortaleza')
  end;

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
    calculated_by,
    calculation_kind,
    closed_at
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
    p_actor_user_id,
    v_kind,
    case when v_kind = 'automatic' then current_timestamp else null end
  )
  returning id into v_preliminary_id;

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

  v_payload := public.fami_preliminary_checkpoint_payload(v_preliminary_id, false);
  if v_payload is null then
    raise exception 'preliminary_snapshot_incomplete' using errcode = 'P0002';
  end if;
  return v_payload;
end;
$$;

create or replace function public.close_due_fami_preliminary_quadrimesters()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date;
  v_candidate record;
  v_closed integer := 0;
  v_skipped integer := 0;
  v_failed integer := 0;
  v_errors jsonb := '[]'::jsonb;
  v_result jsonb;
  v_cutoff_exclusive timestamptz;
begin
  if not pg_try_advisory_xact_lock(87201402, 1) then
    return jsonb_build_object(
      'ok', true,
      'reason', 'lock_held',
      'closed', 0,
      'skipped', 0,
      'failed', 0,
      'errors', '[]'::jsonb
    );
  end if;

  v_today := (current_timestamp at time zone 'America/Fortaleza')::date;

  for v_candidate in
    with periods as (
      select
        y.year,
        q.quadrimester::smallint as quadrimester,
        case q.quadrimester
          when 1 then make_date(y.year, 4, 30)
          when 2 then make_date(y.year, 8, 31)
          else make_date(y.year, 12, 31)
        end as period_end
      from generate_series(2020, extract(year from v_today)::integer) as y(year)
      cross join generate_series(1, 3) as q(quadrimester)
    ),
    due_periods as (
      select p.year, p.quadrimester, p.period_end
      from periods p
      where p.period_end < v_today
    ),
    cycles_with_fami as (
      select distinct cp.cycle_id
      from public.cycle_processings cp
      join public.fami_results fr
        on fr.cycle_processing_id = cp.id
       and fr.scope_type = 'global'
       and fr.scope_id is null
      where cp.status = 'completed'::public.cycle_processing_status
    )
    select
      c.cycle_id,
      p.year as reference_year,
      p.quadrimester,
      p.period_end
    from cycles_with_fami c
    cross join due_periods p
    where not exists (
      select 1
      from public.fami_preliminary_processings fp
      where fp.cycle_id = c.cycle_id
        and fp.reference_year = p.year
        and fp.quadrimester = p.quadrimester
        and fp.closed_at is not null
    )
  loop
    v_cutoff_exclusive := ((v_candidate.period_end + 1)::timestamp at time zone 'America/Fortaleza');

    if not exists (
      select 1
      from public.cycle_processings cp
      join public.fami_results fr
        on fr.cycle_processing_id = cp.id
       and fr.scope_type = 'global'
       and fr.scope_id is null
      where cp.cycle_id = v_candidate.cycle_id
        and cp.status = 'completed'::public.cycle_processing_status
        and fr.created_at < v_cutoff_exclusive
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if not exists (
      select 1
      from public.fami_preliminary_processings fp
      where fp.cycle_id = v_candidate.cycle_id
        and fp.reference_year = v_candidate.reference_year
        and fp.quadrimester = v_candidate.quadrimester
    ) and not exists (
      select 1
      from public.action_plans ap
      join public.recommendations r on r.id = ap.recommendation_id
      join public.cycle_processings cp on cp.id = r.cycle_processing_id
      where cp.cycle_id = v_candidate.cycle_id
        and cp.status = 'completed'::public.cycle_processing_status
        and ap.created_at < v_cutoff_exclusive
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    begin
      v_result := public.materialize_fami_preliminary(
        v_candidate.cycle_id,
        v_candidate.reference_year,
        v_candidate.quadrimester,
        null
      );
      if coalesce((v_result ->> 'idempotent')::boolean, false) then
        v_skipped := v_skipped + 1;
      else
        v_closed := v_closed + 1;
      end if;
    exception
      when unique_violation then
        v_skipped := v_skipped + 1;
      when others then
        if sqlerrm like '%preliminary_source_fami_not_available_for_period%'
           or sqlerrm like '%preliminary_period_already_closed%'
           or sqlerrm like '%preliminary_period_not_closed%'
           or sqlerrm like '%preliminary_period_not_started%' then
          v_skipped := v_skipped + 1;
        else
          v_failed := v_failed + 1;
          v_errors := v_errors || jsonb_build_array(
            jsonb_build_object(
              'cycleId', v_candidate.cycle_id,
              'referenceYear', v_candidate.reference_year,
              'quadrimester', v_candidate.quadrimester,
              'error', sqlerrm
            )
          );
        end if;
    end;
  end loop;

  return jsonb_build_object(
    'ok', v_failed = 0,
    'closed', v_closed,
    'skipped', v_skipped,
    'failed', v_failed,
    'errors', v_errors
  );
end;
$$;

revoke all on function public.fami_preliminary_checkpoint_payload(uuid, boolean) from public, anon, authenticated;
revoke all on function public.close_due_fami_preliminary_quadrimesters() from public, anon, authenticated;
grant execute on function public.fami_preliminary_checkpoint_payload(uuid, boolean) to service_role;
grant execute on function public.close_due_fami_preliminary_quadrimesters() to service_role;

comment on column public.fami_preliminary_processings.calculation_kind is
  'manual: prévia do administrador no período aberto. automatic: snapshot consolidado no fechamento.';
comment on column public.fami_preliminary_processings.closed_at is
  'Preenchido somente no fechamento automático. Garante um snapshot consolidado por ciclo/ano/quadrimestre.';
comment on function public.materialize_fami_preliminary(uuid, integer, smallint, uuid) is
  'Materializa FAMI preliminar prelim_v1. Com ator admin, calcula/recalcula no período aberto. Sem ator, fecha automaticamente após o corte. Não altera fami_results.';
comment on function public.close_due_fami_preliminary_quadrimesters() is
  'Fecha quadrimestres vencidos ainda não consolidados. Idempotente, auditável e resiliente a falha parcial.';
comment on function public.fami_preliminary_checkpoint_payload(uuid, boolean) is
  'Serializa o checkpoint preliminar persistido para a API, sem recalcular.';
