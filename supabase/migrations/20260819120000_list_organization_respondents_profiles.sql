-- A lista de responsáveis do plano parte do perfil respondente do órgão.
-- INNER JOIN em auth.users descartava o membro quando o RLS de GoTrue
-- ocultava a linha (postgres local sem bypassrls). O e-mail continua
-- opcional; a identidade operacional é public.profiles.

create or replace function public.list_organization_respondents(
  p_organization_id uuid
)
returns table (
  user_id uuid,
  email text,
  full_name text
)
language plpgsql
security definer
set search_path = public, auth
stable
as $$
begin
  -- O dono de `profiles` (sem BYPASSRLS) só ignora RLS com row_security=off.
  -- Sem isso o Postgres local do Supabase devolve lista vazia para o mesmo
  -- órgão que acabou de persistir o respondente.
  perform set_config('row_security', 'off', true);

  return query
  select
    p.user_id,
    au.email::text,
    p.full_name
  from public.profiles p
  left join auth.users au on au.id = p.user_id
  where p.organization_id = p_organization_id
    and p.role = 'respondent'::public.app_user_role
  order by
    coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(au.email), ''), p.user_id::text),
    p.user_id;
end;
$$;

comment on function public.list_organization_respondents(uuid) is
  'Lista identidades respondentes do órgão para atribuição de responsabilidade no plano de ação. O e-mail vem de auth.users quando visível; a existência do membro não depende desse join.';

-- Sem FORCE RLS, o dono de `profiles` enxerga as linhas. No Postgres local do
-- Supabase o papel `postgres` da URL não tem BYPASSRLS; se a função permanecer
-- com esse dono, a lista institucional volta vazia mesmo com LEFT JOIN.
do $$
declare
  profile_owner text;
begin
  select pg_get_userbyid(c.relowner)
    into profile_owner
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'profiles';

  execute format(
    'alter function public.list_organization_respondents(uuid) owner to %I',
    profile_owner
  );
end $$;

revoke all on function public.list_organization_respondents(uuid) from public;
grant execute on function public.list_organization_respondents(uuid) to service_role;
