-- Verificação: reabertura de validação preserva FAMI e cria novo processing.
-- Executar manualmente em ambiente de verificação com um ciclo validated.

-- Esperado após reopen_validation_cycle:
-- 1) cycles.state = in_validation e validated_at is null
-- 2) existe cycle_processings.status = working com versão = max+1
-- 3) processing completed anterior permanece com fami_results
-- 4) cycle_validation_reopen_events registra motivo, ator e processings

select
  c.id as cycle_id,
  c.state,
  c.validated_at,
  (
    select count(*)
    from public.cycle_processings cp
    where cp.cycle_id = c.id
      and cp.status = 'completed'
  ) as completed_processings,
  (
    select count(*)
    from public.cycle_processings cp
    where cp.cycle_id = c.id
      and cp.status = 'working'
  ) as working_processings,
  (
    select count(*)
    from public.cycle_validation_reopen_events e
    where e.cycle_id = c.id
  ) as validation_reopen_events
from public.cycles c
where c.state = 'in_validation'
  and exists (
    select 1
    from public.cycle_validation_reopen_events e
    where e.cycle_id = c.id
  );
