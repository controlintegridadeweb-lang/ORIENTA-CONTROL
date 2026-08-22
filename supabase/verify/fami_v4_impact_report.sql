-- =============================================================================
-- Relatório de impacto: processamentos FAMI históricos potencialmente afetados
-- pela correção v4 (Sim com exigência de evidência sem aprovação: 1,0 → 0).
--
-- NÃO altera dados. Execute em leitura para dimensionar reprocessamento auditável.
-- =============================================================================

-- 1) Quantidade de processamentos concluídos com pelo menos um critério inflado
select count(distinct cp.id) as processamentos_potencialmente_afetados
from public.cycle_processings cp
join public.response_snapshots rs
  on rs.cycle_processing_id = cp.id
join public.question_versions qv
  on qv.id = rs.question_version_id
left join public.processing_waiver_snapshots pws
  on pws.cycle_processing_id = cp.id
 and pws.question_version_id = rs.question_version_id
where cp.status = 'completed'
  and coalesce(cp.fami_policy_version, 'v3') = 'v3'
  and rs.answer = 'yes'
  and coalesce((qv.evidence_parameter->>'required')::boolean, false) = true
  and qv.fami_enabled = true
  and qv.applies_to_respondent = true
  and pws.question_version_id is null
  and not coalesce(rs.is_not_applicable, false)
  and not exists (
    select 1
    from public.evidence_snapshots es
    where es.cycle_processing_id = cp.id
      and es.question_version_id = rs.question_version_id
      and es.validation_status = 'approved'
  );

-- 2) Detalhe por processamento: critérios inflados e delta no numerador
--    (cada critério inflado acrescentou +1,0 indevido ao numerador; possível já era 1,5)
select
  cp.id as cycle_processing_id,
  cp.cycle_id,
  cp.processing_version,
  cp.fami_policy_version,
  cp.completed_at,
  count(*)::int as criterios_inflados,
  (count(*) * 1.0)::numeric(10,2) as delta_numerador_pontos,
  fr.points_obtained as fami_global_obtidos_persistidos,
  fr.points_possible as fami_global_possiveis_persistidos,
  fr.percentage as fami_global_percentual_persistido,
  fr.maturity_level as fami_global_nivel_persistido,
  greatest(fr.points_obtained - count(*) * 1.0, 0)::numeric(10,2) as fami_global_obtidos_corrigidos_estimados,
  case
    when fr.points_possible > 0 then
      round(
        (greatest(fr.points_obtained - count(*) * 1.0, 0) / fr.points_possible) * 100,
        2
      )
    else 0
  end as fami_global_percentual_corrigido_estimado
from public.cycle_processings cp
join public.response_snapshots rs
  on rs.cycle_processing_id = cp.id
join public.question_versions qv
  on qv.id = rs.question_version_id
left join public.processing_waiver_snapshots pws
  on pws.cycle_processing_id = cp.id
 and pws.question_version_id = rs.question_version_id
left join public.fami_results fr
  on fr.cycle_processing_id = cp.id
 and fr.scope_type = 'global'
 and fr.scope_id is null
where cp.status = 'completed'
  and coalesce(cp.fami_policy_version, 'v3') = 'v3'
  and rs.answer = 'yes'
  and coalesce((qv.evidence_parameter->>'required')::boolean, false) = true
  and qv.fami_enabled = true
  and qv.applies_to_respondent = true
  and pws.question_version_id is null
  and not coalesce(rs.is_not_applicable, false)
  and not exists (
    select 1
    from public.evidence_snapshots es
    where es.cycle_processing_id = cp.id
      and es.question_version_id = rs.question_version_id
      and es.validation_status = 'approved'
  )
group by
  cp.id,
  cp.cycle_id,
  cp.processing_version,
  cp.fami_policy_version,
  cp.completed_at,
  fr.points_obtained,
  fr.points_possible,
  fr.percentage,
  fr.maturity_level
order by cp.completed_at nulls last, cp.id;
