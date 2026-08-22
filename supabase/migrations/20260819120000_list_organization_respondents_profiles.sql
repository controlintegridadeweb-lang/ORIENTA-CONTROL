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
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    p.user_id,
    au.email,
    p.full_name
  from public.profiles p
  left join auth.users au on au.id = p.user_id
  where p.organization_id = p_organization_id
    and p.role = 'respondent'::public.app_user_role
  order by
    coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(au.email), ''), p.user_id::text),
    p.user_id;
$$;

comment on function public.list_organization_respondents(uuid) is
  'Lista identidades respondentes do órgão para atribuição de responsabilidade no plano de ação. O e-mail vem de auth.users quando visível; a existência do membro não depende desse join.';
