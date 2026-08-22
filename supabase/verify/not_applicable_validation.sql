-- ============================================================================
-- Verificação de integração: justificativa e validação de “Não se aplica”.
--
-- Prova, no PostgreSQL real, que:
--   • justificativa curta é rejeitada pelo trigger canônico;
--   • gravação e edição pelo workbench persistem a justificativa e voltam o
--     veredito para pending;
--   • a consolidação é bloqueada enquanto existir N/A pendente;
--   • aprovação mantém N/A;
--   • rejeição exige motivo, converte a resposta para “Não” e preserva o N/A;
--   • o parecer pode ser revisado antes da consolidação.
-- Pré: _seed_minimal.sql.
-- Saída esperada: "NOT APPLICABLE VALIDATION: OK".
-- ============================================================================

begin;

-- O workbench só grava em estados editáveis. O seed é reposicionado apenas
-- como fixture; a RPC exercitada abaixo continua sujeita às guardas reais.
set session_replication_role = replica;
update public.cycles
set state = 'in_response'
where id = '00000000-0000-0000-0000-000000000cc1';
set session_replication_role = default;

do $$
declare
  v_answer public.answer_value;
  v_status public.na_validation_status;
  v_justification text;
  v_reason text;
  v_revision bigint;
begin
  begin
    perform public.apply_workbench_response(
      '00000000-0000-0000-0000-000000000cc1',
      '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-0000000000f1',
      'not_applicable'::public.answer_value,
      'justificativa curta',
      null,
      null
    );
    raise exception 'FALHOU(justificativa): aceitou texto com menos de 20 caracteres';
  exception when sqlstate '22023' then
    null;
  end;

  perform public.apply_workbench_response(
    '00000000-0000-0000-0000-000000000cc1',
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000f1',
    'not_applicable'::public.answer_value,
    'Esta justificativa válida possui mais de vinte caracteres.',
    null,
    null
  );

  select answer, na_validation_status, na_justification
    into v_answer, v_status, v_justification
  from public.responses
  where id = '00000000-0000-0000-0000-000000000dd1';

  if v_answer <> 'not_applicable' or v_status <> 'pending' then
    raise exception 'FALHOU(gravação): answer=%, status=%', v_answer, v_status;
  end if;
  if v_justification <> 'Esta justificativa válida possui mais de vinte caracteres.' then
    raise exception 'FALHOU(gravação): justificativa não persistida: %', v_justification;
  end if;

  set session_replication_role = replica;
  update public.cycles
  set state = 'in_validation'
  where id = '00000000-0000-0000-0000-000000000cc1';
  set session_replication_role = default;

  begin
    perform public.finalize_validation_cycle(
      '00000000-0000-0000-0000-000000000cc1',
      '00000000-0000-0000-0000-0000000000a1'
    );
    raise exception 'FALHOU(consolidação): aceitou N/A pendente';
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'validation_unresolved_na:%' then
      raise;
    end if;
  end;

  begin
    perform public.validate_not_applicable_response(
      '00000000-0000-0000-0000-000000000dd1',
      '00000000-0000-0000-0000-000000000999',
      'approve',
      '00000000-0000-0000-0000-0000000000a1',
      null
    );
    raise exception 'FALHOU(escopo N/A): aceitou resposta de outro diagnóstico';
  exception when sqlstate '23514' then
    null;
  end;

  perform public.validate_not_applicable_response(
    '00000000-0000-0000-0000-000000000dd1',
    '00000000-0000-0000-0000-000000000cc1',
    'approve',
    '00000000-0000-0000-0000-0000000000a1',
    null
  );

  select answer, na_validation_status
    into v_answer, v_status
  from public.responses
  where id = '00000000-0000-0000-0000-000000000dd1';

  if v_answer <> 'not_applicable' or v_status <> 'approved' then
    raise exception 'FALHOU(aprovação): answer=%, status=%', v_answer, v_status;
  end if;

  -- Reabre somente a fixture para provar que uma edição posterior da
  -- justificativa substitui o valor canônico e reinicia a validação.
  set session_replication_role = replica;
  update public.cycles
  set state = 'in_response'
  where id = '00000000-0000-0000-0000-000000000cc1';
  set session_replication_role = default;

  select revision into strict v_revision
  from public.responses
  where id = '00000000-0000-0000-0000-000000000dd1';

  perform public.apply_workbench_response(
    '00000000-0000-0000-0000-000000000cc1',
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000f1',
    'not_applicable'::public.answer_value,
    'Justificativa revisada e novamente submetida para avaliação.',
    v_revision,
    null
  );

  select na_validation_status, na_justification
    into v_status, v_justification
  from public.responses
  where id = '00000000-0000-0000-0000-000000000dd1';

  if v_status <> 'pending' then
    raise exception 'FALHOU(edição): status não voltou para pending: %', v_status;
  end if;
  if v_justification <> 'Justificativa revisada e novamente submetida para avaliação.' then
    raise exception 'FALHOU(edição): justificativa antiga permaneceu: %', v_justification;
  end if;

  set session_replication_role = replica;
  update public.cycles
  set state = 'in_validation'
  where id = '00000000-0000-0000-0000-000000000cc1';
  set session_replication_role = default;

  begin
    perform public.validate_not_applicable_response(
      '00000000-0000-0000-0000-000000000dd1',
      '00000000-0000-0000-0000-000000000cc1',
      'reject',
      '00000000-0000-0000-0000-0000000000a1',
      null
    );
    raise exception 'FALHOU(motivo): rejeitou N/A sem justificativa';
  exception when sqlstate '22023' then
    if sqlerrm <> 'na_rejection_reason_required' then
      raise;
    end if;
  end;

  perform public.validate_not_applicable_response(
    '00000000-0000-0000-0000-000000000dd1',
    '00000000-0000-0000-0000-000000000cc1',
    'reject',
    '00000000-0000-0000-0000-0000000000a1',
    'O critério é aplicável à organização.'
  );

  select answer, na_validation_status, na_justification, na_rejection_reason
    into v_answer, v_status, v_justification, v_reason
  from public.responses
  where id = '00000000-0000-0000-0000-000000000dd1';

  if v_answer <> 'no' or v_status <> 'rejected' or v_justification is null then
    raise exception 'FALHOU(rejeição): answer=%, status=%, justificativa=%',
      v_answer, v_status, v_justification;
  end if;
  if v_reason <> 'O critério é aplicável à organização.' then
    raise exception 'FALHOU(rejeição): motivo não preservado: %', v_reason;
  end if;

  begin
    perform public.validate_not_applicable_response(
      '00000000-0000-0000-0000-000000000dd1',
      '00000000-0000-0000-0000-000000000cc1',
      'approve',
      '00000000-0000-0000-0000-0000000000a1',
      null,
      'pending',
      null
    );
    raise exception 'FALHOU(concorrência N/A): parecer antigo sobrescreveu decisão atual';
  exception when sqlstate '40001' then
    null;
  end;

  perform public.validate_not_applicable_response(
    '00000000-0000-0000-0000-000000000dd1',
    '00000000-0000-0000-0000-000000000cc1',
    'reject',
    '00000000-0000-0000-0000-0000000000a1',
    'Motivo administrativo corrigido.'
  );

  select na_rejection_reason into v_reason
  from public.responses
  where id = '00000000-0000-0000-0000-000000000dd1';

  if v_reason <> 'Motivo administrativo corrigido.' then
    raise exception 'FALHOU(edição do motivo): %', v_reason;
  end if;

  perform public.validate_not_applicable_response(
    '00000000-0000-0000-0000-000000000dd1',
    '00000000-0000-0000-0000-000000000cc1',
    'approve',
    '00000000-0000-0000-0000-0000000000a1',
    null
  );

  select answer, na_validation_status, na_justification, na_rejection_reason
    into v_answer, v_status, v_justification, v_reason
  from public.responses
  where id = '00000000-0000-0000-0000-000000000dd1';

  if v_answer <> 'not_applicable' or v_status <> 'approved' then
    raise exception 'FALHOU(revisão): answer=%, status=%', v_answer, v_status;
  end if;
  if v_justification is null or v_reason is not null then
    raise exception 'FALHOU(revisão): justificativa=%, motivo=%',
      v_justification, v_reason;
  end if;
end $$;

rollback;

do $$ begin
  raise notice 'NOT APPLICABLE VALIDATION: OK';
end $$;
