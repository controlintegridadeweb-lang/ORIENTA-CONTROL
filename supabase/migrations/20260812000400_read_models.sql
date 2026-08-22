-- Helper requerido pelos read models desta migration.
create or replace function public.evidence_ui_status(
  p_validation_status public.evidence_validation_status,
  p_cycle_state public.cycle_state
)
returns text
language sql
immutable
parallel safe
set search_path = public
as $$
  select case
    when p_validation_status = 'approved' then 'approved'
    when p_validation_status = 'invalidated' then 'invalidated'
    when p_validation_status = 'adjustment_requested' then 'adjustment_requested'
    when p_cycle_state in ('submitted', 'in_validation') then 'submitted'
    else 'pending'
  end;
$$;

-- ORIENTA greenfield baseline — Views e read models finais
-- Gerada a partir do estado final pré-cutover; não contém dados históricos reais.

create view public.report_emission_summaries
with (security_invoker = true)
as
select
  r.cycle_id,
  r.cycle_processing_id,
  count(*)::integer as emission_count,
  max(r.emission_version)::integer as latest_emission_version
from public.reports r
where r.status in ('completed', 'legacy')
group by r.cycle_id, r.cycle_processing_id;

create view public.report_history_entries
with (security_invoker = true)
as
with latest_fami_processing as (
  select cp.cycle_id, max(cp.processing_version)::integer as latest_processing_version
  from public.cycle_processings cp
  where cp.status = 'completed'::public.cycle_processing_status
    and exists (
      select 1 from public.fami_results fr
      where fr.cycle_processing_id = cp.id
        and fr.cycle_id = cp.cycle_id
        and fr.scope_type = 'global'
    )
  group by cp.cycle_id
), source as (
  select
    r.id,
    r.cycle_id,
    r.cycle_processing_id,
    r.file_path,
    r.file_sha256,
    r.content_sha256,
    r.file_size_bytes,
    r.generated_by,
    coalesce(nullif(btrim(r.generated_by_name), ''), nullif(btrim(p.full_name), '')) as generated_by_name,
    r.generated_at,
    r.emission_version,
    r.reissue_reason,
    r.action_plan_revision as report_action_plan_revision,
    r.reference_start_year,
    r.reference_end_year,
    cp.processing_version,
    cp.fami_policy_version,
    c.organization_id,
    c.state as cycle_state,
    c.action_plan_revision as current_action_plan_revision,
    c.reference_start_year as current_reference_start_year,
    c.reference_end_year as current_reference_end_year,
    c.period_label,
    fv.form_id,
    fv.version as form_version,
    f.name as form_name,
    lfp.latest_processing_version,
    max(r.emission_version) over (partition by r.cycle_processing_id) as latest_emission_version
  from public.reports r
  join public.cycle_processings cp
    on cp.id = r.cycle_processing_id and cp.cycle_id = r.cycle_id
  join latest_fami_processing lfp on lfp.cycle_id = r.cycle_id
  join public.cycles c on c.id = r.cycle_id
  join public.form_versions fv on fv.id = c.form_version_id
  join public.forms f on f.id = fv.form_id
  left join public.profiles p on p.user_id = r.generated_by
  where r.status in ('completed', 'legacy')
)
select
  source.*,
  (
    source.cycle_state = 'completed'::public.cycle_state
    and source.processing_version = source.latest_processing_version
    and source.emission_version = source.latest_emission_version
    and source.report_action_plan_revision = source.current_action_plan_revision
    and source.reference_start_year is not distinct from source.current_reference_start_year
    and source.reference_end_year is not distinct from source.current_reference_end_year
    and source.file_sha256 is not null
  ) as is_current
from source;

create view public.report_history_years
with (security_invoker = true)
as
select
  entries.organization_id,
  years.calendar_year
from public.report_history_entries entries
cross join lateral generate_series(
  entries.reference_start_year,
  entries.reference_end_year
) as years(calendar_year)
where entries.reference_start_year is not null
  and entries.reference_end_year is not null
group by entries.organization_id, years.calendar_year;

create view public.evidence_operational_view with (security_invoker = true) as
select
  e.id,
  e.response_id,
  r.cycle_id,
  c.state as cycle_state,
  c.period_label,
  c.organization_id,
  o.name as organization_name,
  fv.form_id,
  f.name as form_name,
  fv.version as form_version,
  qv.question_id,
  qv.prompt as question_prompt,
  qv.axis_name,
  qv.section_name,
  qv.evidence_parameter,
  e.kind,
  e.title,
  e.text_body,
  e.storage_path,
  e.external_link,
  e.link_reason,
  e.original_filename,
  e.submitted_at,
  e.submitted_by,
  e.validation_status,
  e.validation_justification,
  e.validated_at,
  e.validated_by,
  case
    when r.admin_applicability_status = 'not_applicable'
     and e.validation_status in (
       'pending'::public.evidence_validation_status,
       'adjustment_requested'::public.evidence_validation_status
     )
      then 'not_required'
    else public.evidence_ui_status(e.validation_status, c.state)
  end as current_status,
  concat_ws(
    ' ',
    e.title,
    e.text_body,
    e.original_filename,
    e.storage_path,
    e.external_link,
    e.link_reason,
    qv.prompt,
    qv.axis_name,
    qv.section_name,
    f.name,
    o.name,
    e.submitted_by::text
  ) as search_document
from public.evidences e
join public.responses r on r.id = e.response_id
join public.cycles c on c.id = r.cycle_id
join public.organizations o on o.id = c.organization_id
join public.form_versions fv on fv.id = c.form_version_id
join public.forms f on f.id = fv.form_id
join public.question_versions qv on qv.id = r.question_version_id
where e.deactivated_at is null;

create or replace view public.current_recommendation_read_model
with (security_invoker = true)
as
with official_processing as (
  select distinct on (cp.cycle_id)
    cp.id as cycle_processing_id,
    cp.cycle_id
  from public.cycle_processings cp
  join public.cycles c on c.id = cp.cycle_id
  where cp.status = 'completed'
    and c.state in ('validated', 'completed')
  order by cp.cycle_id, cp.processing_version desc, cp.id desc
)
select
  r.id as recommendation_id,
  r.cycle_id,
  r.cycle_processing_id,
  r.question_version_id,
  r.tipo::text as recommendation_type,
  r.text as recommendation_text,
  r.source,
  r.origin,
  r.created_at as recommendation_created_at,
  c.state as cycle_state,
  c.period_label,
  c.organization_id,
  o.name as organization_name,
  fv.form_id,
  f.name as form_name,
  fv.version as form_version,
  qv.question_id,
  qv.prompt as question_prompt,
  qv.section_id,
  qv.section_name,
  qv.section_order,
  qv.axis_id,
  qv.axis_name,
  coalesce(fq.order_index, 0) as question_order,
  coalesce(ps.action_plans, '[]'::jsonb) as action_plans,
  coalesce(ps.plan_count, 0) > 0 as has_action_plan,
  case
    when (
      case
        when c.state in ('validated', 'completed') then exists (
          select 1
          from public.processing_waiver_snapshots pws
          where pws.cycle_processing_id = r.cycle_processing_id
            and pws.question_id = qv.question_id
        )
        else exists (
          select 1
          from public.question_organization_waivers qow
          where qow.organization_id = c.organization_id
            and qow.question_id = qv.question_id
        )
      end
    ) or coalesce(ex.has_approved, false) then 'dismissed'
    when coalesce(ex.has_pending, false) then 'exception_requested'
    when coalesce(ps.plan_count, 0) = 0 then 'generated'
    when coalesce(ps.only_cancelled, false) then 'generated'
    when coalesce(ps.has_open_adjustment, false) then 'adjustment_requested'
    when coalesce(ps.has_active, false) then 'in_action_plan'
    when coalesce(ps.has_completed, false)
      and coalesce(ps.all_completed_approved, false) then 'completed'
    when coalesce(ps.has_completed, false) then 'awaiting_approval'
    else 'generated'
  end as recommendation_status
from public.recommendations r
join official_processing op
  on op.cycle_id = r.cycle_id
 and op.cycle_processing_id = r.cycle_processing_id
join public.cycles c on c.id = r.cycle_id
join public.organizations o on o.id = c.organization_id
join public.form_versions fv on fv.id = c.form_version_id
join public.forms f on f.id = fv.form_id
join public.question_versions qv on qv.id = r.question_version_id
left join public.form_questions fq
  on fq.form_version_id = c.form_version_id
 and fq.question_version_id = r.question_version_id
left join lateral (
  select
    count(*)::integer as plan_count,
    bool_or(ap.status in ('todo', 'doing')) as has_active,
    bool_or(ap.status = 'done') as has_completed,
    bool_and(ap.status = 'cancelled') as only_cancelled,
    bool_or(exists (
      select 1
      from public.action_plan_supervision_notes n
      where n.action_plan_id = ap.id
        and n.note_type in ('adjustment_request', 'pending')
        and n.lifecycle_status in ('open', 'acknowledged')
    )) as has_open_adjustment,
    bool_and(
      ap.status = 'cancelled'
      or (
        ap.status = 'done'
        and exists (
          select 1
          from public.action_plan_documents d
          where d.action_plan_id = ap.id
            and d.action_revision = ap.revision
            and d.deactivated_at is null
            and (
              (d.kind = 'link' and d.external_link is not null)
              or (d.kind = 'file' and d.file_validation_status = 'valid')
            )
        )
        and exists (
          select 1
          from public.action_plan_supervision_notes n
          where n.action_plan_id = ap.id
            and n.note_type = 'approval'
            and n.lifecycle_status = 'effective'
            and n.action_revision = ap.revision
        )
        and not exists (
          select 1
          from public.action_plan_supervision_notes n
          where n.action_plan_id = ap.id
            and n.note_type in ('adjustment_request', 'pending')
            and n.lifecycle_status in ('open', 'acknowledged')
        )
      )
    ) as all_completed_approved,
    jsonb_agg(
      jsonb_build_object(
        'id', ap.id,
        'action_text', ap.action_text,
        'start_date', ap.start_date,
        'due_date', ap.due_date,
        'responsible_user_id', ap.responsible_user_id,
        'responsible_label', ap.responsible_label,
        'progress_percentage', ap.progress_percentage,
        'status', ap.status,
        'execution_notes', ap.execution_notes,
        'updated_at', ap.updated_at,
        'revision', ap.revision,
        'documents', coalesce((
          select jsonb_agg(
            jsonb_build_object(
              'id', d.id,
              'action_revision', d.action_revision,
              'kind', d.kind,
              'title', d.title,
              'external_link', d.external_link,
              'original_filename', d.original_filename,
              'mime_type', d.mime_type,
              'size_bytes', d.size_bytes,
              'file_validation_status', d.file_validation_status,
              'created_at', d.created_at
            ) order by d.created_at desc, d.id desc
          )
          from public.action_plan_documents d
          where d.action_plan_id = ap.id
            and d.deactivated_at is null
        ), '[]'::jsonb)
      ) order by ap.updated_at desc, ap.id desc
    ) as action_plans
  from public.action_plans ap
  where ap.recommendation_id = r.id
) ps on true
left join lateral (
  select
    bool_or(ex.status = 'approved') as has_approved,
    bool_or(
      ex.status = 'requested'
      and (ex.prazo is null or ex.prazo >= current_date)
    ) as has_pending
  from public.recommendation_exceptions ex
  where ex.recommendation_id = r.id
) ex on true;

create or replace view public.form_answer_cycle_read_model
with (security_invoker = true)
as
with response_stats as (
  select
    r.cycle_id,
    count(*)::integer as answered_questions,
    max(r.updated_at) as last_updated_at,
    count(distinct r.created_by) filter (where r.created_by is not null)::integer
      as contributor_count
  from public.responses r
  group by r.cycle_id
), question_stats as (
  select fq.form_version_id, count(*)::integer as total_questions
  from public.form_questions fq
  group by fq.form_version_id
)
select
  c.id as cycle_id,
  c.organization_id,
  o.name as organization_name,
  c.form_version_id,
  fv.form_id,
  c.period_label,
  c.state as cycle_state,
  coalesce(rs.answered_questions, 0) as answered_questions,
  coalesce(qs.total_questions, 0) as total_questions,
  coalesce(rs.last_updated_at, '1970-01-01 00:00:00+00'::timestamptz)
    as last_updated_at,
  coalesce(rs.contributor_count, 0) as contributor_count,
  case
    when c.state = 'awaiting_adjustment' then 'em_complementacao'
    when coalesce(rs.answered_questions, 0) <= 0 then 'nao_iniciada'
    when coalesce(qs.total_questions, 0) > 0
      and coalesce(rs.answered_questions, 0) >= qs.total_questions
      and c.state in ('submitted', 'in_validation', 'awaiting_adjustment', 'validated', 'completed')
      then 'submetida'
    when coalesce(qs.total_questions, 0) > 0
      and coalesce(rs.answered_questions, 0) >= qs.total_questions
      then 'completa'
    else 'em_preenchimento'
  end as respondent_status
from public.cycles c
join public.organizations o on o.id = c.organization_id
join public.form_versions fv on fv.id = c.form_version_id
left join response_stats rs on rs.cycle_id = c.id
left join question_stats qs on qs.form_version_id = c.form_version_id;
