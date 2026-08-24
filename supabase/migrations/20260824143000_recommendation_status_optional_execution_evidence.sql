-- A situação “completed” da recomendação segue o aceite vigente, não a
-- comprovação da execução. Sem isso, o ciclo encerra e o PDF oficial recusa
-- a emissão com report_action_plan_not_closed.

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

comment on view public.current_recommendation_read_model is
  'Situação da recomendação derivada de dispensa, exceção, ações e aceite vigente. Comprovação da execução é opcional.';

notify pgrst, 'reload schema';
