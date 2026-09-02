-- Histórico visível: somente a emissão mais recente de cada grupo do catálogo.
-- Emissões anteriores permanecem em public.reports e public.action_plan_bimonthly_reports.
create or replace view public.report_history_entries
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
), official_source as (
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
), official as (
  select
    official_source.*,
    (
      official_source.cycle_state = 'completed'::public.cycle_state
      and official_source.processing_version = official_source.latest_processing_version
      and official_source.emission_version = official_source.latest_emission_version
      and official_source.report_action_plan_revision = official_source.current_action_plan_revision
      and official_source.reference_start_year is not distinct from official_source.current_reference_start_year
      and official_source.reference_end_year is not distinct from official_source.current_reference_end_year
      and official_source.file_sha256 is not null
    ) as is_current,
    'annual'::text as report_kind,
    null::smallint as bimester,
    null::text as generation_kind
  from official_source
), bimonthly as (
  select
    r.id,
    r.cycle_id,
    r.source_cycle_processing_id as cycle_processing_id,
    null::text as file_path,
    null::text as file_sha256,
    null::text as content_sha256,
    null::bigint as file_size_bytes,
    r.generated_by,
    nullif(btrim(p.full_name), '') as generated_by_name,
    r.generated_at,
    r.report_version as emission_version,
    null::text as reissue_reason,
    null::integer as report_action_plan_revision,
    r.reference_year as reference_start_year,
    r.reference_year as reference_end_year,
    cp.processing_version,
    cp.fami_policy_version,
    c.organization_id,
    c.state as cycle_state,
    c.action_plan_revision as current_action_plan_revision,
    c.reference_start_year as current_reference_start_year,
    c.reference_end_year as current_reference_end_year,
    format('%sº bimestre de %s', r.bimester, r.reference_year) as period_label,
    fv.form_id,
    fv.version as form_version,
    f.name as form_name,
    lfp.latest_processing_version,
    max(r.report_version) over (
      partition by c.organization_id, fv.form_id, r.reference_year, r.bimester
    ) as latest_emission_version,
    r.report_version = max(r.report_version) over (
      partition by c.organization_id, fv.form_id, r.reference_year, r.bimester
    ) as is_current,
    'bimonthly'::text as report_kind,
    r.bimester,
    r.generation_kind
  from public.action_plan_bimonthly_reports r
  join public.cycle_processings cp
    on cp.id = r.source_cycle_processing_id and cp.cycle_id = r.cycle_id
  join latest_fami_processing lfp on lfp.cycle_id = r.cycle_id
  join public.cycles c on c.id = r.cycle_id
  join public.form_versions fv on fv.id = c.form_version_id
  join public.forms f on f.id = fv.form_id
  left join public.profiles p on p.user_id = r.generated_by
), catalog as (
  select * from official
  union all
  select * from bimonthly
)
select distinct on (
  catalog.organization_id,
  catalog.form_id,
  catalog.report_kind,
  coalesce(
    catalog.reference_start_year,
    extract(year from catalog.generated_at at time zone 'America/Sao_Paulo')::integer
  ),
  coalesce(
    catalog.reference_end_year,
    catalog.reference_start_year,
    extract(year from catalog.generated_at at time zone 'America/Sao_Paulo')::integer
  ),
  coalesce(catalog.bimester, 0)
) catalog.*
from catalog
order by
  catalog.organization_id,
  catalog.form_id,
  catalog.report_kind,
  coalesce(
    catalog.reference_start_year,
    extract(year from catalog.generated_at at time zone 'America/Sao_Paulo')::integer
  ),
  coalesce(
    catalog.reference_end_year,
    catalog.reference_start_year,
    extract(year from catalog.generated_at at time zone 'America/Sao_Paulo')::integer
  ),
  coalesce(catalog.bimester, 0),
  case when catalog.report_kind = 'annual' then catalog.processing_version else 0 end desc,
  catalog.emission_version desc,
  catalog.generated_at desc,
  catalog.id desc;

comment on view public.report_history_entries is
  'Catálogo paginado do histórico visível: emissão anual mais recente por formulário e período institucional, e emissão bimestral mais recente por formulário, ano e bimestre. Versões anteriores permanecem nas tabelas de origem para auditoria.';

notify pgrst, 'reload schema';
