-- ORIENTA greenfield baseline — Buckets privados, Realtime e configuração de Storage
-- Gerada a partir do estado final pré-cutover; não contém dados históricos reais.

insert into storage.buckets (id, name, public, file_size_limit) values ('evidencias', 'evidencias', false, 20971520) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

insert into storage.buckets (id, name, public, file_size_limit) values ('planos-acao', 'planos-acao', false, 20971520) on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit;

insert into storage.buckets (id, name, public) values ('relatorios', 'relatorios', false) on conflict (id) do update set public = excluded.public;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'responses'
     ) then
    alter publication supabase_realtime add table public.responses;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'action_plans'
     ) then
    alter publication supabase_realtime add table public.action_plans;
  end if;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'action_plan_documents'
     ) then
    alter publication supabase_realtime add table public.action_plan_documents;
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_class
    where oid = 'storage.objects'::regclass
      and relrowsecurity
  ) then
    alter table storage.objects enable row level security;
  end if;
end
$$;
