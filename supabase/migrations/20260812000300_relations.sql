-- ORIENTA greenfield baseline — Relações finais que fecham dependências circulares entre tabelas
-- Gerada a partir do estado final pré-cutover; não contém dados históricos reais.

alter table public.forms add constraint forms_current_version_fkey foreign key (current_form_version_id) references public.form_versions(id) on delete set null;

alter table public.cycles add constraint cycles_period_id_fkey foreign key (period_id) references public.form_periods(id) on delete restrict;

alter table public.cycles add constraint cycles_period_org_unique unique (period_id, organization_id);
