-- Inclui início da ação e ordem oficial de seção/pergunta na RPC de monitoramento
-- do plano de ação. Sem esses campos a exportação não consegue datas reais nem
-- a hierarquia do formulário.

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
      ap.start_date,
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
        'section_order', s.section_order,
        'axis_id', s.axis_id,
        'axis_name', s.axis_name,
        'question_order', s.question_order,
        'recommendation_type', s.recommendation_type,
        'recommendation_text', s.recommendation_text,
        'recommendation_status', s.recommendation_status,
        'recommendation_created_at', s.recommendation_created_at,
        'plan_id', s.plan_id,
        'action_text', s.action_text,
        'start_date', s.start_date,
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
