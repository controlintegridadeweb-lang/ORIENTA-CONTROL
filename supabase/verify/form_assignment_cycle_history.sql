-- Garante que a atribuição formulário × organização não possa ser removida
-- depois que existe diagnóstico, preservando a visibilidade histórica entre
-- os perfis administrativo e respondente.

insert into public.form_assignments (
  id,
  form_id,
  organization_id,
  assigned_by
)
values (
  '00000000-0000-0000-0000-00000000fa01',
  '00000000-0000-0000-0000-000000000aa1',
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000a1'
)
on conflict (form_id, organization_id) do nothing;

do $$
begin
  begin
    delete from public.form_assignments
    where form_id = '00000000-0000-0000-0000-000000000aa1'
      and organization_id = '00000000-0000-0000-0000-0000000000b1';

    raise exception 'form_assignment_cycle_history_not_enforced';
  exception
    when foreign_key_violation then
      if sqlerrm not like '%form_assignment_has_cycles%' then
        raise;
      end if;
  end;

  if not exists (
    select 1
    from public.form_assignments
    where form_id = '00000000-0000-0000-0000-000000000aa1'
      and organization_id = '00000000-0000-0000-0000-0000000000b1'
  ) then
    raise exception 'form_assignment_removed_despite_cycle';
  end if;

  raise notice 'form_assignment_cycle_history: OK';
end;
$$;
