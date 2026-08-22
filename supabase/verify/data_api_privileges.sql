begin;

-- A Data API autenticada é leitura escopada. Escritas de negócio pertencem ao
-- backend; apenas nome/preferências do próprio perfil possuem grant de coluna.
--
-- Relations sem SELECT para authenticated são backend-only (rate limit, read
-- models internos etc.): authenticated sem privilégios; service_role com SELECT.
do $$
declare
  v_relation record;
  v_sequence record;
begin
  for v_relation in
    select c.oid, n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'v', 'm', 'f')
  loop
    if not has_table_privilege('authenticated', v_relation.oid, 'SELECT') then
      if has_table_privilege('authenticated', v_relation.oid, 'INSERT')
         or has_table_privilege('authenticated', v_relation.oid, 'UPDATE')
         or has_table_privilege('authenticated', v_relation.oid, 'DELETE')
         or has_table_privilege('authenticated', v_relation.oid, 'TRUNCATE') then
        raise exception 'backend_only_relation_exposed_to_authenticated: %.%',
          v_relation.nspname, v_relation.relname;
      end if;
      if not has_table_privilege('service_role', v_relation.oid, 'SELECT') then
        raise exception 'backend_only_relation_missing_service_role_select: %.%',
          v_relation.nspname, v_relation.relname;
      end if;
      continue;
    end if;

    if not has_table_privilege('service_role', v_relation.oid, 'SELECT') then
      raise exception 'data_api_select_privilege_missing: relation=%.%',
        v_relation.nspname, v_relation.relname;
    end if;

    if has_table_privilege('authenticated', v_relation.oid, 'INSERT')
       or has_table_privilege('authenticated', v_relation.oid, 'UPDATE')
       or has_table_privilege('authenticated', v_relation.oid, 'DELETE')
         or has_table_privilege('authenticated', v_relation.oid, 'TRUNCATE') then
      raise exception 'authenticated_relation_must_be_read_only: %.%',
        v_relation.nspname, v_relation.relname;
    end if;

    if v_relation.relname in ('audit_logs', 'library_audit_events') then
      if not has_table_privilege('service_role', v_relation.oid, 'INSERT')
         or has_table_privilege('service_role', v_relation.oid, 'UPDATE')
         or has_table_privilege('service_role', v_relation.oid, 'DELETE')
         or has_table_privilege('service_role', v_relation.oid, 'TRUNCATE') then
        raise exception 'service_role_audit_relation_must_be_append_only: %.%',
          v_relation.nspname, v_relation.relname;
      end if;
    elsif not has_table_privilege('service_role', v_relation.oid, 'INSERT')
       or not has_table_privilege('service_role', v_relation.oid, 'UPDATE')
       or not has_table_privilege('service_role', v_relation.oid, 'DELETE') then
      raise exception 'service_role_relation_privileges_missing: %.%',
        v_relation.nspname, v_relation.relname;
    end if;
  end loop;

  if not has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
     or not has_column_privilege('authenticated', 'public.profiles', 'preferences', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'organization_id', 'UPDATE')
     or has_column_privilege('authenticated', 'public.profiles', 'user_id', 'UPDATE') then
    raise exception 'profile_column_update_privileges_are_invalid';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.apply_workbench_response(uuid,uuid,uuid,public.answer_value,text,bigint,jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.remove_workbench_evidence_item(uuid,uuid,uuid,uuid,bigint)',
       'EXECUTE'
     ) then
    raise exception 'authenticated_workbench_mutation_rpc_must_not_be_executable';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.apply_workbench_response(uuid,uuid,uuid,public.answer_value,text,bigint,jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'public.remove_workbench_evidence_item(uuid,uuid,uuid,uuid,bigint)',
       'EXECUTE'
     ) then
    raise exception 'service_role_workbench_mutation_rpc_privileges_missing';
  end if;

  if to_regprocedure('public.remove_workbench_evidence(uuid,uuid,uuid)') is not null then
    raise exception 'obsolete_remove_workbench_evidence_rpc_still_exists';
  end if;

  for v_sequence in
    select c.oid, n.nspname, c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'S'
  loop
    if has_sequence_privilege('authenticated', v_sequence.oid, 'USAGE')
       or has_sequence_privilege('authenticated', v_sequence.oid, 'SELECT') then
      raise exception 'authenticated_sequence_must_not_be_exposed: %.%',
        v_sequence.nspname, v_sequence.relname;
    end if;
    if not has_sequence_privilege('service_role', v_sequence.oid, 'USAGE')
       or not has_sequence_privilege('service_role', v_sequence.oid, 'SELECT') then
      raise exception 'service_role_sequence_privileges_missing: %.%',
        v_sequence.nspname, v_sequence.relname;
    end if;
  end loop;
end
$$;

-- Objetos futuros herdam o mesmo contrato.
create table public.__verify_data_api_default_grants (
  id bigint generated always as identity primary key
);

do $$
declare
  v_sequence regclass;
begin
  select pg_get_serial_sequence(
    'public.__verify_data_api_default_grants',
    'id'
  )::regclass into v_sequence;

  if not has_table_privilege(
    'authenticated', 'public.__verify_data_api_default_grants', 'SELECT'
  ) or has_table_privilege(
    'authenticated', 'public.__verify_data_api_default_grants', 'INSERT'
  ) or has_table_privilege(
    'authenticated', 'public.__verify_data_api_default_grants', 'UPDATE'
  ) or has_table_privilege(
    'authenticated', 'public.__verify_data_api_default_grants', 'DELETE'
  ) or has_table_privilege(
    'authenticated', 'public.__verify_data_api_default_grants', 'TRUNCATE'
  ) then
    raise exception 'authenticated_default_table_privileges_are_invalid';
  end if;

  if not has_table_privilege(
    'service_role', 'public.__verify_data_api_default_grants', 'SELECT'
  ) or not has_table_privilege(
    'service_role', 'public.__verify_data_api_default_grants', 'INSERT'
  ) or not has_table_privilege(
    'service_role', 'public.__verify_data_api_default_grants', 'UPDATE'
  ) or not has_table_privilege(
    'service_role', 'public.__verify_data_api_default_grants', 'DELETE'
  ) then
    raise exception 'service_role_default_table_privileges_are_invalid';
  end if;

  if has_sequence_privilege('authenticated', v_sequence, 'USAGE')
     or has_sequence_privilege('authenticated', v_sequence, 'SELECT')
     or not has_sequence_privilege('service_role', v_sequence, 'USAGE')
     or not has_sequence_privilege('service_role', v_sequence, 'SELECT') then
    raise exception 'default_sequence_privileges_are_invalid';
  end if;
end
$$;

select 'data_api_privileges: OK';

rollback;
