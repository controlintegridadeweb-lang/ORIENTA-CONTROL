-- ============================================================================
-- Verificação de integração: evidências no Storage são privadas ao backend.
--
-- Uploads precisam nascer em tabelas temporárias backend-only e ser associados
-- por RPC atômica. Downloads usam URL assinada curta emitida pela API.
--
-- No stack Supabase real, `authenticated` pode manter GRANT de tabela em
-- storage.objects (bootstrap da plataforma). A barreira efetiva é RLS sem
-- policies permissivas + buckets privados: a Data API do Storage não entrega
-- linhas nem aceita mutação direta do cliente.
-- Saída esperada: "STORAGE BACKEND ONLY: OK".
-- ============================================================================

begin;

do $$
begin
  if not exists (
    select 1
    from pg_class
    where oid = 'storage.objects'::regclass
      and relrowsecurity
  ) then
    raise exception 'storage_objects_rls_must_be_enabled';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        policyname like 'evidencias_%'
        or policyname like 'planos_acao_%'
        or policyname like 'relatorios_%'
      )
  ) then
    raise exception 'storage_evidence_authenticated_policy_must_not_exist';
  end if;

  if not exists (
    select 1
    from storage.buckets b
    where b.id in ('evidencias', 'planos-acao', 'relatorios')
      and b.public = false
    group by b.public
    having count(*) = 3
  ) then
    raise exception 'application_storage_buckets_must_be_private';
  end if;

  if not exists (
    select 1
    from pg_class
    where oid = 'public.pending_action_plan_document_uploads'::regclass
      and relrowsecurity
  ) then
    raise exception 'pending_action_plan_document_uploads_rls_must_be_enabled';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'pending_action_plan_document_uploads'
  ) then
    raise exception 'pending_action_plan_document_uploads_must_be_backend_only';
  end if;

  if not exists (
    select 1
    from pg_class
    where oid = 'public.action_plan_storage_cleanup_queue'::regclass
      and relrowsecurity
  ) then
    raise exception 'action_plan_storage_cleanup_queue_rls_must_be_enabled';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'action_plan_storage_cleanup_queue'
  ) then
    raise exception 'action_plan_storage_cleanup_queue_must_be_backend_only';
  end if;
end $$;

-- Prova comportamental: mesmo com GRANT de plataforma, authenticated não
-- consegue mutar storage.objects (RLS sem policy ou privilege revoke).
set local role authenticated;
do $$
begin
  begin
    insert into storage.objects (bucket_id, name)
    values ('evidencias', 'verify/forbidden-probe.pdf');
    raise exception 'storage_authenticated_mutation_must_be_denied';
  exception
    when insufficient_privilege then
      null;
    when others then
      if sqlerrm not ilike '%row-level security%'
         and sqlerrm not ilike '%violates row-level security%' then
        raise;
      end if;
  end;
end $$;
reset role;

do $$
begin
  raise notice 'STORAGE BACKEND ONLY: OK';
end $$;

rollback;
