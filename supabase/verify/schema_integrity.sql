-- ============================================================================
-- Verificação de integração: invariantes estruturais de respostas e snapshots.
-- Pré: _seed_minimal.sql. Executa como dono do schema para comprovar que as
-- constraints valem inclusive fora do caminho HTTP/RLS.
--
-- Saída esperada: "SCHEMA INTEGRITY: OK".
-- ============================================================================

begin;

do $$
begin
  -- O booleano de leitura não pode contradizer a resposta canônica.
  begin
    insert into public.response_snapshots(
      id, cycle_processing_id, question_version_id, answer, is_not_applicable
    ) values (
      '00000000-0000-0000-0000-00000000a701',
      '00000000-0000-0000-0000-000000000ee1',
      '00000000-0000-0000-0000-0000000000f1',
      'not_applicable', false
    );
    raise exception 'FALHOU(response_snapshot): answer e flag divergentes foram aceitos';
  exception when check_violation then
    null;
  end;

  insert into public.response_snapshots(
    id, cycle_processing_id, question_version_id, answer, is_not_applicable
  ) values (
    '00000000-0000-0000-0000-00000000a702',
    '00000000-0000-0000-0000-000000000ee1',
    '00000000-0000-0000-0000-0000000000f1',
    'yes', false
  );

  -- Uma resposta pode reunir vários documentos comprobatórios ativos.
  insert into public.evidences(
    id, response_id, kind, storage_path, original_filename, submitted_by
  ) values (
    '00000000-0000-0000-0000-00000000a707',
    '00000000-0000-0000-0000-000000000dd1',
    'file', 'seed/cycle/evidencia-ativa-1.pdf', 'evidencia-ativa-1.pdf',
    '00000000-0000-0000-0000-0000000000a1'
  );

  insert into public.evidences(
    id, response_id, kind, storage_path, original_filename, submitted_by
  ) values (
    '00000000-0000-0000-0000-00000000a708',
    '00000000-0000-0000-0000-000000000dd1',
    'file', 'seed/cycle/evidencia-ativa-2.pdf', 'evidencia-ativa-2.pdf',
    '00000000-0000-0000-0000-0000000000a1'
  );

  if (select count(*) from public.evidences where response_id = '00000000-0000-0000-0000-000000000dd1' and deactivated_at is null) <> 2 then
    raise exception 'FALHOU(evidences): múltiplas evidências ativas não foram preservadas';
  end if;

  -- Mesmo response_snapshot, mas outra question_version: a FK composta deve
  -- impedir cruzar referências de contextos distintos.
  begin
    insert into public.evidence_snapshots(
      id, cycle_processing_id, response_snapshot_id, question_version_id,
      kind, storage_path, validation_status
    ) values (
      '00000000-0000-0000-0000-00000000a703',
      '00000000-0000-0000-0000-000000000ee1',
      '00000000-0000-0000-0000-00000000a702',
      '00000000-0000-0000-0000-0000000000f2',
      'file', 'org/cycle/evidence.pdf', 'approved'
    );
    raise exception 'FALHOU(evidence_snapshot): contexto de resposta divergente foi aceito';
  exception when foreign_key_violation then
    null;
  end;

  -- Snapshot de arquivo precisa ter storage_path; link e arquivo não coexistem.
  begin
    insert into public.evidence_snapshots(
      id, cycle_processing_id, response_snapshot_id, question_version_id,
      kind, validation_status
    ) values (
      '00000000-0000-0000-0000-00000000a704',
      '00000000-0000-0000-0000-000000000ee1',
      '00000000-0000-0000-0000-00000000a702',
      '00000000-0000-0000-0000-0000000000f1',
      'file', 'approved'
    );
    raise exception 'FALHOU(evidence_snapshot): arquivo sem storage_path foi aceito';
  exception when check_violation then
    null;
  end;

  -- Veredito inválido exige justificativa e tamanho não pode ser negativo.
  begin
    insert into public.evidence_snapshots(
      id, cycle_processing_id, response_snapshot_id, question_version_id,
      kind, storage_path, validation_status
    ) values (
      '00000000-0000-0000-0000-00000000a705',
      '00000000-0000-0000-0000-000000000ee1',
      '00000000-0000-0000-0000-00000000a702',
      '00000000-0000-0000-0000-0000000000f1',
      'file', 'org/cycle/evidence.pdf', 'invalidated'
    );
    raise exception 'FALHOU(evidence_snapshot): inválida sem justificativa foi aceita';
  exception when check_violation then
    null;
  end;

  begin
    insert into public.evidence_snapshots(
      id, cycle_processing_id, response_snapshot_id, question_version_id,
      kind, storage_path, validation_status, size_bytes
    ) values (
      '00000000-0000-0000-0000-00000000a706',
      '00000000-0000-0000-0000-000000000ee1',
      '00000000-0000-0000-0000-00000000a702',
      '00000000-0000-0000-0000-0000000000f1',
      'file', 'org/cycle/evidence.pdf', 'approved', -1
    );
    raise exception 'FALHOU(evidence_snapshot): tamanho negativo foi aceito';
  exception when check_violation then
    null;
  end;
end $$;

rollback;

do $$ begin
  raise notice 'SCHEMA INTEGRITY: OK';
end $$;
