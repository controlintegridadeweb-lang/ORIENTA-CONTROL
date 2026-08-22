-- ============================================================================
-- Seed mínimo VÁLIDO para verificações de integração contra o schema real.
--
-- Documenta as constraints reais que mocks não capturam:
--   • organizations.acronym       NOT NULL
--   • axes.name                   CHECK in ('Governanca','Ambiental','Social')
--   • questions.evidence_parameter CHECK shape: objeto com chave 'required'
--   • forms.created_by / responses.created_by  NOT NULL (→ auth.users)
--   • form_versions published exige form_assignments
--   • cycles.period_id            NOT NULL (→ form_periods)
--
-- Os eixos são os canônicos do domínio, resolvidos por nome. Este arquivo não
-- inventa UUID paralelo: após `supabase db reset` o seed oficial
-- `supabase/seeds/0000_axes.sql` já criou os nomes; no greenfield/PGlite os
-- mesmos nomes são inseridos aqui se ainda não existirem.
--
-- Uso: psql ... -f supabase/verify/_seed_minimal.sql  (idempotente)
-- Deixa um ciclo 'validated' pronto (ids fixos abaixo) para os testes.
-- ============================================================================

insert into public.axes (name) values
  ('Governanca'),
  ('Ambiental'),
  ('Social')
on conflict (name) do nothing;

do $$
begin
  if (select count(*) from public.axes where name in ('Governanca', 'Ambiental', 'Social')) <> 3 then
    raise exception 'seed_requires_canonical_axes';
  end if;
end $$;

insert into auth.users(id, email)
values ('00000000-0000-0000-0000-0000000000a1', 'seed@orienta.test')
on conflict do nothing;

insert into public.organizations(id, name, acronym)
values ('00000000-0000-0000-0000-0000000000b1', 'Org Seed', 'SEED')
on conflict do nothing;

insert into public.profiles(user_id, role, organization_id)
values ('00000000-0000-0000-0000-0000000000a1', 'admin', null)
on conflict do nothing;

insert into public.sections(id, axis_id, code, name, ordem)
select
  '00000000-0000-0000-0000-0000000000d1',
  axes.id,
  'SEED-GOV-01',
  'Seção Seed',
  1
from public.axes
where axes.name = 'Governanca'
on conflict do nothing;

insert into public.questions(
  id, section_id, prompt, evidence_parameter, fami_enabled, applies_to_respondent
)
values (
  '00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-0000000000d1',
  'Pergunta seed?',
  '{"required": true}'::jsonb,
  true,
  true
)
on conflict do nothing;

insert into public.question_versions(
  id, question_id, version, prompt, evidence_parameter, fami_enabled,
  applies_to_respondent, section_id, section_name, section_order, axis_id,
  axis_name, library_binding_snapshot
)
select
  '00000000-0000-0000-0000-0000000000f1',
  '00000000-0000-0000-0000-0000000000e1',
  1,
  'Pergunta seed?',
  '{"required": true}'::jsonb,
  true,
  true,
  '00000000-0000-0000-0000-0000000000d1',
  'Seção Seed',
  1,
  axes.id,
  axes.name,
  '{"bindings":{"defaultRecommendation":{"title":"Recomendação seed","textoBaseFixo":"Apresentar evidência válida para o critério seed."}}}'::jsonb
from public.axes
where axes.name = 'Governanca'
on conflict (id) do nothing;

insert into public.questions(
  id, section_id, prompt, evidence_parameter, fami_enabled, applies_to_respondent
)
values (
  '00000000-0000-0000-0000-0000000000e2',
  '00000000-0000-0000-0000-0000000000d1',
  'Pergunta fora do formulário?',
  '{"required": false}'::jsonb,
  true,
  true
)
on conflict do nothing;

insert into public.question_versions(
  id, question_id, version, prompt, evidence_parameter, fami_enabled,
  applies_to_respondent, section_id, section_name, section_order, axis_id, axis_name
)
select
  '00000000-0000-0000-0000-0000000000f2',
  '00000000-0000-0000-0000-0000000000e2',
  1,
  'Pergunta fora do formulário?',
  '{"required": false}'::jsonb,
  true,
  true,
  '00000000-0000-0000-0000-0000000000d1',
  'Seção Seed',
  1,
  axes.id,
  axes.name
from public.axes
where axes.name = 'Governanca'
on conflict (id) do nothing;

insert into public.forms(id, name, created_by)
values (
  '00000000-0000-0000-0000-000000000aa1',
  'Form Seed',
  '00000000-0000-0000-0000-0000000000a1'
)
on conflict do nothing;

insert into public.form_assignments(id, form_id, organization_id, assigned_by)
values (
  '00000000-0000-0000-0000-00000000fa01',
  '00000000-0000-0000-0000-000000000aa1',
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000a1'
)
on conflict (form_id, organization_id) do nothing;

insert into public.form_versions(id, form_id, version, state)
values (
  '00000000-0000-0000-0000-000000000bb1',
  '00000000-0000-0000-0000-000000000aa1',
  1,
  'published'
)
on conflict do nothing;

insert into public.form_questions(form_version_id, question_version_id, order_index)
values (
  '00000000-0000-0000-0000-000000000bb1',
  '00000000-0000-0000-0000-0000000000f1',
  1
)
on conflict do nothing;

insert into public.cycles(id, form_version_id, organization_id, period_id, period_label, state)
values (
  '00000000-0000-0000-0000-000000000cc1',
  '00000000-0000-0000-0000-000000000bb1',
  '00000000-0000-0000-0000-0000000000b1',
  (public.ensure_form_period('00000000-0000-0000-0000-000000000bb1', '2026', '2026')).id,
  '2026',
  'validated'
)
on conflict do nothing;

insert into public.cycle_processings(id, cycle_id, processing_version, status)
values (
  '00000000-0000-0000-0000-000000000ee1',
  '00000000-0000-0000-0000-000000000cc1',
  1,
  'working'
)
on conflict do nothing;

insert into public.responses(id, cycle_id, question_version_id, answer, is_not_applicable, created_by)
values (
  '00000000-0000-0000-0000-000000000dd1',
  '00000000-0000-0000-0000-000000000cc1',
  '00000000-0000-0000-0000-0000000000f1',
  'yes',
  false,
  '00000000-0000-0000-0000-0000000000a1'
)
on conflict do nothing;
