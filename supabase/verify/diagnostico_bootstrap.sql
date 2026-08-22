-- ============================================================================
-- Verifica a carga idempotente e integral do Diagnóstico de Integridade 2026.
-- O administrador global fixo é criado por _seed_minimal.sql.
-- ============================================================================

-- A RPC é idempotente ENTRE invocações (cada uma em sua própria transação),
-- como roda em produção via supabase.rpc. As duas chamadas abaixo são statements
-- separados (psql em autocommit), garantindo que as temp tables ON COMMIT DROP
-- internas da função sejam liberadas entre as execuções. Uma temp table de sessão
-- (ON COMMIT PRESERVE ROWS por padrão) guarda os retornos para as asserções.
create temporary table diagnostico_bootstrap_probe (step text primary key, result jsonb);

insert into diagnostico_bootstrap_probe (step, result)
values (
  'first',
  public.bootstrap_diagnostico_integridade_2026('00000000-0000-0000-0000-0000000000a1'::uuid)
);

insert into diagnostico_bootstrap_probe (step, result)
values (
  'second',
  public.bootstrap_diagnostico_integridade_2026('00000000-0000-0000-0000-0000000000a1'::uuid)
);

do $$
declare
  v_first jsonb;
  v_second jsonb;
  v_form_id uuid;
  v_question_count integer;
  v_section_count integer;
  v_orders integer[];
begin
  select result into v_first from diagnostico_bootstrap_probe where step = 'first';
  select result into v_second from diagnostico_bootstrap_probe where step = 'second';

  if (v_first ->> 'questionCount')::integer <> 126
     or (v_second ->> 'questionCount')::integer <> 126 then
    raise exception 'diagnostico_bootstrap_question_count_invalid: %, %',
      v_first ->> 'questionCount', v_second ->> 'questionCount';
  end if;

  select id into v_form_id
  from public.forms
  where name = 'Diagnóstico de Integridade 2026';

  if v_form_id is null then
    raise exception 'diagnostico_bootstrap_form_not_created';
  end if;

  select count(*) into v_question_count
  from public.form_draft_questions draft_question
  join public.form_drafts draft on draft.id = draft_question.form_draft_id
  where draft.form_id = v_form_id;

  if v_question_count <> 126 then
    raise exception 'diagnostico_bootstrap_draft_question_count_invalid: %', v_question_count;
  end if;

  select count(*) into v_section_count
  from public.sections
  where code like 'DI2026-%';

  if v_section_count <> 22 then
    raise exception 'diagnostico_bootstrap_section_count_invalid: %', v_section_count;
  end if;

  select array_agg(draft_question.order_index order by draft_question.order_index)
    into v_orders
  from public.form_draft_questions draft_question
  join public.form_drafts draft on draft.id = draft_question.form_draft_id
  where draft.form_id = v_form_id;

  if v_orders <> array(select generate_series(0, 125)) then
    raise exception 'diagnostico_bootstrap_order_sequence_invalid';
  end if;

  if not exists (
    select 1
    from public.form_draft_questions draft_question
    join public.form_drafts draft
      on draft.id = draft_question.form_draft_id
    join public.questions question_row
      on question_row.id = draft_question.question_id
    join public.sections section_row
      on section_row.id = question_row.section_id
    where draft.form_id = v_form_id
      and section_row.code = 'DI2026-GOV-01'
      and draft_question.order_index = 3
      and question_row.prompt =
        'As informações relativas ao Comitê Interno de Integridade e Compliance – CIC (composição/membros e canais de contato institucional) estão devidamente divulgadas no sítio eletrônico oficial do órgão ou entidade ou em outros meios institucionais?'
  ) then
    raise exception 'diagnostico_bootstrap_cic_disclosure_prompt_invalid';
  end if;
end;
$$;

drop table if exists diagnostico_bootstrap_probe;

select 'diagnostico_bootstrap: OK' as result;
