-- ============================================================================
-- Verificação de integração: respostas/evidências são leitura escopada na
-- Data API e mutação exclusiva das RPCs server-side.
--
-- A ausência de escrita direta evita que uma transação autenticada atravesse
-- o lock do envio/encerramento depois de a policy ter sido avaliada.
-- Saída esperada: "LIVE DATA BACKEND MUTATION: OK".
-- ============================================================================

do $$
declare
  v_table text;
  v_policy text;
begin
  foreach v_table in array array['responses', 'evidences'] loop
    if not has_table_privilege('authenticated', 'public.' || v_table, 'SELECT') then
      raise exception 'authenticated_must_read_%', v_table;
    end if;
    if has_table_privilege('authenticated', 'public.' || v_table, 'INSERT')
       or has_table_privilege('authenticated', 'public.' || v_table, 'UPDATE')
       or has_table_privilege('authenticated', 'public.' || v_table, 'DELETE') then
      raise exception 'authenticated_must_not_mutate_%', v_table;
    end if;
  end loop;

  foreach v_policy in array array[
    'responses_insert_editable_respondent',
    'responses_update_editable_respondent',
    'responses_delete_editable_respondent',
    'evidences_insert_editable_respondent',
    'evidences_update_editable_respondent',
    'evidences_delete_editable_respondent'
  ] loop
    if exists (
      select 1 from pg_policies
      where schemaname = 'public' and policyname = v_policy
    ) then
      raise exception 'direct_mutation_policy_must_not_exist: %', v_policy;
    end if;
  end loop;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'responses'
      and policyname = 'responses_read_scoped'
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'evidences'
      and policyname = 'evidences_read_scoped'
  ) then
    raise exception 'scoped_read_policies_are_required';
  end if;

  raise notice 'LIVE DATA BACKEND MUTATION: OK';
end $$;
