-- ============================================================================
-- Verificação de integração: identidade de perfil não pode ser alterada de
-- forma silenciosa ou por update direto. A única via aceita é a RPC
-- administrativa auditável `update_respondent_profile`.
-- Pré: _seed_minimal.sql.
-- Saída esperada: "PROFILE IDENTITY: OK".
-- ============================================================================

begin;

insert into auth.users(id, email)
values ('00000000-0000-0000-0000-0000000000a4', 'respondent-profile@orienta.test')
on conflict do nothing;

insert into public.organizations(id, name, acronym)
values ('00000000-0000-0000-0000-0000000000b2', 'Org Perfil', 'PERFIL')
on conflict do nothing;

insert into public.profiles(user_id, role, organization_id, full_name)
values (
  '00000000-0000-0000-0000-0000000000a4',
  'respondent',
  '00000000-0000-0000-0000-0000000000b1',
  'Respondente Perfil'
)
on conflict (user_id) do nothing;

do $$
begin
  -- Não há restauração silenciosa: tentativa direta deve falhar de forma clara.
  begin
    update public.profiles
       set organization_id = '00000000-0000-0000-0000-0000000000b2'
     where user_id = '00000000-0000-0000-0000-0000000000a4';
    raise exception 'FALHOU(profile): mudança direta de organização foi aceita';
  exception when sqlstate 'P0001' then
    null;
  end;

  begin
    update public.profiles
       set role = 'admin', organization_id = null
     where user_id = '00000000-0000-0000-0000-0000000000a4';
    raise exception 'FALHOU(profile): mudança direta de papel foi aceita';
  exception when sqlstate 'P0001' then
    null;
  end;
end $$;

select public.update_respondent_profile(
  '00000000-0000-0000-0000-0000000000a4',
  'Respondente Atualizado',
  '00000000-0000-0000-0000-0000000000b2',
  '00000000-0000-0000-0000-0000000000a1'
);

do $$
declare
  v_organization uuid;
  v_name text;
begin
  select organization_id, full_name
    into v_organization, v_name
  from public.profiles
  where user_id = '00000000-0000-0000-0000-0000000000a4';

  if v_organization <> '00000000-0000-0000-0000-0000000000b2'
     or v_name <> 'Respondente Atualizado' then
    raise exception 'FALHOU(profile): RPC administrativa não persistiu a alteração';
  end if;
end $$;

rollback;

do $$ begin
  raise notice 'PROFILE IDENTITY: OK';
end $$;
