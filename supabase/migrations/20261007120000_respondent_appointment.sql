-- Cargo da pessoa vinculada ao órgão: titular ou suplente.
-- Fica em respondent_profile_details, junto dos demais dados funcionais,
-- sem alterar o cargo textual importado em position_title.

create type public.respondent_appointment as enum ('titular', 'suplente');

alter table public.respondent_profile_details
  add column appointment public.respondent_appointment;

comment on type public.respondent_appointment is
  'Cargo da pessoa no órgão. Titular é o responsável principal; suplente é o substituto.';

comment on column public.respondent_profile_details.appointment is
  'Cargo da pessoa no órgão: titular ou suplente. Independente do cargo funcional importado em position_title.';

create or replace function public.create_respondent_profile(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_appointment public.respondent_appointment
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
begin
  if p_appointment is null then
    raise exception 'respondent_appointment_required' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.profiles
    where user_id = p_actor_user_id and role = 'admin' and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  perform set_config('app.profile_identity_override', 'create_respondent_profile', true);
  insert into public.profiles (user_id, role, organization_id, full_name)
  values (p_user_id, 'respondent', p_organization_id, nullif(btrim(p_full_name), ''))
  returning * into v_profile;

  perform public.set_audit_actor(p_actor_user_id);
  insert into public.respondent_profile_details as existing (
    user_id, appointment, source_name, updated_by
  ) values (
    p_user_id, p_appointment, 'cadastro_manual', p_actor_user_id
  )
  on conflict (user_id) do update
    set appointment = excluded.appointment,
        updated_by = excluded.updated_by
    where existing.appointment is distinct from excluded.appointment;

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id, 'user.respondent_created', 'profiles', p_user_id, null,
    to_jsonb(v_profile) || jsonb_build_object(
      'email', lower(btrim(p_email)),
      'appointment', p_appointment
    )
  );
end;
$$;

drop function public.create_respondent_profile(uuid, text, text, uuid, uuid);

revoke all on function public.create_respondent_profile(uuid, text, text, uuid, uuid, public.respondent_appointment) from public;
grant execute on function public.create_respondent_profile(uuid, text, text, uuid, uuid, public.respondent_appointment) to service_role;

create or replace function public.update_respondent_profile(
  p_target_user_id uuid,
  p_full_name text,
  p_organization_id uuid,
  p_actor_user_id uuid,
  p_appointment public.respondent_appointment default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before public.profiles%rowtype;
  v_after public.profiles%rowtype;
  v_previous_appointment public.respondent_appointment;
  v_appointment public.respondent_appointment;
begin
  if not exists (
    select 1
    from public.profiles
    where user_id = p_actor_user_id
      and role = 'admin'
      and organization_id is null
  ) then
    raise exception 'global_admin_required' using errcode = '42501';
  end if;

  select * into v_before
  from public.profiles
  where user_id = p_target_user_id
    and role = 'respondent'
  for update;

  if not found then
    raise exception 'respondent_profile_not_found' using errcode = 'P0002';
  end if;

  if not exists (
    select 1 from public.organizations where id = p_organization_id
  ) then
    raise exception 'organization_not_found' using errcode = 'P0002';
  end if;

  select d.appointment
    into v_previous_appointment
  from public.respondent_profile_details d
  where d.user_id = p_target_user_id;
  v_appointment := coalesce(p_appointment, v_previous_appointment);

  perform public.set_audit_actor(p_actor_user_id);
  perform set_config('app.profile_identity_override', 'update_respondent_profile', true);

  update public.profiles
  set full_name = nullif(btrim(p_full_name), ''),
      organization_id = p_organization_id
  where user_id = p_target_user_id
  returning * into v_after;

  if p_appointment is not null then
    insert into public.respondent_profile_details as existing (
      user_id, appointment, source_name, updated_by
    ) values (
      p_target_user_id, p_appointment, 'cadastro_manual', p_actor_user_id
    )
    on conflict (user_id) do update
      set appointment = excluded.appointment,
          updated_by = excluded.updated_by
      where existing.appointment is distinct from excluded.appointment;
  end if;

  insert into public.audit_logs (
    actor_user_id, event_type, entity_type, record_id, before_json, after_json
  ) values (
    p_actor_user_id, 'user.respondent_updated', 'profiles', p_target_user_id,
    to_jsonb(v_before) || jsonb_build_object('appointment', v_previous_appointment),
    to_jsonb(v_after) || jsonb_build_object('appointment', v_appointment)
  );
end;
$$;

drop function public.update_respondent_profile(uuid, text, uuid, uuid);

revoke all on function public.update_respondent_profile(uuid, text, uuid, uuid, public.respondent_appointment) from public;
grant execute on function public.update_respondent_profile(uuid, text, uuid, uuid, public.respondent_appointment) to service_role;

drop function public.list_admin_users_page(text, uuid, public.app_user_role, integer, integer);

create function public.list_admin_users_page(
  p_search text default null,
  p_organization_id uuid default null,
  p_role public.app_user_role default null,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  user_id uuid,
  email text,
  full_name text,
  role public.app_user_role,
  organization_id uuid,
  appointment public.respondent_appointment,
  created_at timestamptz,
  total_count bigint
)
language sql
security definer
set search_path = public, auth
stable
as $$
  select
    p.user_id,
    au.email,
    p.full_name,
    p.role,
    p.organization_id,
    d.appointment,
    p.created_at,
    count(*) over() as total_count
  from public.profiles p
  join auth.users au on au.id = p.user_id
  left join public.organizations o on o.id = p.organization_id
  left join public.respondent_profile_details d on d.user_id = p.user_id
  where (p_organization_id is null or p.organization_id = p_organization_id)
    and (p_role is null or p.role = p_role)
    and (
      nullif(btrim(p_search), '') is null
      or concat_ws(' ', p.full_name, au.email, o.name, o.acronym, d.appointment::text)
        ilike '%' || btrim(p_search) || '%'
    )
  order by p.created_at desc, p.user_id desc
  limit greatest(1, least(coalesce(p_limit, 25), 200))
  offset greatest(coalesce(p_offset, 0), 0);
$$;

revoke all on function public.list_admin_users_page(text, uuid, public.app_user_role, integer, integer) from public;
grant execute on function public.list_admin_users_page(text, uuid, public.app_user_role, integer, integer) to service_role;

comment on function public.list_admin_users_page(text, uuid, public.app_user_role, integer, integer) is
  'Lista usuários administrativos com o cargo da pessoa no órgão, quando houver.';

notify pgrst, 'reload schema';
