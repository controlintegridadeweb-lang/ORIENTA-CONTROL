-- Exercício 2026: não gera relatório de monitoramento nem FAMI preliminar.
-- Registros já emitidos permanecem. O resultado oficial continua no fechamento do diagnóstico.

create or replace function public.reject_interim_monitoring_for_excluded_exercise()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reference_year = 2026 then
    raise exception 'interim_monitoring_excluded_for_exercise'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists action_plan_bimonthly_reports_reject_excluded_exercise
  on public.action_plan_bimonthly_reports;
create trigger action_plan_bimonthly_reports_reject_excluded_exercise
  before insert on public.action_plan_bimonthly_reports
  for each row
  execute function public.reject_interim_monitoring_for_excluded_exercise();

drop trigger if exists fami_preliminary_processings_reject_excluded_exercise
  on public.fami_preliminary_processings;
create trigger fami_preliminary_processings_reject_excluded_exercise
  before insert on public.fami_preliminary_processings
  for each row
  execute function public.reject_interim_monitoring_for_excluded_exercise();

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
        and p.year <> 2026
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
            if sqlerrm like '%interim_monitoring_excluded_for_exercise%' then
              null;
            else
              v_errors := v_errors || jsonb_build_array(
                jsonb_build_object(
                  'cycleId', v_candidate.cycle_id,
                  'referenceYear', v_candidate.reference_year,
                  'bimester', v_candidate.bimester,
                  'quadrimester', v_quadrimester,
                  'error', sqlerrm
                )
              );
            end if;
        end;
      end if;
    exception
      when unique_violation then
        v_skipped := v_skipped + 1;
      when others then
        if sqlerrm like '%bimonthly_source_fami_not_available_for_period%'
           or sqlerrm like '%bimonthly_period_already_closed%'
           or sqlerrm like '%bimonthly_period_not_closed%'
           or sqlerrm like '%bimonthly_period_not_started%'
           or sqlerrm like '%interim_monitoring_excluded_for_exercise%' then
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
        and p.year <> 2026
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
           or sqlerrm like '%preliminary_period_not_started%'
           or sqlerrm like '%interim_monitoring_excluded_for_exercise%' then
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

comment on function public.close_due_action_plan_bimesters() is
  'Fecha bimestres vencidos, exceto 2026, e nos bimestres 2, 4 e 6 dispara o quadrimestre correspondente.';
comment on function public.close_due_fami_preliminary_quadrimesters() is
  'Fecha quadrimestres vencidos ainda não consolidados, exceto 2026. Idempotente e resiliente a falha parcial.';
comment on function public.reject_interim_monitoring_for_excluded_exercise() is
  'Impede nova emissão de monitoramento ou FAMI preliminar no exercício 2026. Não apaga registros já existentes.';

notify pgrst, 'reload schema';
