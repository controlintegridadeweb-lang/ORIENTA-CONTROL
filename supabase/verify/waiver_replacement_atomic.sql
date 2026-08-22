-- Verifica a substituição atômica das dispensas por pergunta.
set session_replication_role = replica;
insert into public.organizations(id, name, acronym)
values ('00000000-0000-0000-0000-0000000000b2', 'Org Seed 2', 'SEED2')
on conflict do nothing;
reset session_replication_role;

do $$
declare
  v_reason text;
begin
  perform public.replace_question_organization_waivers(
    '00000000-0000-0000-0000-0000000000e1',
    array[
      '00000000-0000-0000-0000-0000000000b1'::uuid,
      '00000000-0000-0000-0000-0000000000b2'::uuid
    ],
    '[
      {"organizationId":"00000000-0000-0000-0000-0000000000b1","reason":"Motivo A"},
      {"organizationId":"00000000-0000-0000-0000-0000000000b2","reason":"Motivo B"}
    ]'::jsonb,
    '00000000-0000-0000-0000-0000000000a1'
  );

  perform public.replace_question_organization_waivers(
    '00000000-0000-0000-0000-0000000000e1',
    array['00000000-0000-0000-0000-0000000000b1'::uuid],
    '[
      {"organizationId":"00000000-0000-0000-0000-0000000000b1","reason":"Motivo atualizado"}
    ]'::jsonb,
    '00000000-0000-0000-0000-0000000000a1'
  );

  select reason into v_reason
  from public.question_organization_waivers
  where organization_id = '00000000-0000-0000-0000-0000000000b2'
    and question_id = '00000000-0000-0000-0000-0000000000e1';

  if v_reason is distinct from 'Motivo B' then
    raise exception 'FALHOU: substituição alterou organização fora do escopo';
  end if;

  begin
    perform public.replace_question_organization_waivers(
      '00000000-0000-0000-0000-0000000000e1',
      array['00000000-0000-0000-0000-0000000000b1'::uuid],
      '[
        {"organizationId":"00000000-0000-0000-0000-0000000000b1","reason":"Não deve persistir"},
        {"organizationId":"00000000-0000-0000-0000-0000000000b2","reason":"Fora do escopo"}
      ]'::jsonb,
      '00000000-0000-0000-0000-0000000000a1'
    );
    raise exception 'FALHOU: payload fora do escopo foi aceito';
  exception
    when sqlstate '22023' then
      null;
  end;

  select reason into v_reason
  from public.question_organization_waivers
  where organization_id = '00000000-0000-0000-0000-0000000000b1'
    and question_id = '00000000-0000-0000-0000-0000000000e1';

  if v_reason is distinct from 'Motivo atualizado' then
    raise exception 'FALHOU: operação inválida deixou alteração parcial';
  end if;

  delete from public.question_organization_waivers
  where question_id = '00000000-0000-0000-0000-0000000000e1'
    and organization_id in (
      '00000000-0000-0000-0000-0000000000b1',
      '00000000-0000-0000-0000-0000000000b2'
    );

  raise notice 'WAIVER REPLACEMENT ATOMIC: OK';
end $$;
