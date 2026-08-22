-- Seed local/dev dos eixos canônicos.
-- Não faz parte da baseline estrutural de produção e não deve ser executado
-- antes de uma importação que preserve os UUIDs reais da origem.
begin;
insert into public.axes (name) values
  ('Governanca'),
  ('Ambiental'),
  ('Social')
on conflict (name) do nothing;
commit;
