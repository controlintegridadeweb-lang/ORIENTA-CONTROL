-- ORIENTA greenfield baseline — contratos estruturais finais
-- Não depende de dados históricos. Valida somente o estado estrutural que a baseline deve criar.

do $$
declare
  v_public_tables integer;
  v_public_functions integer;
  v_private_functions integer;
  v_public_views integer;
  v_orienta_triggers integer;
  v_public_policies integer;
  v_tables_without_rls integer;
  v_axes integer;
  v_buckets integer;
  v_bad_views integer;
begin
  select count(*) into v_public_tables
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';
  if v_public_tables <> 56 then
    raise exception 'baseline_contract: esperado 56 tabelas public, encontrado %', v_public_tables;
  end if;

  select count(*) into v_public_functions
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public';
  select count(*) into v_private_functions
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'app_private';
  if v_public_functions <> 177 or v_private_functions <> 8 then
    raise exception 'baseline_contract: funções esperadas public=177/app_private=8, encontradas public=%/app_private=%',
      v_public_functions, v_private_functions;
  end if;

  if to_regprocedure('public.bootstrap_diagnostico_integridade_2026(uuid)') is not null then
    raise exception 'baseline_contract: bootstrap de dados não pode existir na baseline de produção';
  end if;

  if to_regprocedure('app_private.is_admin()') is null
     or to_regprocedure('app_private.is_respondent()') is null
     or to_regprocedure('app_private.current_organization_id()') is null
     or to_regprocedure('public.materialize_fami_preliminary(uuid,integer,smallint,uuid)') is null
     or to_regprocedure('public.save_respondent_action_plan(uuid,uuid,uuid,uuid,text,date,date,text,uuid,integer,boolean,bigint,text,text)') is null then
    raise exception 'baseline_contract: função canônica obrigatória ausente';
  end if;

  select count(*) into v_public_views
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v';
  if v_public_views <> 6 then
    raise exception 'baseline_contract: esperado 6 views public, encontrado %', v_public_views;
  end if;

  select count(*) into v_bad_views
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'v'
    and not ('security_invoker=true' = any(coalesce(c.reloptions, array[]::text[])));
  if v_bad_views <> 0 then
    raise exception 'baseline_contract: % view(s) public sem security_invoker=true', v_bad_views;
  end if;

  select count(*) into v_orienta_triggers
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where not t.tgisinternal
    and (n.nspname = 'public' or (n.nspname = 'storage' and t.tgname = 'official_report_storage_object_immutable'));
  if v_orienta_triggers <> 89 then
    raise exception 'baseline_contract: esperado 89 triggers ORIENTA, encontrado %', v_orienta_triggers;
  end if;

  select count(*) into v_public_policies from pg_policies where schemaname = 'public';
  if v_public_policies <> 71 then
    raise exception 'baseline_contract: esperado 71 policies public, encontrado %', v_public_policies;
  end if;

  select count(*) into v_tables_without_rls
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if v_tables_without_rls <> 0 then
    raise exception 'baseline_contract: % tabela(s) public sem RLS', v_tables_without_rls;
  end if;

  select count(*) into v_axes from public.axes;
  if v_axes not in (0, 3) then
    raise exception 'baseline_contract: catálogo de eixos deve estar vazio (greenfield) ou completo (3), encontrado %', v_axes;
  end if;
  if v_axes = 3 and exists (
    select 1 from (values ('Governanca'), ('Ambiental'), ('Social')) expected(name)
    where not exists (select 1 from public.axes a where a.name = expected.name)
  ) then
    raise exception 'baseline_contract: catálogo ESG de eixos está incompleto/divergente';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='fami_results' and column_name='points_obtained'
  ) or not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='fami_results' and column_name='points_possible'
  ) then
    raise exception 'baseline_contract: contrato FAMI oficial inválido';
  end if;

  if (select count(*) from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'fami_preliminary_processings',
          'fami_preliminary_action_snapshots',
          'fami_preliminary_criterion_results',
          'fami_preliminary_results'
        )) <> 4 then
    raise exception 'baseline_contract: domínio FAMI preliminar incompleto';
  end if;

  select count(*) into v_buckets
  from storage.buckets
  where id in ('evidencias','planos-acao','relatorios') and public = false;
  if v_buckets <> 3 then
    raise exception 'baseline_contract: esperados 3 buckets privados canônicos, encontrado %', v_buckets;
  end if;

  if exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','app_private')
      and not exists (
        select 1 from unnest(coalesce(p.proconfig,array[]::text[])) cfg
        where cfg like 'search_path=%'
      )
  ) then
    raise exception 'baseline_contract: há função da aplicação sem search_path explícito';
  end if;
end;
$$;

notify pgrst, 'reload schema';
