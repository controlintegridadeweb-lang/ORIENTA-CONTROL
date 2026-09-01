-- ORIENTA — relatório bimestral de acompanhamento e FAMI preliminar prelim_v2.
-- Snapshots prelim_v1 já persistidos permanecem intactos. Novos cálculos usam prelim_v2.
-- O FAMI oficial (fami_results) não é recalculado nem sobrescrito.

alter table public.fami_preliminary_processings
  drop constraint if exists fami_preliminary_processings_methodology_version_check;

alter table public.fami_preliminary_processings
  add constraint fami_preliminary_processings_methodology_version_check
    check (methodology_version in ('prelim_v1', 'prelim_v2'));

alter table public.fami_preliminary_action_snapshots
  add column if not exists revision bigint,
  add column if not exists due_date date,
  add column if not exists has_valid_evidence boolean,
  add column if not exists evidence_document_id uuid,
  add column if not exists approved boolean,
  add column if not exists approval_effective_at timestamptz,
  add column if not exists has_open_adjustment boolean;

alter table public.fami_preliminary_action_snapshots
  drop constraint if exists fami_preliminary_action_snapshots_revision_check;

alter table public.fami_preliminary_action_snapshots
  add constraint fami_preliminary_action_snapshots_revision_check
    check (revision is null or revision >= 1);

alter table public.fami_preliminary_criterion_results
  add column if not exists criterion_completed boolean,
  add column if not exists completed_action_count integer;

alter table public.fami_preliminary_criterion_results
  drop constraint if exists fami_preliminary_criterion_completed_count_check;

alter table public.fami_preliminary_criterion_results
  add constraint fami_preliminary_criterion_completed_count_check
    check (
      completed_action_count is null
      or (
        completed_action_count >= 0
        and completed_action_count <= active_action_count
      )
    );

create or replace function public.calendar_bimester_bounds(
  p_year integer,
  p_bimester smallint
)
returns table (
  period_start date,
  period_end date,
  closes_quadrimester boolean,
  quadrimester smallint
)
language plpgsql
immutable
security definer
set search_path = public
as $$
declare
  v_end_month integer;
begin
  if p_year < 1900 or p_year > 2100 then
    raise exception 'invalid_preliminary_reference_year' using errcode = '22023';
  end if;
  if p_bimester not between 1 and 6 then
    raise exception 'invalid_bimester' using errcode = '22023';
  end if;
  v_end_month := p_bimester * 2;
  period_start := make_date(p_year, v_end_month - 1, 1);
  period_end := (make_date(p_year, v_end_month, 1) + interval '1 month' - interval '1 day')::date;
  closes_quadrimester := p_bimester in (2, 4, 6);
  quadrimester := case p_bimester
    when 2 then 1::smallint
    when 4 then 2::smallint
    when 6 then 3::smallint
    else null
  end;
  return next;
end;
$$;

create or replace function public.calendar_quadrimester_bounds(
  p_year integer,
  p_quadrimester smallint
)
returns table (
  period_start date,
  period_end date
)
language plpgsql
immutable
security definer
set search_path = public
as $$
begin
  if p_year < 1900 or p_year > 2100 then
    raise exception 'invalid_preliminary_reference_year' using errcode = '22023';
  end if;
  if p_quadrimester not between 1 and 3 then
    raise exception 'preliminary_invalid_quadrimester' using errcode = '22023';
  end if;
  period_start := make_date(
    p_year,
    case p_quadrimester when 1 then 1 when 2 then 5 else 9 end,
    1
  );
  period_end := case p_quadrimester
    when 1 then make_date(p_year, 4, 30)
    when 2 then make_date(p_year, 8, 31)
    else make_date(p_year, 12, 31)
  end;
  return next;
end;
$$;

create or replace function public.cycle_action_states_at(
  p_cycle_id uuid,
  p_source_processing_id uuid,
  p_cutoff_exclusive timestamptz
)
returns table (
  action_plan_id uuid,
  recommendation_id uuid,
  question_version_id uuid,
  section_id uuid,
  axis_id uuid,
  action_text text,
  responsible_label text,
  start_date date,
  due_date date,
  status public.action_plan_status,
  progress_percentage integer,
  revision bigint,
  effective_at timestamptz,
  has_valid_evidence boolean,
  evidence_document_id uuid,
  approved boolean,
  approval_effective_at timestamptz,
  has_open_adjustment boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with actions as (
    select
      ap.id,
      ap.recommendation_id,
      r.question_version_id,
      qv.section_id,
      qv.axis_id,
      ap.action_text,
      ap.responsible_label,
      ap.start_date,
      ap.due_date
    from public.action_plans ap
    join public.recommendations r
      on r.id = ap.recommendation_id
     and r.cycle_id = p_cycle_id
     and r.cycle_processing_id = p_source_processing_id
    join public.question_versions qv on qv.id = r.question_version_id
    where ap.created_at < p_cutoff_exclusive
  ),
  hist as (
    select distinct on (u.action_plan_id)
      u.action_plan_id,
      u.new_status,
      u.new_percentage,
      u.created_at
    from public.action_plan_progress_updates u
    join actions a on a.id = u.action_plan_id
    where u.created_at < p_cutoff_exclusive
    order by u.action_plan_id, u.created_at desc, u.id desc
  ),
  rev as (
    select
      a.id as action_plan_id,
      coalesce(
        (
          select n.action_revision
          from public.action_plan_supervision_notes n
          where n.action_plan_id = a.id
            and n.created_at < p_cutoff_exclusive
            and n.action_revision is not null
          order by n.created_at desc, n.id desc
          limit 1
        ),
        (
          select d.action_revision
          from public.action_plan_documents d
          where d.action_plan_id = a.id
            and d.created_at < p_cutoff_exclusive
          order by d.created_at desc, d.id desc
          limit 1
        ),
        1
      ) as revision
    from actions a
  ),
  evidence as (
    select distinct on (d.action_plan_id)
      d.action_plan_id,
      d.id as evidence_document_id
    from public.action_plan_documents d
    join rev r on r.action_plan_id = d.action_plan_id
    where d.created_at < p_cutoff_exclusive
      and (d.deactivated_at is null or d.deactivated_at >= p_cutoff_exclusive)
      and d.action_revision = r.revision
      and (
        (d.kind = 'file' and d.file_validation_status = 'valid')
        or d.kind = 'link'
      )
    order by d.action_plan_id, d.created_at desc, d.id desc
  ),
  approval as (
    select distinct on (n.action_plan_id)
      n.action_plan_id,
      n.created_at as approval_effective_at
    from public.action_plan_supervision_notes n
    join rev r on r.action_plan_id = n.action_plan_id
    where n.note_type = 'approval'
      and n.created_at < p_cutoff_exclusive
      and n.action_revision = r.revision
      and not exists (
        select 1
        from public.action_plan_supervision_notes later
        where later.action_plan_id = n.action_plan_id
          and later.created_at < p_cutoff_exclusive
          and later.created_at > n.created_at
          and later.note_type in ('adjustment_request', 'pending', 'approval')
      )
    order by n.action_plan_id, n.created_at desc, n.id desc
  ),
  open_adj as (
    select n.action_plan_id
    from public.action_plan_supervision_notes n
    where n.note_type in ('adjustment_request', 'pending')
      and n.created_at < p_cutoff_exclusive
      and (n.resolved_at is null or n.resolved_at >= p_cutoff_exclusive)
    group by n.action_plan_id
  )
  select
    a.id,
    a.recommendation_id,
    a.question_version_id,
    a.section_id,
    a.axis_id,
    a.action_text,
    a.responsible_label,
    a.start_date,
    a.due_date,
    h.new_status,
    h.new_percentage,
    r.revision,
    h.created_at,
    (e.evidence_document_id is not null),
    e.evidence_document_id,
    (appr.approval_effective_at is not null),
    appr.approval_effective_at,
    (oa.action_plan_id is not null)
  from actions a
  join hist h on h.action_plan_id = a.id
  join rev r on r.action_plan_id = a.id
  left join evidence e on e.action_plan_id = a.id
  left join approval appr on appr.action_plan_id = a.id
  left join open_adj oa on oa.action_plan_id = a.id;
$$;

create table public.action_plan_bimonthly_reports (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  source_cycle_processing_id uuid not null,
  reference_year integer not null check (reference_year between 1900 and 2100),
  bimester smallint not null check (bimester between 1 and 6),
  report_version integer not null check (report_version >= 1),
  period_start date not null,
  period_end date not null,
  generated_by uuid references auth.users(id) on delete restrict,
  generation_kind text not null default 'manual',
  generated_at timestamptz not null default now(),
  closed_at timestamptz,
  active_action_count integer not null default 0 check (active_action_count >= 0),
  not_started_count integer not null default 0 check (not_started_count >= 0),
  in_progress_count integer not null default 0 check (in_progress_count >= 0),
  completed_count integer not null default 0 check (completed_count >= 0),
  overdue_count integer not null default 0 check (overdue_count >= 0),
  cancelled_count integer not null default 0 check (cancelled_count >= 0),
  average_progress_percentage numeric(7,4) not null default 0
    check (average_progress_percentage between 0 and 100),
  completed_criterion_count integer not null default 0 check (completed_criterion_count >= 0),
  pending_criterion_count integer not null default 0 check (pending_criterion_count >= 0),
  actions_completed_in_period integer not null default 0 check (actions_completed_in_period >= 0),
  actions_advanced_in_period integer not null default 0 check (actions_advanced_in_period >= 0),
  actions_stagnant_in_period integer not null default 0 check (actions_stagnant_in_period >= 0),
  actions_became_overdue_in_period integer not null default 0 check (actions_became_overdue_in_period >= 0),
  criteria_completed_in_period integer not null default 0 check (criteria_completed_in_period >= 0),
  constraint action_plan_bimonthly_reports_kind_check
    check (generation_kind in ('manual', 'automatic')),
  constraint action_plan_bimonthly_reports_kind_state_check
    check (
      (generation_kind = 'manual' and generated_by is not null and closed_at is null)
      or (generation_kind = 'automatic' and closed_at is not null)
    ),
  constraint action_plan_bimonthly_reports_source_fkey
    foreign key (source_cycle_processing_id, cycle_id)
    references public.cycle_processings(id, cycle_id) on delete cascade,
  constraint action_plan_bimonthly_reports_version_unique
    unique (cycle_id, reference_year, bimester, report_version)
);

create unique index action_plan_bimonthly_reports_closed_unique
  on public.action_plan_bimonthly_reports (cycle_id, reference_year, bimester)
  where closed_at is not null;

create index action_plan_bimonthly_reports_cycle_period_idx
  on public.action_plan_bimonthly_reports (cycle_id, reference_year, bimester, report_version desc);

create table public.action_plan_bimonthly_action_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null
    references public.action_plan_bimonthly_reports(id) on delete cascade,
  action_plan_id uuid not null references public.action_plans(id) on delete restrict,
  recommendation_id uuid not null references public.recommendations(id) on delete restrict,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  axis_id uuid not null references public.axes(id) on delete restrict,
  action_text text not null,
  responsible_label text not null,
  start_date date not null,
  due_date date not null,
  status public.action_plan_status not null,
  progress_percentage integer not null check (progress_percentage between 0 and 100),
  revision bigint not null check (revision >= 1),
  effective_at timestamptz not null,
  overdue boolean not null,
  has_valid_evidence boolean not null,
  evidence_document_id uuid,
  approved boolean not null,
  approval_effective_at timestamptz,
  has_open_adjustment boolean not null,
  completed_in_period boolean not null,
  advanced_in_period boolean not null,
  stagnant_in_period boolean not null,
  became_overdue_in_period boolean not null,
  movements_in_period jsonb not null default '[]'::jsonb,
  captured_at timestamptz not null default now(),
  unique (report_id, action_plan_id)
);

create table public.action_plan_bimonthly_criterion_snapshots (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null
    references public.action_plan_bimonthly_reports(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  recommendation_id uuid not null references public.recommendations(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  axis_id uuid not null references public.axes(id) on delete restrict,
  criterion_completed boolean not null,
  active_action_count integer not null check (active_action_count >= 0),
  completed_action_count integer not null check (completed_action_count >= 0),
  completed_in_period boolean not null,
  captured_at timestamptz not null default now(),
  unique (report_id, question_version_id)
);

create trigger action_plan_bimonthly_reports_immutable
before update or delete on public.action_plan_bimonthly_reports
for each row execute function public.block_mutation();

create trigger action_plan_bimonthly_action_snapshots_immutable
before update or delete on public.action_plan_bimonthly_action_snapshots
for each row execute function public.block_mutation();

create trigger action_plan_bimonthly_criterion_snapshots_immutable
before update or delete on public.action_plan_bimonthly_criterion_snapshots
for each row execute function public.block_mutation();

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

  select b.period_start, b.period_end
    into v_period_start, v_period_end
  from public.calendar_quadrimester_bounds(p_reference_year, p_quadrimester) b;

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
    'prelim_v2',
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
    effective_at,
    revision,
    due_date,
    has_valid_evidence,
    evidence_document_id,
    approved,
    approval_effective_at,
    has_open_adjustment
  )
  select
    v_preliminary_id,
    s.action_plan_id,
    s.recommendation_id,
    s.status,
    s.progress_percentage,
    s.effective_at,
    s.revision,
    s.due_date,
    s.has_valid_evidence,
    s.evidence_document_id,
    s.approved,
    s.approval_effective_at,
    s.has_open_adjustment
  from public.cycle_action_states_at(p_cycle_id, v_source.id, v_cutoff_exclusive) s;

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
    preliminary_points,
    criterion_completed,
    completed_action_count
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
      count(*) filter (
        where s.status = 'done'::public.action_plan_status
          and s.progress_percentage = 100
          and coalesce(s.approved, false)
          and not coalesce(s.has_open_adjustment, false)
      )::integer as completed_count,
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
        when not os.included then 0::integer
        when os.recommendation_id is null then 0::integer
        when ex.id is not null then 0::integer
        else coalesce(ap.completed_count, 0)
      end as completed_count,
      case
        when not os.included then 0::numeric
        when os.recommendation_id is null then 0::numeric
        when ex.id is not null then 0::numeric
        when coalesce(ap.active_count, 0) = 0 then 0::numeric
        else round(ap.avg_progress, 4)
      end as progress,
      (
        os.included
        and os.recommendation_id is not null
        and ex.id is null
        and coalesce(ap.active_count, 0) > 0
        and coalesce(ap.completed_count, 0) = coalesce(ap.active_count, 0)
      ) as criterion_completed
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
    case when c.criterion_completed then round(c.possible - c.official, 4) else 0::numeric end,
    case
      when c.criterion_completed then round(c.possible, 4)
      else round(c.official, 4)
    end,
    c.criterion_completed,
    c.completed_count
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

create or replace function public.action_plan_bimonthly_report_payload(
  p_report_id uuid,
  p_idempotent boolean default false
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', r.id,
    'cycleId', r.cycle_id,
    'referenceYear', r.reference_year,
    'bimester', r.bimester,
    'reportVersion', r.report_version,
    'generationKind', r.generation_kind,
    'generatedBy', r.generated_by,
    'generatedAt', r.generated_at,
    'closedAt', r.closed_at,
    'periodStart', r.period_start,
    'periodEnd', r.period_end,
    'idempotent', p_idempotent,
    'summary', jsonb_build_object(
      'activeActionCount', r.active_action_count,
      'notStartedCount', r.not_started_count,
      'inProgressCount', r.in_progress_count,
      'completedCount', r.completed_count,
      'overdueCount', r.overdue_count,
      'cancelledCount', r.cancelled_count,
      'averageProgressPercentage', r.average_progress_percentage,
      'completedCriterionCount', r.completed_criterion_count,
      'pendingCriterionCount', r.pending_criterion_count,
      'actionsCompletedInPeriod', r.actions_completed_in_period,
      'actionsAdvancedInPeriod', r.actions_advanced_in_period,
      'actionsStagnantInPeriod', r.actions_stagnant_in_period,
      'actionsBecameOverdueInPeriod', r.actions_became_overdue_in_period,
      'criteriaCompletedInPeriod', r.criteria_completed_in_period
    )
  )
  from public.action_plan_bimonthly_reports r
  where r.id = p_report_id;
$$;

create or replace function public.materialize_action_plan_bimonthly_report(
  p_cycle_id uuid,
  p_reference_year integer,
  p_bimester smallint,
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
  v_existing_closed public.action_plan_bimonthly_reports%rowtype;
  v_report_id uuid;
  v_version integer;
  v_period_start date;
  v_period_end date;
  v_cutoff_exclusive timestamptz;
  v_period_start_instant timestamptz;
  v_today date;
  v_period_closed boolean;
  v_kind text;
  v_payload jsonb;
begin
  if p_reference_year < 1900 or p_reference_year > 2100 then
    raise exception 'invalid_preliminary_reference_year' using errcode = '22023';
  end if;
  if p_bimester not between 1 and 6 then
    raise exception 'invalid_bimester' using errcode = '22023';
  end if;

  v_kind := case when p_actor_user_id is null then 'automatic' else 'manual' end;

  if v_kind = 'manual' then
    if not exists (
      select 1 from public.profiles p
      where p.user_id = p_actor_user_id and p.role = 'admin'::public.app_user_role
    ) then
      raise exception 'bimonthly_admin_required' using errcode = '42501';
    end if;
  end if;

  perform public.set_audit_actor(p_actor_user_id);

  select * into v_cycle
  from public.cycles c
  where c.id = p_cycle_id
  for update;
  if not found then
    raise exception 'bimonthly_cycle_not_found' using errcode = 'P0002';
  end if;

  select b.period_start, b.period_end
    into v_period_start, v_period_end
  from public.calendar_bimester_bounds(p_reference_year, p_bimester) b;

  v_today := (current_timestamp at time zone 'America/Fortaleza')::date;
  v_period_closed := v_today > v_period_end;

  if v_today < v_period_start then
    raise exception 'bimonthly_period_not_started'
      using errcode = '23514',
            hint = 'O bimestre ainda não começou.';
  end if;

  select * into v_existing_closed
  from public.action_plan_bimonthly_reports r
  where r.cycle_id = p_cycle_id
    and r.reference_year = p_reference_year
    and r.bimester = p_bimester
    and r.closed_at is not null
  order by r.report_version desc
  limit 1;

  if found then
    if v_kind = 'manual' then
      raise exception 'bimonthly_period_already_closed'
        using errcode = '23514',
              hint = 'O relatório bimestral já foi fechado e não pode ser alterado.';
    end if;
    v_payload := public.action_plan_bimonthly_report_payload(v_existing_closed.id, true);
    if v_payload is null then
      raise exception 'bimonthly_closed_snapshot_incomplete' using errcode = 'P0002';
    end if;
    return v_payload;
  end if;

  if v_kind = 'manual' and v_period_closed then
    raise exception 'bimonthly_period_already_closed'
      using errcode = '23514',
            hint = 'Após a data de corte somente o fechamento automático consolida o bimestre.';
  end if;

  if v_kind = 'automatic' and not v_period_closed then
    raise exception 'bimonthly_period_not_closed'
      using errcode = '23514',
            hint = 'O fechamento automático só ocorre depois da data de corte.';
  end if;

  v_cutoff_exclusive := case
    when v_kind = 'manual' then current_timestamp
    else ((v_period_end + 1)::timestamp at time zone 'America/Fortaleza')
  end;
  v_period_start_instant := (v_period_start::timestamp at time zone 'America/Fortaleza');

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
    raise exception 'bimonthly_source_fami_not_available_for_period'
      using errcode = '23514',
            hint = 'O bimestre não possui Resultado FAMI oficial anterior ou igual à data de corte.';
  end if;

  select coalesce(max(r.report_version), 0) + 1
    into v_version
  from public.action_plan_bimonthly_reports r
  where r.cycle_id = p_cycle_id
    and r.reference_year = p_reference_year
    and r.bimester = p_bimester;

  insert into public.action_plan_bimonthly_reports (
    cycle_id,
    source_cycle_processing_id,
    reference_year,
    bimester,
    report_version,
    period_start,
    period_end,
    generated_by,
    generation_kind,
    closed_at
  ) values (
    p_cycle_id,
    v_source.id,
    p_reference_year,
    p_bimester,
    v_version,
    v_period_start,
    v_period_end,
    p_actor_user_id,
    v_kind,
    case when v_kind = 'automatic' then current_timestamp else null end
  )
  returning id into v_report_id;

  insert into public.action_plan_bimonthly_action_snapshots (
    report_id,
    action_plan_id,
    recommendation_id,
    question_version_id,
    section_id,
    axis_id,
    action_text,
    responsible_label,
    start_date,
    due_date,
    status,
    progress_percentage,
    revision,
    effective_at,
    overdue,
    has_valid_evidence,
    evidence_document_id,
    approved,
    approval_effective_at,
    has_open_adjustment,
    completed_in_period,
    advanced_in_period,
    stagnant_in_period,
    became_overdue_in_period,
    movements_in_period
  )
  select
    v_report_id,
    cur.action_plan_id,
    cur.recommendation_id,
    cur.question_version_id,
    cur.section_id,
    cur.axis_id,
    cur.action_text,
    cur.responsible_label,
    cur.start_date,
    cur.due_date,
    cur.status,
    cur.progress_percentage,
    cur.revision,
    cur.effective_at,
    (
      cur.status not in ('done'::public.action_plan_status, 'cancelled'::public.action_plan_status)
      and cur.due_date < v_period_end
    ),
    cur.has_valid_evidence,
    cur.evidence_document_id,
    cur.approved,
    cur.approval_effective_at,
    cur.has_open_adjustment,
    (
      cur.status = 'done'::public.action_plan_status
      and (
        prev.action_plan_id is null
        or prev.status is distinct from 'done'::public.action_plan_status
      )
    ),
    exists (
      select 1
      from public.action_plan_progress_updates u
      where u.action_plan_id = cur.action_plan_id
        and u.created_at >= v_period_start_instant
        and u.created_at < v_cutoff_exclusive
        and u.new_percentage > u.previous_percentage
    ),
    not exists (
      select 1
      from public.action_plan_progress_updates u
      where u.action_plan_id = cur.action_plan_id
        and u.created_at >= v_period_start_instant
        and u.created_at < v_cutoff_exclusive
    ),
    (
      cur.status not in ('done'::public.action_plan_status, 'cancelled'::public.action_plan_status)
      and cur.due_date < v_period_end
      and not (
        prev.action_plan_id is not null
        and prev.status not in ('done'::public.action_plan_status, 'cancelled'::public.action_plan_status)
        and prev.due_date < v_period_start
      )
    ),
    coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', u.id,
          'previousStatus', u.previous_status,
          'newStatus', u.new_status,
          'previousPercentage', u.previous_percentage,
          'newPercentage', u.new_percentage,
          'createdAt', u.created_at
        )
        order by u.created_at, u.id
      )
      from public.action_plan_progress_updates u
      where u.action_plan_id = cur.action_plan_id
        and u.created_at >= v_period_start_instant
        and u.created_at < v_cutoff_exclusive
    ), '[]'::jsonb)
  from public.cycle_action_states_at(p_cycle_id, v_source.id, v_cutoff_exclusive) cur
  left join public.cycle_action_states_at(p_cycle_id, v_source.id, v_period_start_instant) prev
    on prev.action_plan_id = cur.action_plan_id;

  insert into public.action_plan_bimonthly_criterion_snapshots (
    report_id,
    question_version_id,
    recommendation_id,
    section_id,
    axis_id,
    criterion_completed,
    active_action_count,
    completed_action_count,
    completed_in_period
  )
  with current_state as (
    select
      s.recommendation_id,
      s.question_version_id,
      s.section_id,
      s.axis_id,
      count(*) filter (where s.status <> 'cancelled'::public.action_plan_status)::integer as active_count,
      count(*) filter (
        where s.status = 'done'::public.action_plan_status
          and s.progress_percentage = 100
          and s.approved
          and not s.has_open_adjustment
      )::integer as completed_count
    from public.action_plan_bimonthly_action_snapshots s
    where s.report_id = v_report_id
    group by s.recommendation_id, s.question_version_id, s.section_id, s.axis_id
  ),
  previous_state as (
    select
      s.recommendation_id,
      count(*) filter (where s.status <> 'cancelled'::public.action_plan_status)::integer as active_count,
      count(*) filter (
        where s.status = 'done'::public.action_plan_status
          and s.progress_percentage = 100
          and s.approved
          and not s.has_open_adjustment
      )::integer as completed_count
    from public.cycle_action_states_at(p_cycle_id, v_source.id, v_period_start_instant) s
    group by s.recommendation_id
  ),
  exceptions as (
    select distinct on (ex.recommendation_id)
      ex.recommendation_id
    from public.recommendation_exceptions ex
    where ex.status = 'approved'
      and ex.decided_at is not null
      and ex.decided_at < v_cutoff_exclusive
    order by ex.recommendation_id, ex.decided_at desc, ex.id desc
  )
  select
    v_report_id,
    c.question_version_id,
    c.recommendation_id,
    c.section_id,
    c.axis_id,
    (ex.recommendation_id is null and c.active_count > 0 and c.completed_count = c.active_count),
    case when ex.recommendation_id is null then c.active_count else 0 end,
    case when ex.recommendation_id is null then c.completed_count else 0 end,
    (
      ex.recommendation_id is null
      and c.active_count > 0
      and c.completed_count = c.active_count
      and not (
        coalesce(p.active_count, 0) > 0
        and coalesce(p.completed_count, 0) = coalesce(p.active_count, 0)
      )
    )
  from current_state c
  left join previous_state p on p.recommendation_id = c.recommendation_id
  left join exceptions ex on ex.recommendation_id = c.recommendation_id;

  begin
    execute 'alter table public.action_plan_bimonthly_reports disable trigger action_plan_bimonthly_reports_immutable';
    update public.action_plan_bimonthly_reports r
  set
    active_action_count = s.active_action_count,
    not_started_count = s.not_started_count,
    in_progress_count = s.in_progress_count,
    completed_count = s.completed_count,
    overdue_count = s.overdue_count,
    cancelled_count = s.cancelled_count,
    average_progress_percentage = s.average_progress_percentage,
    completed_criterion_count = s.completed_criterion_count,
    pending_criterion_count = s.pending_criterion_count,
    actions_completed_in_period = s.actions_completed_in_period,
    actions_advanced_in_period = s.actions_advanced_in_period,
    actions_stagnant_in_period = s.actions_stagnant_in_period,
    actions_became_overdue_in_period = s.actions_became_overdue_in_period,
    criteria_completed_in_period = s.criteria_completed_in_period
  from (
    select
      count(*) filter (where a.status <> 'cancelled'::public.action_plan_status)::integer as active_action_count,
      count(*) filter (where a.status = 'todo'::public.action_plan_status)::integer as not_started_count,
      count(*) filter (where a.status = 'doing'::public.action_plan_status)::integer as in_progress_count,
      count(*) filter (where a.status = 'done'::public.action_plan_status)::integer as completed_count,
      count(*) filter (where a.overdue)::integer as overdue_count,
      count(*) filter (where a.status = 'cancelled'::public.action_plan_status)::integer as cancelled_count,
      coalesce(
        avg(a.progress_percentage) filter (where a.status <> 'cancelled'::public.action_plan_status),
        0
      )::numeric as average_progress_percentage,
      (select count(*) from public.action_plan_bimonthly_criterion_snapshots c where c.report_id = v_report_id and c.criterion_completed)::integer as completed_criterion_count,
      (select count(*) from public.action_plan_bimonthly_criterion_snapshots c where c.report_id = v_report_id and not c.criterion_completed)::integer as pending_criterion_count,
      count(*) filter (where a.completed_in_period)::integer as actions_completed_in_period,
      count(*) filter (where a.advanced_in_period)::integer as actions_advanced_in_period,
      count(*) filter (where a.stagnant_in_period and a.status <> 'cancelled'::public.action_plan_status)::integer as actions_stagnant_in_period,
      count(*) filter (where a.became_overdue_in_period)::integer as actions_became_overdue_in_period,
      (select count(*) from public.action_plan_bimonthly_criterion_snapshots c where c.report_id = v_report_id and c.completed_in_period)::integer as criteria_completed_in_period
    from public.action_plan_bimonthly_action_snapshots a
    where a.report_id = v_report_id
  ) s
  where r.id = v_report_id;
    execute 'alter table public.action_plan_bimonthly_reports enable trigger action_plan_bimonthly_reports_immutable';
  exception
    when others then
      execute 'alter table public.action_plan_bimonthly_reports enable trigger action_plan_bimonthly_reports_immutable';
      raise;
  end;

  v_payload := public.action_plan_bimonthly_report_payload(v_report_id, false);
  if v_payload is null then
    raise exception 'bimonthly_snapshot_incomplete' using errcode = 'P0002';
  end if;
  return v_payload;
end;
$$;

create or replace function public.close_due_action_plan_bimesters()
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
  v_quadrimester smallint;
begin
  if not pg_try_advisory_xact_lock(87201403, 1) then
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
        b.bimester::smallint as bimester,
        bounds.period_end,
        bounds.quadrimester
      from generate_series(2020, extract(year from v_today)::integer) as y(year)
      cross join generate_series(1, 6) as b(bimester)
      join lateral public.calendar_bimester_bounds(y.year, b.bimester::smallint) bounds on true
    ),
    due_periods as (
      select p.year, p.bimester, p.period_end, p.quadrimester
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
      p.bimester,
      p.period_end,
      p.quadrimester
    from cycles_with_fami c
    cross join due_periods p
    where not exists (
      select 1
      from public.action_plan_bimonthly_reports r
      where r.cycle_id = c.cycle_id
        and r.reference_year = p.year
        and r.bimester = p.bimester
        and r.closed_at is not null
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
      from public.action_plan_bimonthly_reports r
      where r.cycle_id = v_candidate.cycle_id
        and r.reference_year = v_candidate.reference_year
        and r.bimester = v_candidate.bimester
    ) and not exists (
      select 1
      from public.action_plans ap
      join public.recommendations rec on rec.id = ap.recommendation_id
      join public.cycle_processings cp on cp.id = rec.cycle_processing_id
      where cp.cycle_id = v_candidate.cycle_id
        and cp.status = 'completed'::public.cycle_processing_status
        and ap.created_at < v_cutoff_exclusive
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    begin
      v_result := public.materialize_action_plan_bimonthly_report(
        v_candidate.cycle_id,
        v_candidate.reference_year,
        v_candidate.bimester,
        null
      );
      if coalesce((v_result ->> 'idempotent')::boolean, false) then
        v_skipped := v_skipped + 1;
      else
        v_closed := v_closed + 1;
      end if;

      v_quadrimester := v_candidate.quadrimester;
      if v_quadrimester is not null then
        begin
          perform public.materialize_fami_preliminary(
            v_candidate.cycle_id,
            v_candidate.reference_year,
            v_quadrimester,
            null
          );
        exception
          when others then
            v_errors := v_errors || jsonb_build_array(
              jsonb_build_object(
                'cycleId', v_candidate.cycle_id,
                'referenceYear', v_candidate.reference_year,
                'bimester', v_candidate.bimester,
                'quadrimester', v_quadrimester,
                'error', sqlerrm
              )
            );
        end;
      end if;
    exception
      when unique_violation then
        v_skipped := v_skipped + 1;
      when others then
        if sqlerrm like '%bimonthly_source_fami_not_available_for_period%'
           or sqlerrm like '%bimonthly_period_already_closed%'
           or sqlerrm like '%bimonthly_period_not_closed%'
           or sqlerrm like '%bimonthly_period_not_started%' then
          v_skipped := v_skipped + 1;
        else
          v_failed := v_failed + 1;
          v_errors := v_errors || jsonb_build_array(
            jsonb_build_object(
              'cycleId', v_candidate.cycle_id,
              'referenceYear', v_candidate.reference_year,
              'bimester', v_candidate.bimester,
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

alter table public.action_plan_bimonthly_reports enable row level security;
alter table public.action_plan_bimonthly_action_snapshots enable row level security;
alter table public.action_plan_bimonthly_criterion_snapshots enable row level security;

create policy action_plan_bimonthly_reports_read_scoped
  on public.action_plan_bimonthly_reports for select to authenticated
  using (
    app_private.is_admin()
    or cycle_id in (
      select c.id from public.cycles c
      where c.organization_id = app_private.current_organization_id()
    )
  );

create policy action_plan_bimonthly_action_snapshots_read_scoped
  on public.action_plan_bimonthly_action_snapshots for select to authenticated
  using (
    report_id in (
      select r.id from public.action_plan_bimonthly_reports r
      join public.cycles c on c.id = r.cycle_id
      where app_private.is_admin() or c.organization_id = app_private.current_organization_id()
    )
  );

create policy action_plan_bimonthly_criterion_snapshots_read_scoped
  on public.action_plan_bimonthly_criterion_snapshots for select to authenticated
  using (
    report_id in (
      select r.id from public.action_plan_bimonthly_reports r
      join public.cycles c on c.id = r.cycle_id
      where app_private.is_admin() or c.organization_id = app_private.current_organization_id()
    )
  );

revoke all on table public.action_plan_bimonthly_reports from anon, authenticated;
revoke all on table public.action_plan_bimonthly_action_snapshots from anon, authenticated;
revoke all on table public.action_plan_bimonthly_criterion_snapshots from anon, authenticated;

grant select on public.action_plan_bimonthly_reports to authenticated, service_role;
grant select on public.action_plan_bimonthly_action_snapshots to authenticated, service_role;
grant select on public.action_plan_bimonthly_criterion_snapshots to authenticated, service_role;

revoke all on function public.calendar_bimester_bounds(integer, smallint) from public, anon, authenticated;
revoke all on function public.calendar_quadrimester_bounds(integer, smallint) from public, anon, authenticated;
revoke all on function public.cycle_action_states_at(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.action_plan_bimonthly_report_payload(uuid, boolean) from public, anon, authenticated;
revoke all on function public.materialize_action_plan_bimonthly_report(uuid, integer, smallint, uuid) from public, anon, authenticated;
revoke all on function public.close_due_action_plan_bimesters() from public, anon, authenticated;

grant execute on function public.calendar_bimester_bounds(integer, smallint) to service_role;
grant execute on function public.calendar_quadrimester_bounds(integer, smallint) to service_role;
grant execute on function public.cycle_action_states_at(uuid, uuid, timestamptz) to service_role;
grant execute on function public.action_plan_bimonthly_report_payload(uuid, boolean) to service_role;
grant execute on function public.materialize_action_plan_bimonthly_report(uuid, integer, smallint, uuid) to service_role;
grant execute on function public.close_due_action_plan_bimesters() to service_role;

comment on table public.action_plan_bimonthly_reports is
  'Fotografia imutável do plano de integridade e compliance na data de corte de cada bimestre. Não recalcula o FAMI oficial.';
comment on table public.action_plan_bimonthly_action_snapshots is
  'Estado da ação na data de corte do relatório bimestral, independente do estado vivo posterior.';
comment on table public.action_plan_bimonthly_criterion_snapshots is
  'Conclusão efetiva do critério na data de corte do bimestre, reutilizando as regras de supervisão.';
comment on function public.calendar_bimester_bounds(integer, smallint) is
  'Início, fim, corte e eventual quadrimestre fechado por cada bimestre civil, no calendário institucional.';
comment on function public.calendar_quadrimester_bounds(integer, smallint) is
  'Início e fim dos três quadrimestres civis usados pelo FAMI preliminar.';
comment on function public.cycle_action_states_at(uuid, uuid, timestamptz) is
  'Reconstrói status, progresso, comprovação e supervisão de cada ação válidos antes do instante exclusivo de corte.';
comment on function public.materialize_action_plan_bimonthly_report(uuid, integer, smallint, uuid) is
  'Gera o relatório bimestral. Com ator admin, prévia no período aberto; sem ator, fecha automaticamente após o corte.';
comment on function public.materialize_fami_preliminary(uuid, integer, smallint, uuid) is
  'Materializa FAMI preliminar. Novos cálculos usam prelim_v2 (recuperação integral só com critério efetivamente concluído). Snapshots prelim_v1 permanecem. Não altera fami_results.';
comment on function public.close_due_action_plan_bimesters() is
  'Fecha bimestres vencidos e, nos bimestres 2, 4 e 6, dispara o fechamento do quadrimestre correspondente.';
comment on column public.fami_preliminary_processings.methodology_version is
  'prelim_v1: recuperação proporcional ao progresso. prelim_v2: recuperação integral somente com critério concluído e aceito.';
comment on column public.fami_preliminary_criterion_results.criterion_completed is
  'Verdadeiro quando todas as ações ativas necessárias estavam concluídas e aceitas na data de corte. Nulo em snapshots prelim_v1.';

notify pgrst, 'reload schema';

