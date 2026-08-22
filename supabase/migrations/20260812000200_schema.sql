-- ORIENTA greenfield baseline — Tabelas, constraints e índices no estado final
-- Gerada a partir do estado final pré-cutover; não contém dados históricos reais.

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  acronym text not null,
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.app_user_role not null,
  organization_id uuid references public.organizations(id) on delete set null,
  full_name text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint profiles_role_org_consistency
    check (
      (role = 'admin' and organization_id is null)
      or (role = 'respondent' and organization_id is not null)
    )
);

create table public.axes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (name in ('Governanca', 'Ambiental', 'Social'))
);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  axis_id uuid not null references public.axes(id) on delete restrict,
  code text not null unique,
  name text not null,
  description text,
  ordem integer not null default 0 check (ordem >= 0),
  status public.library_item_status not null default 'draft',
  version_major integer not null default 0 check (version_major >= 0),
  version_minor integer not null default 1 check (version_minor >= 0),
  version_patch integer not null default 0 check (version_patch >= 0),
  vigente_de timestamptz,
  vigente_ate timestamptz,
  tags text[] not null default '{}',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  deprecated_by uuid references auth.users(id),
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (axis_id, name)
);

create table public.questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.sections(id) on delete restrict,
  prompt text not null,
  evidence_parameter jsonb not null default '{"required": false}'::jsonb,
  fami_enabled boolean not null default true,
  applies_to_respondent boolean not null default true,
  allows_not_applicable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint questions_evidence_parameter_shape
    check (jsonb_typeof(evidence_parameter) = 'object'
           and evidence_parameter ? 'required')
);

create table public.question_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.questions(id) on delete restrict,
  version integer not null check (version >= 1),
  prompt text not null,
  evidence_parameter jsonb not null,
  fami_enabled boolean not null,
  applies_to_respondent boolean not null,
  allows_not_applicable boolean not null default false,
  section_id uuid not null references public.sections(id) on delete restrict,
  section_name text not null,
  section_order integer not null,
  axis_id uuid not null references public.axes(id) on delete restrict,
  axis_name text not null,
  library_binding_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(library_binding_snapshot) = 'object'),
  created_at timestamptz not null default now(),
  unique (question_id, version)
);

create table public.forms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  current_form_version_id uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_drafts (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null unique references public.forms(id) on delete cascade,
  updated_at timestamptz not null default now()
);

create table public.form_draft_questions (
  form_draft_id uuid not null references public.form_drafts(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete restrict,
  order_index integer not null default 0 check (order_index >= 0),
  primary key (form_draft_id, question_id)
);

create table public.form_versions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  version integer not null check (version >= 1),
  state public.form_version_state not null default 'published',
  published_at timestamptz not null default now(),
  published_by uuid references auth.users(id),
  unique (form_id, version)
);

create table public.form_questions (
  form_version_id uuid not null references public.form_versions(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  order_index integer not null default 0 check (order_index >= 0),
  primary key (form_version_id, question_version_id)
);

create table public.form_assignments (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.forms(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  assigned_at timestamptz not null default now(),
  assigned_by uuid references auth.users(id),
  unique (form_id, organization_id)
);

create table public.cycles (
  id uuid primary key default gen_random_uuid(),
  form_version_id uuid not null references public.form_versions(id) on delete restrict,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  period_label text not null,
  state public.cycle_state not null default 'draft',
  reopen_count integer not null default 0 check (reopen_count >= 0),
  starts_at timestamptz,
  response_deadline_at timestamptz,
  original_response_deadline_at timestamptz,
  response_collection_paused_at timestamptz,
  response_collection_pause_reason text
    check (
      response_collection_pause_reason is null
      or char_length(btrim(response_collection_pause_reason)) between 10 and 2000
    ),
  deadline_change_count integer not null default 0
    check (deadline_change_count >= 0),
  submitted_at timestamptz,
  validated_at timestamptz,
  closed_at timestamptz,
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cycles_schedule_order_check
    check (
      starts_at is null
      or response_deadline_at is null
      or response_deadline_at >= starts_at
    ),
  reference_start_year integer,
  reference_end_year integer,
  action_plan_revision bigint not null default 0,
  constraint cycles_reference_period_check check (
    (reference_start_year is null and reference_end_year is null)
    or (
      reference_start_year between 1900 and 2199
      and reference_end_year between reference_start_year and 2199
    )
  ),
  schedule_revision bigint not null default 0
    check (schedule_revision >= 0),
  reminder_offsets_days integer[] not null default array[7,3,1,0]::integer[],
  validation_deadline_at timestamptz,
  cycle_close_at timestamptz,
  deadline_policy text not null default 'flexible_audited'
    check (deadline_policy = 'flexible_audited'),
  submitted_late_at timestamptz,
  submission_delay_seconds bigint
    check (submission_delay_seconds is null or submission_delay_seconds >= 0),
  constraint cycles_reminder_offsets_nonnegative check (public.valid_reminder_offsets(reminder_offsets_days)),
  constraint cycles_validation_after_response check (
      validation_deadline_at is null
      or response_deadline_at is null
      or validation_deadline_at > response_deadline_at
    ),
  constraint cycles_close_after_validation check (
      cycle_close_at is null
      or (validation_deadline_at is not null and cycle_close_at > validation_deadline_at)
    ),
  period_id uuid not null
);

create table public.cycle_processings (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  processing_version integer not null check (processing_version >= 1),
  status public.cycle_processing_status not null default 'working',
  fami_policy_version text not null default 'v7',
  fami_scoring_model text not null default 'evidence_weighted'
    check (fami_scoring_model = 'evidence_weighted'),
  yes_without_evidence_weight numeric(6,3) not null default 1
    check (yes_without_evidence_weight = 1),
  yes_with_approved_evidence_weight numeric(6,3) not null default 2,
  thresholds jsonb not null default
    '[{"level":1,"maxPercentage":20},
      {"level":2,"maxPercentage":40},
      {"level":3,"maxPercentage":60},
      {"level":4,"maxPercentage":80},
      {"level":5,"maxPercentage":100}]'::jsonb
    check (
      thresholds =
        '[{"level":1,"maxPercentage":20},
          {"level":2,"maxPercentage":40},
          {"level":3,"maxPercentage":60},
          {"level":4,"maxPercentage":80},
          {"level":5,"maxPercentage":100}]'::jsonb
    ),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint cycle_processings_version_unique unique (cycle_id, processing_version),
  constraint cycle_processings_id_cycle_unique unique (id, cycle_id),
  constraint cycle_processings_fami_policy_version_check check (fami_policy_version in ('v3', 'v4', 'v5', 'v6', 'v7')),
  constraint cycle_processings_yes_with_approved_evidence_weight_check check (yes_with_approved_evidence_weight in (1.5, 2))
);

create table public.responses (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  answer public.answer_value not null,
  is_not_applicable boolean not null default false,
  notes text,
  na_justification text,
  na_validation_status public.na_validation_status,
  na_validated_at timestamptz,
  na_validated_by uuid references auth.users(id),
  na_rejection_reason text,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revision bigint not null default 1,
  constraint responses_revision_positive check (revision >= 1),
  constraint responses_not_applicable_consistency
    check (is_not_applicable = (answer = 'not_applicable')),
  constraint responses_na_validation_consistency check (
    (
      answer = 'not_applicable'::public.answer_value
      and na_validation_status in (
        'pending'::public.na_validation_status,
        'approved'::public.na_validation_status
      )
      and na_justification is not null
      and char_length(btrim(na_justification)) >= 20
      and na_rejection_reason is null
    )
    or
    (
      answer = 'no'::public.answer_value
      and na_validation_status = 'rejected'::public.na_validation_status
      and na_justification is not null
      and char_length(btrim(na_justification)) >= 20
      and na_rejection_reason is not null
      and btrim(na_rejection_reason) <> ''
    )
    or
    (
      answer <> 'not_applicable'::public.answer_value
      and na_validation_status is null
      and na_justification is null
      and na_rejection_reason is null
    )
  ),
  unique (cycle_id, question_version_id),
  admin_applicability_status text,
  admin_na_justification text,
  admin_na_decided_by uuid references auth.users(id),
  admin_na_decided_at timestamptz,
  constraint responses_admin_applicability_status_check check (admin_applicability_status is null or admin_applicability_status = 'not_applicable'),
  constraint responses_admin_applicability_consistency check (
    (
      admin_applicability_status = 'not_applicable'
      and admin_na_justification is not null
      and char_length(btrim(admin_na_justification)) >= 1
      and admin_na_decided_by is not null
      and admin_na_decided_at is not null
    )
    or (
      admin_applicability_status is null
      and admin_na_justification is null
      and admin_na_decided_by is null
      and admin_na_decided_at is null
    )
  ),
  admin_proof_status text,
  admin_proof_observation text,
  admin_proof_decided_by uuid references auth.users(id),
  admin_proof_decided_at timestamptz,
  constraint responses_admin_proof_consistency check (
    (
      admin_proof_status is not null
      and admin_proof_observation is not null
      and char_length(btrim(admin_proof_observation)) >= 1
      and admin_proof_decided_by is not null
      and admin_proof_decided_at is not null
    )
    or (
      admin_proof_status is null
      and admin_proof_observation is null
      and admin_proof_decided_by is null
      and admin_proof_decided_at is null
    )
  ),
  constraint responses_admin_proof_status_check check (
    admin_proof_status is null
    or admin_proof_status in (
      'validated_without_proof',
      'proof_requested',
      'considered_insufficient'
    )
  )
);

create table public.evidences (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete cascade,
  kind public.evidence_kind not null,
  storage_path text,
  external_link text,
  link_reason text,
  original_filename text,
  mime_type text,
  size_bytes bigint check (size_bytes is null or size_bytes >= 0),
  sha256 text,
  validation_status public.evidence_validation_status not null default 'pending',
  validation_justification text,
  validated_at timestamptz,
  validated_by uuid references auth.users(id),
  deactivated_at timestamptz,
  submitted_by uuid not null references auth.users(id),
  submitted_at timestamptz not null default now(),
  constraint evidences_external_link_http check (
    kind <> 'link' or external_link ~* '^https?://'
  ),
  constraint evidences_negative_verdict_needs_justification check (
    validation_status not in ('invalidated', 'adjustment_requested')
    or (validation_justification is not null and length(trim(validation_justification)) > 0)
  ),
  file_validation_status text default 'not_applicable' not null,
  file_validated_at timestamptz,
  constraint evidences_file_validation_status_check check (file_validation_status in (
      'not_applicable', 'valid', 'rejected', 'removed'
    )),
  title text,
  text_body text,
  constraint evidences_kind_xor check (
    (
      kind = 'file'::public.evidence_kind
      and storage_path is not null
      and external_link is null
      and link_reason is null
      and text_body is null
    )
    or (
      kind = 'link'::public.evidence_kind
      and external_link is not null
      and link_reason is not null
      and storage_path is null
      and text_body is null
      and original_filename is null
    )
    or (
      kind = 'text'::public.evidence_kind
      and text_body is not null
      and length(trim(text_body)) > 0
      and title is not null
      and length(trim(title)) > 0
      and storage_path is null
      and external_link is null
      and link_reason is null
      and original_filename is null
    )
  )
);

create table public.pending_evidence_uploads (
  id uuid primary key,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  verified_mime_type text,
  verified_at timestamptz,
  size_bytes bigint not null check (size_bytes >= 0),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  constraint pending_evidence_uploads_storage_path_unique unique (storage_path),
  constraint pending_evidence_uploads_expiration_after_creation
    check (expires_at > created_at),
  file_validation_status text not null default 'upload_started'
    check (file_validation_status in ('upload_started', 'validating', 'valid', 'rejected', 'removed'))
);

create table public.evidence_storage_cleanup_queue (
  storage_path text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  scheduled_for timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now()
);

create table public.response_snapshots (
  id uuid primary key default gen_random_uuid(),
  cycle_processing_id uuid not null references public.cycle_processings(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  answer public.answer_value not null,
  is_not_applicable boolean not null,
  na_justification text,
  created_at timestamptz not null default now(),
  constraint response_snapshots_not_applicable_consistency
    check (is_not_applicable = (answer = 'not_applicable')),
  constraint response_snapshots_na_justification_consistency check (
    (
      is_not_applicable
      and na_justification is not null
      and char_length(btrim(na_justification)) >= 20
    )
    or (not is_not_applicable and na_justification is null)
  ),
  unique (cycle_processing_id, question_version_id),
  unique (id, cycle_processing_id, question_version_id),
  na_original_justification text,
  na_validation_status public.na_validation_status,
  na_rejection_reason text,
  admin_applicability_status text,
  admin_na_justification text,
  constraint response_snapshots_admin_applicability_status_check check (admin_applicability_status is null or admin_applicability_status = 'not_applicable'),
  admin_proof_status text,
  admin_proof_observation text,
  constraint response_snapshots_admin_proof_status_check check (
    admin_proof_status is null
    or admin_proof_status in (
      'validated_without_proof',
      'proof_requested',
      'considered_insufficient'
    )
  )
);

create table public.evidence_snapshots (
  id uuid primary key default gen_random_uuid(),
  cycle_processing_id uuid not null references public.cycle_processings(id) on delete cascade,
  response_snapshot_id uuid not null references public.response_snapshots(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  evidence_id uuid references public.evidences(id) on delete set null,
  kind public.evidence_kind not null,
  storage_path text,
  external_link text,
  link_reason text,
  validation_status public.evidence_validation_status not null,
  validation_justification text,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  sha256 text,
  created_at timestamptz not null default now(),
  constraint evidence_snapshots_external_link_http check (
    kind <> 'link' or external_link ~* '^https?://'
  ),
  constraint evidence_snapshots_negative_verdict_needs_justification check (
    validation_status not in ('invalidated', 'adjustment_requested')
    or (validation_justification is not null and length(trim(validation_justification)) > 0)
  ),
  constraint evidence_snapshots_size_nonnegative
    check (size_bytes is null or size_bytes >= 0),
  constraint evidence_snapshots_response_context_fkey
    foreign key (response_snapshot_id, cycle_processing_id, question_version_id)
    references public.response_snapshots(id, cycle_processing_id, question_version_id)
    on delete cascade,
  title text,
  text_body text,
  constraint evidence_snapshots_kind_xor check (
    (
      kind = 'file'::public.evidence_kind
      and storage_path is not null
      and external_link is null
      and link_reason is null
      and text_body is null
    )
    or (
      kind = 'link'::public.evidence_kind
      and external_link is not null
      and link_reason is not null
      and storage_path is null
      and text_body is null
    )
    or (
      kind = 'text'::public.evidence_kind
      and text_body is not null
      and length(trim(text_body)) > 0
      and title is not null
      and length(trim(title)) > 0
      and storage_path is null
      and external_link is null
      and link_reason is null
      and original_filename is null
    )
  )
);

create table public.processing_waiver_snapshots (
  id uuid primary key default gen_random_uuid(),
  cycle_processing_id uuid not null references public.cycle_processings(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  question_id uuid not null references public.questions(id) on delete restrict,
  reason text,
  created_at timestamptz not null default now(),
  unique (cycle_processing_id, question_version_id)
);

create table public.question_organization_waivers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  question_id uuid not null references public.questions(id) on delete cascade,
  reason text,
  waived_by uuid not null references auth.users(id),
  waived_at timestamptz not null default now(),
  unique (organization_id, question_id)
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  cycle_processing_id uuid not null,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  tipo public.recommendation_type not null,
  text text not null,
  source text not null default 'engine'
    constraint recommendations_source_chk check (source in ('engine', 'manual')),
  origin jsonb not null default '{}'::jsonb
    constraint recommendations_origin_object_chk check (jsonb_typeof(origin) = 'object'),
  created_at timestamptz not null default now(),
  constraint recommendations_processing_fkey
    foreign key (cycle_processing_id, cycle_id)
    references public.cycle_processings(id, cycle_id) on delete cascade,
  constraint recommendations_unique_per_version
    unique (cycle_id, question_version_id, cycle_processing_id)
);

create table public.action_plans (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  axis_id uuid not null references public.axes(id) on delete restrict,
  action_text text not null,
  due_date date not null,
  responsible_user_id uuid references auth.users(id),
  responsible_label text not null,
  progress_percentage integer not null default 0,
  status public.action_plan_status not null default 'todo',
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  execution_notes text,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint action_plans_action_text_length
    check (char_length(trim(action_text)) between 5 and 4000),
  constraint action_plans_responsible_label_length
    check (char_length(trim(responsible_label)) between 2 and 403),
  constraint action_plans_execution_notes_length
    check (execution_notes is null or char_length(trim(execution_notes)) <= 4000),
  constraint action_plans_revision_positive
    check (revision >= 1),
  constraint action_plans_progress_percentage_range
    check (progress_percentage >= 0 and progress_percentage <= 100),
  constraint action_plans_progress_status_coherent
    check (
      status = 'cancelled'
      or (status = 'todo' and progress_percentage = 0)
      or (status = 'doing' and progress_percentage between 1 and 99)
      or (status = 'done' and progress_percentage = 100)
    ),
  constraint action_plans_done_stamp
    check (status <> 'done' or completed_at is not null),
  constraint action_plans_cancelled_needs_reason
    check (status <> 'cancelled'
           or (cancelled_at is not null
               and cancel_reason is not null
               and length(trim(cancel_reason)) > 0)),
  start_date date not null,
  constraint action_plans_start_before_due check (start_date <= due_date)
);

create table public.action_plan_progress_updates (
  id uuid primary key default gen_random_uuid(),
  action_plan_id uuid not null references public.action_plans(id) on delete cascade,
  previous_percentage integer not null,
  new_percentage integer not null,
  previous_status public.action_plan_status not null,
  new_status public.action_plan_status not null,
  description text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint action_plan_progress_updates_previous_range
    check (previous_percentage >= 0 and previous_percentage <= 100),
  constraint action_plan_progress_updates_new_range
    check (new_percentage >= 0 and new_percentage <= 100),
  constraint action_plan_progress_updates_description_length
    check (description is null or char_length(trim(description)) <= 4000)
);

create table public.action_plan_documents (
  id uuid primary key default gen_random_uuid(),
  action_plan_id uuid not null references public.action_plans(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action_revision bigint not null check (action_revision >= 1),
  kind text not null check (kind in ('file', 'link')),
  title text not null check (char_length(btrim(title)) between 3 and 240),
  storage_path text,
  external_link text,
  original_filename text,
  mime_type text,
  size_bytes bigint,
  file_validation_status text not null default 'not_applicable'
    check (file_validation_status in ('not_applicable', 'valid', 'rejected', 'removed')),
  validated_at timestamptz,
  uploaded_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  deactivated_at timestamptz,
  deactivated_by uuid references auth.users(id),
  deactivation_reason text,
  constraint action_plan_documents_payload_check check (
    (kind = 'file'
      and storage_path is not null
      and external_link is null
      and original_filename is not null
      and size_bytes is not null
      and size_bytes > 0
      and file_validation_status in ('valid', 'rejected', 'removed'))
    or
    (kind = 'link'
      and storage_path is null
      and external_link is not null
      and external_link ~* '^https://'
      and original_filename is null
      and size_bytes is null
      and file_validation_status = 'not_applicable'
      and validated_at is null)
  ),
  constraint action_plan_documents_deactivation_check check (
    (deactivated_at is null and deactivated_by is null and deactivation_reason is null)
    or
    (deactivated_at is not null and deactivated_by is not null
      and char_length(btrim(coalesce(deactivation_reason, ''))) between 5 and 1000)
  )
);

create table public.pending_action_plan_document_uploads (
  id uuid primary key default gen_random_uuid(),
  action_plan_id uuid not null references public.action_plans(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action_revision bigint not null check (action_revision >= 1),
  title text not null check (char_length(btrim(title)) between 3 and 240),
  storage_path text not null unique,
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 500),
  mime_type text,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 20971520),
  uploaded_by uuid not null references auth.users(id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint pending_action_plan_document_uploads_expiration_check
    check (expires_at > created_at and expires_at <= created_at + interval '24 hours')
);

create table public.action_plan_storage_cleanup_queue (
  storage_path text primary key,
  attempts integer not null default 0 check (attempts >= 0),
  scheduled_for timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now()
);

create table public.fami_results (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  cycle_processing_id uuid not null,
  scope_type text not null check (scope_type in ('section', 'axis', 'global')),
  scope_id uuid,
  points_obtained numeric(10,2) not null,
  points_possible numeric(10,2) not null,
  percentage numeric(5,2) not null,
  maturity_level smallint check (maturity_level is null or maturity_level between 1 and 5),
  created_at timestamptz not null default now(),
  constraint fami_results_scope_identity_check
    check (
      (scope_type = 'global' and scope_id is null)
      or (scope_type in ('section', 'axis') and scope_id is not null)
    ),
  constraint fami_results_points_check
    check (
      points_obtained >= 0
      and points_possible >= 0
      and points_obtained <= points_possible
      and percentage between 0 and 100
    ),
  constraint fami_results_calculation_check
    check (
      (
        points_possible = 0
        and points_obtained = 0
        and percentage = 0
        and maturity_level is null
      )
      or (
        points_possible > 0
        and maturity_level is not null
        and percentage = round((points_obtained / points_possible) * 100, 2)
        and maturity_level = case
          when percentage <= 20 then 1
          when percentage <= 40 then 2
          when percentage <= 60 then 3
          when percentage <= 80 then 4
          else 5
        end
      )
    ),
  constraint fami_results_processing_fkey
    foreign key (cycle_processing_id, cycle_id)
    references public.cycle_processings(id, cycle_id) on delete cascade
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null,
  cycle_processing_id uuid not null,
  file_path text not null,
  generated_by uuid references auth.users(id),
  generated_at timestamptz not null default now(),
  emission_version integer not null default 1,
  supersedes_report_id uuid,
  reissue_reason text,
  constraint reports_emission_version_positive
    check (emission_version >= 1),
  constraint reports_supersedes_report_id_fkey
    foreign key (supersedes_report_id)
    references public.reports(id) on delete restrict,
  constraint reports_processing_emission_version_unique
    unique (cycle_processing_id, emission_version),
  constraint reports_file_path_unique
    unique (file_path),
  status text not null default 'legacy',
  file_sha256 text,
  content_sha256 text,
  file_size_bytes bigint,
  action_plan_revision bigint,
  reference_start_year integer,
  reference_end_year integer,
  generated_by_name text,
  constraint reports_status_check check (status in ('preparing', 'completed', 'legacy')),
  constraint reports_file_integrity_check check (
    status <> 'completed'
    or (
      file_sha256 ~ '^[0-9a-f]{64}$'
      and content_sha256 ~ '^[0-9a-f]{64}$'
      and file_size_bytes > 0
      and action_plan_revision is not null
      and reference_start_year is not null
      and reference_end_year is not null
    )
  ),
  constraint reports_reference_period_check check (
    (reference_start_year is null and reference_end_year is null)
    or (
      reference_start_year between 1900 and 2199
      and reference_end_year between reference_start_year and 2199
    )
  ),
  constraint reports_cycle_id_fkey foreign key (cycle_id) references public.cycles(id) on delete restrict,
  constraint reports_processing_fkey foreign key (cycle_processing_id, cycle_id)
  references public.cycle_processings(id, cycle_id) on delete restrict
);

create table public.library_recommendations (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  tipo public.recommendation_type not null default 'nao_implementacao',
  texto_base_fixo text,
  texto_base_parametrizavel text,
  variaveis_parametro jsonb not null default '[]'::jsonb
    check (jsonb_typeof(variaveis_parametro) = 'array'),
  fundamento_tecnico text,
  escopo_aplicacao text,
  status public.library_item_status not null default 'draft',
  version_major integer not null default 0 check (version_major >= 0),
  version_minor integer not null default 1 check (version_minor >= 0),
  version_patch integer not null default 0 check (version_patch >= 0),
  vigente_de timestamptz,
  vigente_ate timestamptz,
  tags text[] not null default '{}',
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  deprecated_by uuid references auth.users(id),
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.library_item_versions (
  id uuid primary key default gen_random_uuid(),
  item_type text not null check (item_type in ('section', 'recommendation')),
  item_id uuid not null,
  version text not null,
  version_major integer not null check (version_major >= 0),
  version_minor integer not null check (version_minor >= 0),
  version_patch integer not null check (version_patch >= 0),
  payload jsonb not null default '{}'::jsonb,
  hash text not null,
  vigente_de timestamptz not null,
  vigente_ate timestamptz,
  previous_version_id uuid references public.library_item_versions(id) on delete set null,
  published_by uuid references auth.users(id),
  published_at timestamptz not null default now(),
  deprecated_by uuid references auth.users(id),
  deprecated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (item_type, item_id, version)
);

create table public.question_library_binding (
  question_id uuid primary key references public.questions(id) on delete cascade,
  metric jsonb not null default '{"answerType":"yes_no","interpretation":"qualitative"}'::jsonb
    check (jsonb_typeof(metric) = 'object'),
  bindings jsonb not null default '{}'::jsonb check (jsonb_typeof(bindings) = 'object'),
  response_mapping jsonb not null default '{}'::jsonb check (jsonb_typeof(response_mapping) = 'object'),
  coverage_score numeric(5,2) not null default 0 check (coverage_score between 0 and 100),
  updated_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint question_library_binding_operational_answer_type_chk
    check (
      metric ? 'answerType'
      and metric ->> 'answerType' = 'yes_no'
      and metric ? 'interpretation'
      and metric ->> 'interpretation' = 'qualitative'
      and response_mapping = '{}'::jsonb
    )
);

create table public.recommendation_exceptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  question_id uuid references public.questions(id) on delete set null,
  motivo text not null check (char_length(trim(motivo)) >= 20),
  prazo date,
  status text not null default 'requested'
    check (status in ('requested', 'approved', 'rejected', 'expired')),
  requested_by uuid not null references auth.users(id),
  requested_at timestamptz not null default now(),
  decided_by uuid references auth.users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (status in ('requested', 'expired') and decided_at is null and decided_by is null)
    or (status in ('approved', 'rejected') and decided_at is not null and decided_by is not null)
  )
);

create table public.action_plan_supervision_notes (
  id uuid primary key default gen_random_uuid(),
  recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  action_plan_id uuid references public.action_plans(id) on delete restrict,
  action_revision bigint,
  action_snapshot jsonb not null default '{}'::jsonb,
  author_id uuid not null references auth.users(id),
  author_role public.app_user_role not null,
  note_type text not null check (note_type in ('comment', 'adjustment_request', 'opinion', 'approval', 'pending', 'forwarding')),
  lifecycle_status public.supervision_note_lifecycle_status not null,
  body text not null check (char_length(trim(body)) between 1 and 4000),
  response_body text check (response_body is null or char_length(trim(response_body)) between 1 and 4000),
  responded_by uuid references auth.users(id),
  responded_at timestamptz,
  resolution_body text check (resolution_body is null or char_length(trim(resolution_body)) between 1 and 4000),
  resolved_by uuid references auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  constraint action_plan_supervision_scope_check check (
    (action_plan_id is null and action_revision is null and action_snapshot = '{}'::jsonb)
    or (action_plan_id is not null and action_revision is not null and action_revision >= 1)
  ),
  constraint action_plan_supervision_action_required_check check (
    note_type not in ('adjustment_request', 'approval', 'pending') or action_plan_id is not null
  ),
  constraint action_plan_supervision_lifecycle_check check (
    (note_type in ('adjustment_request', 'pending')
      and lifecycle_status in ('open', 'acknowledged', 'resolved', 'cancelled'))
    or (note_type = 'approval' and lifecycle_status in ('effective', 'superseded'))
    or (note_type in ('comment', 'opinion', 'forwarding') and lifecycle_status = 'recorded')
  ),
  constraint action_plan_supervision_response_stamp_check check (
    (responded_at is null and responded_by is null and response_body is null)
    or (responded_at is not null and responded_by is not null and response_body is not null)
  ),
  constraint action_plan_supervision_resolution_stamp_check check (
    (resolved_at is null and resolved_by is null and resolution_body is null)
    or (resolved_at is not null and resolved_by is not null and resolution_body is not null)
  ),
  constraint action_plan_supervision_lifecycle_response_check check (
    lifecycle_status <> 'acknowledged'
    or (responded_at is not null and responded_by is not null and response_body is not null)
  ),
  constraint action_plan_supervision_lifecycle_resolution_check check (
    lifecycle_status not in ('resolved', 'cancelled')
    or (resolved_at is not null and resolved_by is not null and resolution_body is not null)
  ),
  constraint action_plan_supervision_inactive_stamps_check check (
    lifecycle_status not in ('open', 'recorded', 'effective', 'superseded')
    or (
      responded_at is null and responded_by is null and response_body is null
      and resolved_at is null and resolved_by is null and resolution_body is null
    )
  )
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id),
  event_type text not null,
  entity_type text,
  record_id uuid,
  before_json jsonb,
  after_json jsonb,
  created_at timestamptz not null default now()
);

create table public.library_audit_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  entity text not null,
  item_type text,
  item_id text,
  actor_user_id uuid,
  organization_id uuid,
  from_status text,
  to_status text,
  from_version text,
  to_version text,
  justification text,
  diff jsonb,
  hash text,
  request_id text,
  extra jsonb,
  created_at timestamptz not null default now()
);

create table public.automation_jobs (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'cycle_open',
    'validation_finalize',
    'cycle_close',
    'reminder_dispatch',
    'organization_import',
    'respondent_import',
    'report_bundle'
  )),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'completed_with_errors', 'failed', 'cancelled')),
  dedupe_key text unique,
  requested_by uuid references auth.users(id),
  executed_by_system boolean not null default false,
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 500),
  scheduled_for timestamptz,
  payload jsonb not null default '{}'::jsonb,
  result_summary jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  locked_at timestamptz,
  locked_by text,
  last_duration_ms integer check (last_duration_ms is null or last_duration_ms >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_job_items (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.automation_jobs(id) on delete cascade,
  entity_type text not null,
  entity_id text not null,
  idempotency_key text,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'skipped', 'failed')),
  message text,
  input jsonb not null default '{}'::jsonb
    constraint automation_job_items_no_sensitive_input
    check (not (input ?| array['password','senha','senha_provisoria','recovery_link'])),
  output jsonb not null default '{}'::jsonb
    constraint automation_job_items_no_sensitive_output
    check (not (output ?| array['password','senha','senha_provisoria','recovery_link'])),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, entity_type, entity_id)
);

create table public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null,
  title text not null,
  message text not null,
  action_path text,
  dedupe_key text,
  visible_at timestamptz not null default now(),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid references auth.users(id) on delete cascade,
  recipient_email text,
  kind text not null,
  payload jsonb not null,
  dedupe_key text not null unique,
  scheduled_for timestamptz not null default now(),
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  max_attempts integer not null default 5 check (max_attempts between 1 and 25),
  last_error text,
  locked_at timestamptz,
  locked_by text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_outbox_recipient_check
    check (recipient_user_id is not null or nullif(btrim(recipient_email), '') is not null)
);

create table public.api_rate_limits (
  bucket_key text primary key,
  window_started_at timestamptz not null,
  hit_count integer not null check (hit_count >= 0),
  expires_at timestamptz not null,
  updated_at timestamptz not null default now()
);

create table public.respondent_profile_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(user_id) on delete cascade,
  registration_number text,
  organizational_unit text,
  position_title text,
  source_submitted_at timestamptz,
  declaration_text text,
  source_name text not null default 'cadastro_manual',
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  constraint respondent_profile_details_source_name_not_blank
    check (btrim(source_name) <> '')
);

create table public.cycle_reopen_events (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  reopen_number integer not null check (reopen_number >= 1),
  actor_user_id uuid not null references auth.users(id),
  reason text not null check (char_length(btrim(reason)) between 10 and 2000),
  previous_deadline_at timestamptz,
  new_deadline_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique (cycle_id, reopen_number)
);

create table public.cycle_submission_events (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  actor_user_id uuid references auth.users(id),
  from_state public.cycle_state not null,
  to_state public.cycle_state not null,
  submitted_at timestamptz not null,
  response_deadline_at timestamptz,
  was_late boolean not null,
  delay_seconds bigint not null default 0 check (delay_seconds >= 0),
  created_at timestamptz not null default now()
);

create table public.cycle_validation_reopen_events (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  reopen_number integer not null check (reopen_number >= 1),
  actor_user_id uuid not null references auth.users(id),
  reason text not null check (char_length(btrim(reason)) between 10 and 2000),
  from_state public.cycle_state not null,
  to_state public.cycle_state not null,
  previous_cycle_processing_id uuid references public.cycle_processings(id),
  new_cycle_processing_id uuid not null references public.cycle_processings(id),
  previous_validated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (cycle_id, reopen_number),
  check (from_state = 'validated'::public.cycle_state),
  check (to_state = 'in_validation'::public.cycle_state)
);

create table public.response_admin_applicability_events (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  decision text not null check (decision in ('not_applicable', 'reverted')),
  previous_decision text,
  original_answer public.answer_value not null,
  justification text not null check (char_length(btrim(justification)) >= 1),
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  validation_round integer not null default 1 check (validation_round >= 1),
  before_json jsonb,
  after_json jsonb
);

create table public.response_admin_proof_events (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references public.responses(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  decision text not null,
  previous_decision text,
  original_answer public.answer_value not null,
  observation text not null check (char_length(btrim(observation)) >= 1),
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  validation_round integer not null default 1 check (validation_round >= 1),
  before_json jsonb,
  after_json jsonb,
  constraint response_admin_proof_events_decision_check check (
    decision in (
      'validated_without_proof',
      'proof_requested',
      'considered_insufficient',
      'cleared'
    )
  )
);

create table public.cycle_deadline_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  form_id uuid not null references public.forms(id) on delete cascade,
  period_label text not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  action text not null
    check (action in (
      'change_deadline',
      'extend_deadline',
      'early_close',
      'reopen_responses',
      'suspend',
      'resume'
    )),
  scope text not null
    check (scope in ('all', 'selected', 'overdue', 'single')),
  previous_deadline_at timestamptz,
  new_deadline_at timestamptz,
  justification text not null
    check (char_length(btrim(justification)) between 10 and 2000),
  actor_user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.cycle_reopen_allowed_questions (
  reopen_event_id uuid not null
    references public.cycle_reopen_events(id) on delete cascade,
  question_version_id uuid not null
    references public.question_versions(id) on delete restrict,
  primary key (reopen_event_id, question_version_id)
);

create table public.validation_analysis_drafts (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  target_kind text not null,
  evidence_id uuid references public.evidences(id) on delete cascade,
  response_id uuid references public.responses(id) on delete cascade,
  action text,
  justification text,
  notes text,
  revision bigint not null default 1,
  created_by uuid not null references auth.users(id),
  updated_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  applied_at timestamptz,
  constraint validation_analysis_drafts_revision_positive check (revision >= 1),
  constraint validation_analysis_drafts_target_kind_check check (
    target_kind in (
      'evidence',
      'not_applicable',
      'absent_proof',
      'admin_not_applicable'
    )
  ),
  constraint validation_analysis_drafts_target_xor check (
    (
      target_kind = 'evidence'
      and evidence_id is not null
      and response_id is null
    )
    or (
      target_kind in (
        'not_applicable',
        'absent_proof',
        'admin_not_applicable'
      )
      and response_id is not null
      and evidence_id is null
    )
  ),
  constraint validation_analysis_drafts_action_check check (
    action is null
    or (
      target_kind = 'evidence'
      and action in ('approve', 'invalidate', 'request_adjustment')
    )
    or (
      target_kind = 'not_applicable'
      and action in ('approve', 'reject')
    )
    or (
      target_kind = 'absent_proof'
      and action in (
        'validate_without_proof',
        'request_proof',
        'consider_insufficient'
      )
    )
    or (
      target_kind = 'admin_not_applicable'
      and action in ('mark', 'revert')
    )
  )
);

create table public.form_periods (
  id uuid primary key default gen_random_uuid(),
  form_version_id uuid not null references public.form_versions(id) on delete restrict,
  period_code text not null,
  label text not null,
  response_deadline_at timestamptz,
  starts_at timestamptz,
  status text not null default 'open'
    check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint form_periods_code_unique unique (form_version_id, period_code),
  constraint form_periods_code_nonempty
    check (char_length(btrim(period_code)) > 0),
  constraint form_periods_label_nonempty
    check (char_length(btrim(label)) > 0),
  constraint form_periods_schedule_order_check
    check (
      starts_at is null
      or response_deadline_at is null
      or response_deadline_at >= starts_at
    )
);

create table public.fami_preliminary_processings (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  source_cycle_processing_id uuid not null,
  source_processing_version integer not null check (source_processing_version >= 1),
  source_policy_version text not null,
  reference_year integer not null check (reference_year between 1900 and 2100),
  quadrimester smallint not null check (quadrimester between 1 and 3),
  calculation_version integer not null check (calculation_version >= 1),
  methodology_version text not null default 'prelim_v1'
    check (methodology_version = 'prelim_v1'),
  period_start date not null,
  period_end date not null,
  calculated_by uuid not null references auth.users(id) on delete restrict,
  calculated_at timestamptz not null default now(),
  constraint fami_preliminary_processings_period_check
    check (
      (quadrimester = 1 and period_start = make_date(reference_year, 1, 1) and period_end = make_date(reference_year, 4, 30))
      or (quadrimester = 2 and period_start = make_date(reference_year, 5, 1) and period_end = make_date(reference_year, 8, 31))
      or (quadrimester = 3 and period_start = make_date(reference_year, 9, 1) and period_end = make_date(reference_year, 12, 31))
    ),
  constraint fami_preliminary_processings_source_fkey
    foreign key (source_cycle_processing_id, cycle_id)
    references public.cycle_processings(id, cycle_id) on delete cascade,
  constraint fami_preliminary_processings_version_unique
    unique (cycle_id, reference_year, quadrimester, calculation_version)
);

create table public.fami_preliminary_action_snapshots (
  id uuid primary key default gen_random_uuid(),
  preliminary_processing_id uuid not null
    references public.fami_preliminary_processings(id) on delete cascade,
  action_plan_id uuid not null references public.action_plans(id) on delete restrict,
  recommendation_id uuid not null references public.recommendations(id) on delete restrict,
  status public.action_plan_status not null,
  progress_percentage integer not null check (progress_percentage between 0 and 100),
  effective_at timestamptz not null,
  captured_at timestamptz not null default now(),
  unique (preliminary_processing_id, action_plan_id)
);

create table public.fami_preliminary_criterion_results (
  id uuid primary key default gen_random_uuid(),
  preliminary_processing_id uuid not null
    references public.fami_preliminary_processings(id) on delete cascade,
  question_version_id uuid not null references public.question_versions(id) on delete restrict,
  section_id uuid not null references public.sections(id) on delete restrict,
  axis_id uuid not null references public.axes(id) on delete restrict,
  recommendation_id uuid references public.recommendations(id) on delete restrict,
  approved_exception_id uuid references public.recommendation_exceptions(id) on delete restrict,
  included_in_calculation boolean not null,
  official_points numeric(10,4) not null,
  points_possible numeric(10,4) not null,
  recoverable_gap numeric(10,4) not null,
  active_action_count integer not null check (active_action_count >= 0),
  action_progress_percentage numeric(7,4) not null
    check (action_progress_percentage between 0 and 100),
  recovered_points numeric(10,4) not null,
  preliminary_points numeric(10,4) not null,
  created_at timestamptz not null default now(),
  constraint fami_preliminary_criterion_points_check check (
    official_points >= 0
    and points_possible >= 0
    and official_points <= points_possible
    and recoverable_gap = points_possible - official_points
    and recovered_points >= 0
    and recovered_points <= recoverable_gap
    and preliminary_points = official_points + recovered_points
    and preliminary_points <= points_possible
  ),
  constraint fami_preliminary_criterion_exclusion_check check (
    included_in_calculation
    or (
      official_points = 0
      and points_possible = 0
      and recoverable_gap = 0
      and recovered_points = 0
      and preliminary_points = 0
    )
  ),
  constraint fami_preliminary_criterion_exception_check check (
    approved_exception_id is null
    or (active_action_count = 0 and action_progress_percentage = 0 and recovered_points = 0)
  ),
  unique (preliminary_processing_id, question_version_id)
);

create table public.fami_preliminary_results (
  id uuid primary key default gen_random_uuid(),
  preliminary_processing_id uuid not null
    references public.fami_preliminary_processings(id) on delete cascade,
  cycle_id uuid not null references public.cycles(id) on delete cascade,
  scope_type text not null check (scope_type in ('section', 'axis', 'global')),
  scope_id uuid,
  points_obtained numeric(10,2) not null,
  points_possible numeric(10,2) not null,
  percentage numeric(5,2) not null,
  maturity_level smallint check (maturity_level is null or maturity_level between 1 and 5),
  created_at timestamptz not null default now(),
  constraint fami_preliminary_results_scope_identity_check check (
    (scope_type = 'global' and scope_id is null)
    or (scope_type in ('section', 'axis') and scope_id is not null)
  ),
  constraint fami_preliminary_results_points_check check (
    points_obtained >= 0
    and points_possible >= 0
    and points_obtained <= points_possible
    and percentage between 0 and 100
  ),
  constraint fami_preliminary_results_calculation_check check (
    (
      points_possible = 0
      and points_obtained = 0
      and percentage = 0
      and maturity_level is null
    )
    or (
      points_possible > 0
      and maturity_level is not null
      and percentage = round((points_obtained / points_possible) * 100, 2)
      and maturity_level = case
        when percentage <= 20 then 1
        when percentage <= 40 then 2
        when percentage <= 60 then 3
        when percentage <= 80 then 4
        else 5
      end
    )
  )
);

alter table public.responses replica identity full;

alter table public.action_plans replica identity full;

alter table public.action_plan_documents replica identity full;

create unique index organizations_acronym_unique_idx
  on public.organizations (upper(acronym));

create unique index profiles_single_global_admin_idx
  on public.profiles (role)
  where role = 'admin';

create index sections_axis_ordem_idx on public.sections(axis_id, ordem);

create index questions_section_idx on public.questions(section_id);

create index question_versions_question_idx on public.question_versions(question_id);

create unique index form_draft_questions_order_unique_idx
  on public.form_draft_questions(form_draft_id, order_index);

create index form_versions_form_idx on public.form_versions(form_id);

create index form_questions_order_idx
  on public.form_questions(form_version_id, order_index);

create index form_assignments_form_idx on public.form_assignments(form_id);

create index form_assignments_org_idx on public.form_assignments(organization_id);

create index cycles_form_version_idx on public.cycles(form_version_id);

create index cycles_org_idx on public.cycles(organization_id);

create index cycles_state_idx on public.cycles(state);

create unique index cycle_processings_one_working_idx
  on public.cycle_processings(cycle_id)
  where status = 'working';

create index cycle_processings_cycle_idx
  on public.cycle_processings(cycle_id, processing_version desc);

create index cycles_org_state_period_idx
  on public.cycles (organization_id, state, period_label desc);

create index responses_cycle_idx on public.responses(cycle_id, updated_at desc);

create index evidences_response_idx on public.evidences(response_id, submitted_at desc);

create index evidences_active_response_submitted_idx
  on public.evidences(response_id, submitted_at, id)
  where deactivated_at is null;

create index pending_evidence_uploads_cleanup_idx
  on public.pending_evidence_uploads(expires_at);

create index pending_evidence_uploads_scope_idx
  on public.pending_evidence_uploads(cycle_id, organization_id, uploaded_by);

create index evidence_storage_cleanup_queue_schedule_idx
  on public.evidence_storage_cleanup_queue(scheduled_for, created_at);

create index response_snapshots_processing_idx
  on public.response_snapshots(cycle_processing_id);

create index evidence_snapshots_processing_idx
  on public.evidence_snapshots(cycle_processing_id);

create index evidence_snapshots_response_idx
  on public.evidence_snapshots(response_snapshot_id);

create index processing_waiver_snapshots_processing_idx
  on public.processing_waiver_snapshots(cycle_processing_id);

create index evidences_active_validation_submitted_idx
  on public.evidences (validation_status, submitted_at desc, id desc)
  where deactivated_at is null;

create index question_organization_waivers_org_idx
  on public.question_organization_waivers(organization_id);

create index recommendations_cycle_idx on public.recommendations(cycle_id);

create index recommendations_processing_idx on public.recommendations(cycle_processing_id);

create index action_plans_recommendation_idx on public.action_plans(recommendation_id);

create index action_plans_axis_idx on public.action_plans(axis_id);

create index action_plans_status_idx on public.action_plans(status);

create index action_plan_progress_updates_plan_idx
  on public.action_plan_progress_updates(action_plan_id, created_at desc);

create index action_plan_documents_action_idx
  on public.action_plan_documents(action_plan_id, action_revision, created_at desc);

create index action_plan_documents_validation_idx
  on public.action_plan_documents(file_validation_status, created_at)
  where kind = 'file' and deactivated_at is null;

create unique index action_plan_documents_active_storage_path_uidx
  on public.action_plan_documents(storage_path)
  where storage_path is not null and deactivated_at is null;

create index pending_action_plan_document_uploads_expiration_idx
  on public.pending_action_plan_document_uploads(expires_at, created_at);

create index pending_action_plan_document_uploads_scope_idx
  on public.pending_action_plan_document_uploads(
    action_plan_id,
    organization_id,
    uploaded_by,
    action_revision
  );

create index action_plan_storage_cleanup_queue_schedule_idx
  on public.action_plan_storage_cleanup_queue(scheduled_for, created_at);

create index fami_results_cycle_idx on public.fami_results(cycle_id);

create index fami_results_processing_scope_idx
  on public.fami_results(cycle_processing_id, scope_type);

create unique index fami_results_scoped_unique
  on public.fami_results(cycle_processing_id, scope_type, scope_id)
  where scope_id is not null;

create unique index fami_results_global_unique
  on public.fami_results(cycle_processing_id, scope_type)
  where scope_id is null;

create index reports_cycle_idx on public.reports(cycle_id);

create index reports_processing_version_idx
  on public.reports(cycle_processing_id, emission_version desc);

create index library_recommendations_status_idx on public.library_recommendations(status);

create index library_recommendations_tags_idx
  on public.library_recommendations using gin (tags);

create index library_item_versions_latest_idx
  on public.library_item_versions(item_type, item_id, published_at desc);

create index recommendation_exceptions_org_idx
  on public.recommendation_exceptions(organization_id, created_at desc);

create unique index recommendation_exceptions_one_active_uidx
  on public.recommendation_exceptions(recommendation_id)
  where status in ('requested', 'approved');

create index action_plan_supervision_notes_recommendation_idx
  on public.action_plan_supervision_notes(recommendation_id, created_at desc);

create index action_plan_supervision_notes_action_idx
  on public.action_plan_supervision_notes(action_plan_id, created_at desc)
  where action_plan_id is not null;

create index action_plan_supervision_notes_open_idx
  on public.action_plan_supervision_notes(action_plan_id, lifecycle_status, created_at desc)
  where lifecycle_status in ('open', 'acknowledged');

create index audit_logs_entity_idx on public.audit_logs(entity_type, record_id, created_at desc);

create index audit_logs_actor_idx on public.audit_logs(actor_user_id, created_at desc);

create index library_audit_events_entity_idx
  on public.library_audit_events(entity, item_id);

create index library_audit_events_created_idx
  on public.library_audit_events(created_at desc);

create index automation_jobs_claim_idx
  on public.automation_jobs(status, scheduled_for, created_at)
  where status = 'pending';

create index automation_job_items_job_status_idx
  on public.automation_job_items(job_id, status);

create unique index automation_job_items_idempotency_idx
  on public.automation_job_items(job_id, idempotency_key)
  where idempotency_key is not null;

create unique index user_notifications_dedupe_idx
  on public.user_notifications(user_id, dedupe_key);

create index user_notifications_unread_idx
  on public.user_notifications(user_id, visible_at, created_at desc)
  where read_at is null;

create index notification_outbox_claim_idx
  on public.notification_outbox(status, scheduled_for)
  where status = 'pending';

create index profiles_org_role_created_idx
  on public.profiles(organization_id, role, created_at desc);

create index cycles_state_deadline_idx
  on public.cycles(state, response_deadline_at)
  where state in ('in_response', 'awaiting_adjustment');

create index cycles_period_created_idx
  on public.cycles(period_label desc, created_at desc, id desc);

create index recommendations_processing_created_idx
  on public.recommendations(cycle_processing_id, created_at desc, id desc);

create index action_plans_status_due_idx
  on public.action_plans(status, due_date, recommendation_id);

create index evidences_active_submitted_idx
  on public.evidences(submitted_at desc, id desc)
  where deactivated_at is null;

create index organizations_name_trgm_idx
  on public.organizations using gin (name extensions.gin_trgm_ops);

create index organizations_acronym_trgm_idx
  on public.organizations using gin (acronym extensions.gin_trgm_ops);

create index forms_name_trgm_idx
  on public.forms using gin (name extensions.gin_trgm_ops);

create index profiles_full_name_trgm_idx
  on public.profiles using gin (full_name extensions.gin_trgm_ops);

create index question_versions_prompt_trgm_idx
  on public.question_versions using gin (prompt extensions.gin_trgm_ops);

create index recommendations_text_trgm_idx
  on public.recommendations using gin (text extensions.gin_trgm_ops);

create index action_plans_action_text_trgm_idx
  on public.action_plans using gin (action_text extensions.gin_trgm_ops);

create index action_plans_responsible_label_trgm_idx
  on public.action_plans using gin (responsible_label extensions.gin_trgm_ops);

create index evidences_original_filename_trgm_idx
  on public.evidences using gin (original_filename extensions.gin_trgm_ops);

create index automation_jobs_retry_claim_idx
  on public.automation_jobs(status, scheduled_for, created_at)
  where status in ('pending', 'failed');

create index notification_outbox_retry_claim_idx
  on public.notification_outbox(status, scheduled_for, created_at)
  where status in ('pending', 'failed');

create index api_rate_limits_expiry_idx on public.api_rate_limits(expires_at);

create index cycle_reopen_events_cycle_idx
  on public.cycle_reopen_events(cycle_id, reopen_number desc);

create index cycle_submission_events_cycle_idx
  on public.cycle_submission_events(cycle_id, submitted_at desc);

create index evidences_file_validation_idx
  on public.evidences(file_validation_status, submitted_at)
  where kind = 'file'::public.evidence_kind
    and file_validation_status <> 'valid';

create index cycle_validation_reopen_events_cycle_idx
  on public.cycle_validation_reopen_events(cycle_id, reopen_number desc);

create index response_admin_applicability_events_response_idx
  on public.response_admin_applicability_events(response_id, decided_at desc);

create index response_admin_applicability_events_cycle_idx
  on public.response_admin_applicability_events(cycle_id, decided_at desc);

create index if not exists response_admin_proof_events_response_idx
  on public.response_admin_proof_events(response_id, decided_at desc);

create index if not exists response_admin_proof_events_cycle_idx
  on public.response_admin_proof_events(cycle_id, decided_at desc);

create index if not exists cycle_deadline_events_form_period_idx
  on public.cycle_deadline_events(form_id, period_label, created_at desc);

create index if not exists cycle_deadline_events_cycle_idx
  on public.cycle_deadline_events(cycle_id, created_at desc);

create index if not exists cycle_deadline_events_batch_idx
  on public.cycle_deadline_events(batch_id);

create index if not exists cycle_reopen_allowed_questions_qv_idx
  on public.cycle_reopen_allowed_questions(question_version_id);

create unique index validation_analysis_drafts_active_unique
  on public.validation_analysis_drafts (
    cycle_id,
    target_kind,
    coalesce(evidence_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(response_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where applied_at is null;

create index validation_analysis_drafts_cycle_idx
  on public.validation_analysis_drafts(cycle_id, updated_at desc);

create index validation_analysis_drafts_evidence_idx
  on public.validation_analysis_drafts(evidence_id)
  where evidence_id is not null;

create index validation_analysis_drafts_response_idx
  on public.validation_analysis_drafts(response_id)
  where response_id is not null;

create index if not exists form_periods_form_version_idx on public.form_periods(form_version_id);

create index if not exists form_periods_period_code_idx on public.form_periods(period_code);

create index if not exists cycles_period_id_idx on public.cycles(period_id);

create index if not exists action_plan_progress_updates_plan_idx
  on public.action_plan_progress_updates(action_plan_id, created_at desc);

create index fami_preliminary_processings_cycle_period_idx
  on public.fami_preliminary_processings(
    cycle_id,
    reference_year desc,
    quadrimester desc,
    calculation_version desc
  );

create index fami_preliminary_action_snapshots_recommendation_idx
  on public.fami_preliminary_action_snapshots(preliminary_processing_id, recommendation_id);

create index fami_preliminary_criterion_results_scope_idx
  on public.fami_preliminary_criterion_results(preliminary_processing_id, axis_id, section_id);

create unique index fami_preliminary_results_scoped_unique
  on public.fami_preliminary_results(preliminary_processing_id, scope_type, scope_id)
  where scope_id is not null;

create unique index fami_preliminary_results_global_unique
  on public.fami_preliminary_results(preliminary_processing_id, scope_type)
  where scope_id is null;

create index fami_preliminary_results_cycle_idx
  on public.fami_preliminary_results(cycle_id, created_at desc);
