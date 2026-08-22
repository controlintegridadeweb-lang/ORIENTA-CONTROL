-- ============================================================================
-- Verificação de integração: uploads temporários de evidência.
--
-- Confirma que uma instalação inicial já possui o ciclo de vida temporário
-- necessário para impedir objetos de Storage sem registro de limpeza.
-- Pré: _seed_minimal.sql.
-- Saída esperada: "PENDING EVIDENCE UPLOADS: OK".
-- ============================================================================
begin;

do $$
declare
  v_id uuid := '00000000-0000-0000-0000-00000000a901';
  v_rls_enabled boolean;
  v_signature text;
begin
  insert into public.pending_evidence_uploads(
    id, cycle_id, organization_id, uploaded_by, storage_path,
    original_filename, mime_type, size_bytes, expires_at
  ) values (
    v_id,
    '00000000-0000-0000-0000-000000000cc1',
    '00000000-0000-0000-0000-0000000000b1',
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000b1/00000000-0000-0000-0000-000000000cc1/00000000-0000-0000-0000-00000000a901-evidencia.pdf',
    'evidencia.pdf', 'application/pdf', 1024, now() + interval '24 hours'
  );

  if not exists (
    select 1 from public.pending_evidence_uploads
    where id = v_id and expires_at > created_at
  ) then
    raise exception 'FALHOU(pending uploads): registro temporário não foi persistido corretamente';
  end if;

  select c.relrowsecurity into v_rls_enabled
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relname = 'pending_evidence_uploads';
  if coalesce(v_rls_enabled, false) is not true then
    raise exception 'FALHOU(pending uploads): RLS não está habilitada';
  end if;

  select pg_get_function_identity_arguments(p.oid) into v_signature
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'apply_workbench_response';
  if position('p_evidence jsonb' in coalesce(v_signature, '')) = 0
     or position('p_pending_upload_id uuid' in coalesce(v_signature, '')) > 0 then
    raise exception 'FALHOU(pending uploads): RPC não usa o contrato canônico de evidências em lote';
  end if;

  perform public.discard_pending_evidence_upload(
    v_id,
    '00000000-0000-0000-0000-000000000cc1',
    '00000000-0000-0000-0000-0000000000b1',
    '00000000-0000-0000-0000-0000000000a1'
  );
  if exists (select 1 from public.pending_evidence_uploads where id = v_id) then
    raise exception 'FALHOU(pending uploads): upload descartado permaneceu associável';
  end if;
  if not exists (
    select 1 from public.evidence_storage_cleanup_queue
    where storage_path like '%00000000-0000-0000-0000-00000000a901-evidencia.pdf'
  ) then
    raise exception 'FALHOU(pending uploads): descarte não enfileirou a limpeza física';
  end if;
end $$;

rollback;

do $$ begin
  raise notice 'PENDING EVIDENCE UPLOADS: OK';
end $$;
