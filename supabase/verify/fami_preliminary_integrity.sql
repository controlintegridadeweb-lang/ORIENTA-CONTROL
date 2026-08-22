-- Integridade do FAMI preliminar quadrimestral.
-- Resultado esperado: todas as consultas retornam zero linhas/zero inconsistências.

-- 1. Processamento preliminar sempre aponta para FAMI oficial do mesmo ciclo.
select fp.id
from public.fami_preliminary_processings fp
join public.cycle_processings cp on cp.id = fp.source_cycle_processing_id
where cp.cycle_id <> fp.cycle_id
   or cp.status <> 'completed'::public.cycle_processing_status;

-- 2. Resultados globais preservam o mesmo ciclo do processamento preliminar.
select r.id
from public.fami_preliminary_results r
join public.fami_preliminary_processings fp on fp.id = r.preliminary_processing_id
where r.cycle_id <> fp.cycle_id;

-- 3. Memória por critério fecha aritmeticamente.
select cr.id
from public.fami_preliminary_criterion_results cr
where cr.recoverable_gap <> cr.points_possible - cr.official_points
   or cr.recovered_points > cr.recoverable_gap
   or cr.preliminary_points <> cr.official_points + cr.recovered_points
   or cr.preliminary_points > cr.points_possible;

-- 4. Snapshot de ação só pode pertencer a recomendação do processamento oficial de origem.
select s.id
from public.fami_preliminary_action_snapshots s
join public.fami_preliminary_processings fp on fp.id = s.preliminary_processing_id
join public.recommendations r on r.id = s.recommendation_id
where r.cycle_processing_id <> fp.source_cycle_processing_id;

-- 4b. A ação referenciada precisa continuar vinculada à mesma recomendação do snapshot.
select s.id
from public.fami_preliminary_action_snapshots s
join public.action_plans ap on ap.id = s.action_plan_id
where ap.recommendation_id <> s.recommendation_id;

-- 5. Um checkpoint precisa de exatamente um resultado global.
select fp.id, count(r.id) as global_count
from public.fami_preliminary_processings fp
left join public.fami_preliminary_results r
  on r.preliminary_processing_id = fp.id
 and r.scope_type = 'global'
 and r.scope_id is null
group by fp.id
having count(r.id) <> 1;


-- 6. Baseline reconstruída por critério precisa fechar com o Resultado FAMI oficial congelado.
select fp.id
from public.fami_preliminary_processings fp
join public.fami_results fr
  on fr.cycle_processing_id = fp.source_cycle_processing_id
 and fr.scope_type = 'global'
 and fr.scope_id is null
join lateral (
  select
    coalesce(sum(cr.official_points), 0) as obtained,
    coalesce(sum(cr.points_possible), 0) as possible
  from public.fami_preliminary_criterion_results cr
  where cr.preliminary_processing_id = fp.id
) reconstructed on true
where abs(reconstructed.obtained - fr.points_obtained) > 0.01
   or abs(reconstructed.possible - fr.points_possible) > 0.01;


-- 7. Metadados duplicados da fonte oficial precisam permanecer idênticos ao processamento.
select fp.id
from public.fami_preliminary_processings fp
join public.cycle_processings cp on cp.id = fp.source_cycle_processing_id
where fp.source_processing_version <> cp.processing_version
   or fp.source_policy_version <> cp.fami_policy_version;

-- 8. Recomendação do critério precisa pertencer ao mesmo processamento e pergunta.
select cr.id
from public.fami_preliminary_criterion_results cr
join public.fami_preliminary_processings fp on fp.id = cr.preliminary_processing_id
join public.recommendations r on r.id = cr.recommendation_id
where cr.recommendation_id is not null
  and (r.cycle_processing_id <> fp.source_cycle_processing_id
       or r.question_version_id <> cr.question_version_id);

-- 9. Exceção congelada precisa pertencer à própria recomendação do critério.
select cr.id
from public.fami_preliminary_criterion_results cr
join public.recommendation_exceptions ex on ex.id = cr.approved_exception_id
where cr.approved_exception_id is not null
  and ex.recommendation_id <> cr.recommendation_id;

-- 10. Um único snapshot consolidado por ciclo/ano/quadrimestre.
select fp.cycle_id, fp.reference_year, fp.quadrimester, count(*) as closed_count
from public.fami_preliminary_processings fp
where fp.closed_at is not null
group by fp.cycle_id, fp.reference_year, fp.quadrimester
having count(*) <> 1;

-- 11. Fechamento automático precisa de closed_at; prévia manual não pode tê-lo.
select fp.id
from public.fami_preliminary_processings fp
where (fp.calculation_kind = 'automatic' and fp.closed_at is null)
   or (fp.calculation_kind = 'manual' and fp.closed_at is not null)
   or (fp.calculation_kind = 'manual' and fp.calculated_by is null);

