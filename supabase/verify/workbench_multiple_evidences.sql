-- Verifica inclusão atômica de múltiplas evidências, consumo dos uploads
-- temporários e remoção individual. Pré-requisito: _seed_minimal.sql.

begin;

insert into public.cycles(
  id, form_version_id, organization_id, period_id, period_label, state
) values (
  '00000000-0000-0000-0000-000000000cc2',
  '00000000-0000-0000-0000-000000000bb1',
  '00000000-0000-0000-0000-0000000000b1',
  (public.ensure_form_period(
    '00000000-0000-0000-0000-000000000bb1',
    '2026-multiplas-evidencias',
    '2026-multiplas-evidencias'
  )).id,
  '2026-multiplas-evidencias',
  'in_response'
);

insert into public.pending_evidence_uploads(
  id, cycle_id, organization_id, uploaded_by, storage_path,
  original_filename, mime_type, verified_mime_type, verified_at, size_bytes
) values
  (
    '00000000-0000-0000-0000-000000000a11',
    '00000000-0000-0000-0000-000000000cc2',
    '00000000-0000-0000-0000-0000000000b1',
    '00000000-0000-0000-0000-0000000000a1',
    'seed/multiple/evidencia-1.pdf',
    'evidencia-1.pdf',
    'application/pdf',
    'application/pdf',
    now(),
    100
  ),
  (
    '00000000-0000-0000-0000-000000000a12',
    '00000000-0000-0000-0000-000000000cc2',
    '00000000-0000-0000-0000-0000000000b1',
    '00000000-0000-0000-0000-0000000000a1',
    'seed/multiple/evidencia-2.pdf',
    'evidencia-2.pdf',
    'application/pdf',
    'application/pdf',
    now(),
    200
  );

select public.apply_workbench_response(
  '00000000-0000-0000-0000-000000000cc2',
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-0000000000f1',
  'yes',
  'Resposta com dois documentos',
  null,
  jsonb_build_array(
    jsonb_build_object(
      'kind', 'file',
      'title', 'Documento 1',
      'storage_path', 'seed/multiple/evidencia-1.pdf',
      'pending_upload_id', '00000000-0000-0000-0000-000000000a11'
    ),
    jsonb_build_object(
      'kind', 'file',
      'title', 'Documento 2',
      'storage_path', 'seed/multiple/evidencia-2.pdf',
      'pending_upload_id', '00000000-0000-0000-0000-000000000a12'
    )
  )
);

do $$
declare
  v_response_id uuid;
  v_response_revision bigint;
  v_first_evidence_id uuid;
  v_second_evidence_id uuid;
begin
  select id, revision into strict v_response_id, v_response_revision
  from public.responses
  where cycle_id = '00000000-0000-0000-0000-000000000cc2'
    and question_version_id = '00000000-0000-0000-0000-0000000000f1';

  if (
    select count(*)
    from public.evidences
    where response_id = v_response_id and deactivated_at is null
  ) <> 2 then
    raise exception 'multiple_evidences_were_not_persisted';
  end if;

  if exists (
    select 1
    from public.pending_evidence_uploads
    where id in (
      '00000000-0000-0000-0000-000000000a11',
      '00000000-0000-0000-0000-000000000a12'
    )
  ) then
    raise exception 'pending_uploads_were_not_consumed';
  end if;

  select id into strict v_first_evidence_id
  from public.evidences
  where response_id = v_response_id
    and storage_path = 'seed/multiple/evidencia-1.pdf';

  perform public.remove_workbench_evidence_item(
    '00000000-0000-0000-0000-000000000cc2',
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-0000000000f1',
    v_first_evidence_id,
    v_response_revision
  );

  if exists (select 1 from public.evidences where id = v_first_evidence_id) then
    raise exception 'selected_evidence_was_not_removed';
  end if;

  if (
    select count(*)
    from public.evidences
    where response_id = v_response_id and deactivated_at is null
  ) <> 1 then
    raise exception 'unselected_evidence_was_modified';
  end if;

  select id into strict v_second_evidence_id
  from public.evidences
  where response_id = v_response_id
    and deactivated_at is null;

  begin
    perform public.remove_workbench_evidence_item(
      '00000000-0000-0000-0000-000000000cc2',
      '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-0000000000f1',
      v_second_evidence_id,
      v_response_revision
    );
    raise exception 'stale_response_revision_was_accepted';
  exception when sqlstate '40001' then
    null;
  end;

  if not exists (
    select 1 from public.evidences
    where id = v_second_evidence_id and deactivated_at is null
  ) then
    raise exception 'stale_revision_modified_evidence';
  end if;
end
$$;

-- O mesmo upload não pode ser consumido duas vezes no lote. A validação ocorre
-- antes da resposta e preserva o upload quando o lote é rejeitado.
insert into public.pending_evidence_uploads(
  id, cycle_id, organization_id, uploaded_by, storage_path,
  original_filename, verified_mime_type, verified_at, size_bytes
) values (
  '00000000-0000-0000-0000-000000000a13',
  '00000000-0000-0000-0000-000000000cc2',
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000a1',
  'seed/multiple/evidencia-duplicada.pdf',
  'evidencia-duplicada.pdf',
  'application/pdf',
  now(),
  300
);

do $$
declare
  v_response_revision bigint;
begin
  select revision into strict v_response_revision
  from public.responses
  where cycle_id = '00000000-0000-0000-0000-000000000cc2'
    and question_version_id = '00000000-0000-0000-0000-0000000000f1';

  begin
    perform public.apply_workbench_response(
      '00000000-0000-0000-0000-000000000cc2',
      '00000000-0000-0000-0000-0000000000a1',
      '00000000-0000-0000-0000-0000000000f1',
      'yes',
      'Este texto não pode ser persistido',
      v_response_revision,
      jsonb_build_array(
        jsonb_build_object(
          'kind', 'file',
          'storage_path', 'seed/multiple/evidencia-duplicada.pdf',
          'pending_upload_id', '00000000-0000-0000-0000-000000000a13'
        ),
        jsonb_build_object(
          'kind', 'file',
          'storage_path', 'seed/multiple/evidencia-duplicada.pdf',
          'pending_upload_id', '00000000-0000-0000-0000-000000000a13'
        )
      )
    );
    raise exception 'duplicate_pending_upload_was_accepted';
  exception
    when sqlstate 'P0001' then
      if sqlerrm <> 'duplicate_pending_upload_id' then
        raise;
      end if;
  end;

  if not exists (
    select 1 from public.pending_evidence_uploads
    where id = '00000000-0000-0000-0000-000000000a13'
  ) then
    raise exception 'rejected_batch_consumed_pending_upload';
  end if;

  if exists (
    select 1 from public.responses
    where cycle_id = '00000000-0000-0000-0000-000000000cc2'
      and notes = 'Este texto não pode ser persistido'
  ) then
    raise exception 'rejected_batch_modified_response';
  end if;
end
$$;

select 'workbench_multiple_evidences: OK';

rollback;
