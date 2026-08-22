-- ORIENTA greenfield baseline — Extensões, enums e tipos finais
-- Gerada a partir do estado final pré-cutover; não contém dados históricos reais.

-- Schema alvo das extensões. No Postgres gerenciado do Supabase ele já existe;
-- em Postgres vazio (PGlite/greenfield) precisa existir antes do CREATE EXTENSION.
create schema if not exists extensions;
grant usage on schema extensions to public;

create extension if not exists pgcrypto with schema extensions;

create extension if not exists pg_trgm with schema extensions;
create schema if not exists app_private authorization postgres;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to authenticated, service_role;


create type public.app_user_role as enum ('admin', 'respondent');

create type public.cycle_state as enum (
  'draft',
  'in_response',
  'submitted',
  'in_validation',
  'awaiting_adjustment',
  'validated',
  'completed'
);

create type public.evidence_validation_status as enum (
  'pending',
  'approved',
  'invalidated',
  'adjustment_requested'
);

create type public.answer_value as enum ('yes', 'no', 'not_applicable');

create type public.na_validation_status as enum (
  'pending',
  'approved',
  'rejected'
);

create type public.evidence_kind as enum ('file', 'link',
  'text'
);

create type public.recommendation_type as enum (
  'nao_implementacao',
  'ausencia_evidencia',
  'evidencia_insuficiente'
);

create type public.action_plan_status as enum ('todo', 'doing', 'done', 'cancelled');

create type public.form_version_state as enum ('published', 'superseded', 'archived');

create type public.cycle_processing_status as enum ('working', 'completed');

create type public.library_item_status as enum (
  'draft',
  'in_review',
  'published',
  'deprecated',
  'archived'
);

create type public.supervision_note_lifecycle_status as enum (
  'recorded',
  'open',
  'acknowledged',
  'resolved',
  'cancelled',
  'effective',
  'superseded'
);

create or replace function public.valid_reminder_offsets(p_offsets integer[])
returns boolean
language sql
immutable
set search_path = public
as $$
  select cardinality(p_offsets) <= 20
    and coalesce((select bool_and(value >= 0) from unnest(p_offsets) value), true);
$$;
