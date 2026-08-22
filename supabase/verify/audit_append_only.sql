begin;

insert into public.audit_logs(event_type, entity_type, record_id, after_json)
values (
  'verify_append_only',
  'verification',
  '00000000-0000-0000-0000-00000000aa01',
  '{"status":"created"}'::jsonb
);

insert into public.library_audit_events(action, entity, item_id, extra)
values (
  'verify_append_only',
  'verification',
  '00000000-0000-0000-0000-00000000aa02',
  '{"status":"created"}'::jsonb
);

do $$
begin
  begin
    update public.audit_logs
    set event_type = 'tampered'
    where record_id = '00000000-0000-0000-0000-00000000aa01';
    raise exception 'audit_logs_update_was_accepted';
  exception when sqlstate '42501' then
    null;
  end;

  begin
    delete from public.audit_logs
    where record_id = '00000000-0000-0000-0000-00000000aa01';
    raise exception 'audit_logs_delete_was_accepted';
  exception when sqlstate '42501' then
    null;
  end;

  begin
    update public.library_audit_events
    set action = 'tampered'
    where item_id = '00000000-0000-0000-0000-00000000aa02';
    raise exception 'library_audit_events_update_was_accepted';
  exception when sqlstate '42501' then
    null;
  end;

  begin
    delete from public.library_audit_events
    where item_id = '00000000-0000-0000-0000-00000000aa02';
    raise exception 'library_audit_events_delete_was_accepted';
  exception when sqlstate '42501' then
    null;
  end;
end
$$;

select 'audit_append_only: OK';

rollback;
