-- ORIENTA greenfield baseline — RLS, políticas, grants e revokes finais
-- Gerada a partir do estado final pré-cutover; não contém dados históricos reais.

alter table public.library_audit_events enable row level security;

alter table public.organizations               enable row level security;

alter table public.profiles                    enable row level security;

alter table public.axes                        enable row level security;

alter table public.sections                    enable row level security;

alter table public.questions                   enable row level security;

alter table public.question_versions           enable row level security;

alter table public.forms                        enable row level security;

alter table public.form_drafts                 enable row level security;

alter table public.form_draft_questions        enable row level security;

alter table public.form_versions               enable row level security;

alter table public.form_questions              enable row level security;

alter table public.form_assignments            enable row level security;

alter table public.cycles                      enable row level security;

alter table public.cycle_processings           enable row level security;

alter table public.responses                   enable row level security;

alter table public.evidences                   enable row level security;

alter table public.pending_evidence_uploads   enable row level security;

alter table public.evidence_storage_cleanup_queue enable row level security;

alter table public.response_snapshots          enable row level security;

alter table public.evidence_snapshots          enable row level security;

alter table public.processing_waiver_snapshots enable row level security;

alter table public.question_organization_waivers enable row level security;

alter table public.recommendations             enable row level security;

alter table public.action_plans                enable row level security;

alter table public.action_plan_progress_updates enable row level security;

alter table public.action_plan_documents       enable row level security;

alter table public.pending_action_plan_document_uploads enable row level security;

alter table public.action_plan_storage_cleanup_queue enable row level security;

alter table public.fami_results                enable row level security;

alter table public.reports                     enable row level security;

alter table public.library_recommendations          enable row level security;

alter table public.library_item_versions            enable row level security;

alter table public.question_library_binding         enable row level security;

alter table public.recommendation_exceptions        enable row level security;

alter table public.action_plan_supervision_notes    enable row level security;

alter table public.audit_logs                       enable row level security;

alter table public.automation_jobs enable row level security;

alter table public.automation_job_items enable row level security;

alter table public.user_notifications enable row level security;

alter table public.notification_outbox enable row level security;

alter table public.api_rate_limits enable row level security;

alter table public.respondent_profile_details enable row level security;

alter table public.cycle_reopen_events enable row level security;

alter table public.cycle_submission_events enable row level security;

alter table public.cycle_validation_reopen_events enable row level security;

alter table public.response_admin_applicability_events enable row level security;

alter table public.response_admin_proof_events enable row level security;

alter table public.cycle_deadline_events enable row level security;

alter table public.cycle_reopen_allowed_questions enable row level security;

alter table public.validation_analysis_drafts enable row level security;

alter table public.form_periods enable row level security;

alter table public.fami_preliminary_processings enable row level security;

alter table public.fami_preliminary_action_snapshots enable row level security;

alter table public.fami_preliminary_criterion_results enable row level security;

alter table public.fami_preliminary_results enable row level security;

create policy organizations_read_scoped on public.organizations
  for select to authenticated
  using (app_private.is_admin() or id = app_private.current_organization_id());

create policy axes_read on public.axes for select to authenticated using (true);

create policy sections_read on public.sections for select to authenticated using (true);

create policy questions_read on public.questions for select to authenticated using (true);

create policy question_versions_read on public.question_versions
  for select to authenticated using (true);

create policy forms_read on public.forms for select to authenticated using (true);

create policy form_drafts_admin on public.form_drafts
  for all to authenticated using (app_private.is_admin()) with check (app_private.is_admin());

create policy form_draft_questions_admin on public.form_draft_questions
  for all to authenticated using (app_private.is_admin()) with check (app_private.is_admin());

create policy form_versions_read on public.form_versions
  for select to authenticated using (true);

create policy form_questions_read on public.form_questions
  for select to authenticated using (true);

create policy cycles_read_scoped on public.cycles
  for select to authenticated
  using (app_private.is_admin() or organization_id = app_private.current_organization_id());

create policy cycle_processings_read_scoped on public.cycle_processings
  for select to authenticated
  using (app_private.is_admin() or cycle_id in (
    select c.id from public.cycles c
    where c.organization_id = app_private.current_organization_id()
  ));

create policy responses_read_scoped on public.responses
  for select to authenticated
  using (
    app_private.is_admin()
    or exists (
      select 1
      from public.cycles c
      where c.id = responses.cycle_id
        and c.organization_id = app_private.current_organization_id()
    )
  );

create policy evidences_read_scoped on public.evidences
  for select to authenticated
  using (
    app_private.is_admin()
    or exists (
      select 1
      from public.responses r
      join public.cycles c on c.id = r.cycle_id
      where r.id = evidences.response_id
        and c.organization_id = app_private.current_organization_id()
    )
  );

create policy response_snapshots_read on public.response_snapshots
  for select to authenticated
  using (app_private.is_admin() or cycle_processing_id in (
    select cp.id from public.cycle_processings cp
    join public.cycles c on c.id = cp.cycle_id
    where c.organization_id = app_private.current_organization_id()));

create policy evidence_snapshots_read on public.evidence_snapshots
  for select to authenticated
  using (app_private.is_admin() or cycle_processing_id in (
    select cp.id from public.cycle_processings cp
    join public.cycles c on c.id = cp.cycle_id
    where c.organization_id = app_private.current_organization_id()));

create policy processing_waiver_snapshots_read on public.processing_waiver_snapshots
  for select to authenticated
  using (app_private.is_admin() or cycle_processing_id in (
    select cp.id from public.cycle_processings cp
    join public.cycles c on c.id = cp.cycle_id
    where c.organization_id = app_private.current_organization_id()));

create policy waivers_read_scoped on public.question_organization_waivers
  for select to authenticated
  using (app_private.is_admin() or organization_id = app_private.current_organization_id());

create policy recommendations_read_scoped on public.recommendations
  for select to authenticated
  using (
    app_private.is_current_official_recommendation(id)
    and (
      app_private.is_admin()
      or cycle_id in (
        select c.id from public.cycles c
        where c.organization_id = app_private.current_organization_id()
      )
    )
  );

create policy action_plans_read_scoped on public.action_plans
  for select to authenticated
  using (
    app_private.is_current_official_recommendation(recommendation_id)
    and (
      app_private.is_admin()
      or recommendation_id in (
        select rec.id from public.recommendations rec
        join public.cycles c on c.id = rec.cycle_id
        where c.organization_id = app_private.current_organization_id()
      )
    )
  );

create policy action_plan_progress_updates_read_scoped
  on public.action_plan_progress_updates
  for select to authenticated
  using (
    exists (
      select 1
      from public.action_plans ap
      where ap.id = action_plan_id
        and app_private.is_current_official_recommendation(ap.recommendation_id)
        and (
          app_private.is_admin()
          or ap.recommendation_id in (
            select rec.id from public.recommendations rec
            join public.cycles c on c.id = rec.cycle_id
            where c.organization_id = app_private.current_organization_id()
          )
        )
    )
  );

create policy action_plan_documents_read_scoped on public.action_plan_documents
  for select to authenticated
  using (
    deactivated_at is null
    and (
      app_private.is_admin()
      or organization_id = app_private.current_organization_id()
    )
  );

create policy fami_results_read_scoped on public.fami_results
  for select to authenticated
  using (app_private.is_admin() or cycle_id in (
    select c.id from public.cycles c
    where c.organization_id = app_private.current_organization_id()));

create policy reports_read_scoped on public.reports
  for select to authenticated
  using (
    app_private.is_admin()
    or (
      status in ('completed', 'legacy')
      and cycle_id in (
        select c.id
        from public.cycles c
        where c.organization_id = app_private.current_organization_id()
      )
    )
  );

create policy library_recommendations_admin on public.library_recommendations
  for all to authenticated using (app_private.is_admin()) with check (app_private.is_admin());

create policy audit_logs_admin_read on public.audit_logs
  for select to authenticated using (app_private.is_admin());

create policy library_audit_events_read on public.library_audit_events
  for select to authenticated using (app_private.is_admin());

create policy question_library_binding_admin_read on public.question_library_binding
  for select to authenticated using (app_private.is_admin());

create policy library_item_versions_admin_read on public.library_item_versions
  for select to authenticated using (app_private.is_admin());

create policy recommendation_exceptions_read_scoped on public.recommendation_exceptions
  for select to authenticated
  using (app_private.is_admin() or organization_id = app_private.current_organization_id());

create policy action_plan_supervision_notes_read_scoped on public.action_plan_supervision_notes
  for select to authenticated
  using (
    app_private.is_current_official_recommendation(recommendation_id)
    and (
      app_private.is_admin()
      or recommendation_id in (
        select r.id from public.recommendations r
        join public.cycles c on c.id = r.cycle_id
        where c.organization_id = app_private.current_organization_id()
      )
    )
  );

create policy automation_jobs_admin_read on public.automation_jobs
  for select to authenticated using (app_private.is_admin());

create policy automation_job_items_admin_read on public.automation_job_items
  for select to authenticated using (app_private.is_admin());

create policy notification_outbox_admin_read on public.notification_outbox
  for select to authenticated using (app_private.is_admin());

create policy cycle_reopen_events_admin_read
  on public.cycle_reopen_events for select to authenticated
  using (app_private.is_admin());

create policy cycle_submission_events_scope_read
  on public.cycle_submission_events for select to authenticated
  using (
    app_private.is_admin()
    or cycle_id in (
      select c.id from public.cycles c
      where c.organization_id = app_private.current_organization_id()
    )
  );

create policy cycle_validation_reopen_events_admin_read
  on public.cycle_validation_reopen_events for select to authenticated
  using (app_private.is_admin());

create policy response_admin_applicability_events_admin_read
  on public.response_admin_applicability_events for select to authenticated
  using (app_private.is_admin());

create policy response_admin_proof_events_admin_read
  on public.response_admin_proof_events for select to authenticated
  using (app_private.is_admin());

create policy cycle_deadline_events_admin_read
  on public.cycle_deadline_events for select to authenticated
  using (app_private.is_admin());

create policy validation_analysis_drafts_admin_read
  on public.validation_analysis_drafts
  for select to authenticated
  using (app_private.is_admin());

create policy form_periods_read_scoped on public.form_periods
  for select to authenticated
  using (
    app_private.is_admin()
    or exists (
      select 1
      from public.cycles c
      where c.period_id = form_periods.id
        and c.organization_id = app_private.current_organization_id()
    )
  );

create policy fami_preliminary_processings_read_scoped
  on public.fami_preliminary_processings for select to authenticated
  using (
    app_private.is_admin()
    or cycle_id in (
      select c.id from public.cycles c
      where c.organization_id = app_private.current_organization_id()
    )
  );

create policy fami_preliminary_action_snapshots_read_scoped
  on public.fami_preliminary_action_snapshots for select to authenticated
  using (
    preliminary_processing_id in (
      select fp.id from public.fami_preliminary_processings fp
      join public.cycles c on c.id = fp.cycle_id
      where app_private.is_admin() or c.organization_id = app_private.current_organization_id()
    )
  );

create policy fami_preliminary_criterion_results_read_scoped
  on public.fami_preliminary_criterion_results for select to authenticated
  using (
    preliminary_processing_id in (
      select fp.id from public.fami_preliminary_processings fp
      join public.cycles c on c.id = fp.cycle_id
      where app_private.is_admin() or c.organization_id = app_private.current_organization_id()
    )
  );

create policy fami_preliminary_results_read_scoped
  on public.fami_preliminary_results for select to authenticated
  using (
    app_private.is_admin()
    or cycle_id in (
      select c.id from public.cycles c
      where c.organization_id = app_private.current_organization_id()
    )
  );

revoke all on function public.set_audit_actor(uuid) from public;

grant execute on function public.set_audit_actor(uuid) to service_role;

revoke all on function public.bootstrap_global_admin(uuid, text) from public;

grant execute on function public.bootstrap_global_admin(uuid, text) to service_role;

revoke all on function public.update_respondent_profile(uuid, text, uuid, uuid) from public;

grant execute on function public.update_respondent_profile(uuid, text, uuid, uuid) to service_role;

revoke all on function public.create_organization_admin(text, text, uuid) from public;

grant execute on function public.create_organization_admin(text, text, uuid) to service_role;

revoke all on function public.create_respondent_profile(uuid, text, text, uuid, uuid) from public;

grant execute on function public.create_respondent_profile(uuid, text, text, uuid, uuid) to service_role;

revoke all on function public.enforce_published_form_has_assignment() from public;

revoke all on function public.prevent_last_published_assignment_removal() from public;

revoke all on function public.replace_question_organization_waivers(
  uuid, uuid[], jsonb, uuid
) from public;

grant execute on function public.replace_question_organization_waivers(
  uuid, uuid[], jsonb, uuid
) to service_role;

revoke all on function public.lock_waiver_active_cycles() from public;

revoke all on function public.lock_action_plan_cycle() from public;

revoke all on function public.enforce_action_plan_axis_matches_recommendation() from public;

revoke all on function public.bump_action_plan_item_revision() from public;

revoke all on function public.enforce_pending_action_plan_document_upload_scope() from public;

revoke all on function public.enforce_action_plan_document_scope() from public;

revoke all on function public.delete_respondent_action_plan(
  uuid, uuid, uuid, uuid, bigint
) from public;

grant execute on function public.delete_respondent_action_plan(
  uuid, uuid, uuid, uuid, bigint
) to service_role;

revoke all on function public.prevent_approved_action_plan_document_change() from public;

revoke all on function public.lock_supervision_cycle(uuid) from public;

revoke all on function public.enforce_action_plan_supervision_note() from public;

revoke all on function public.prevent_action_plan_cancellation_with_open_request() from public;

revoke all on function public.supersede_action_plan_approval_after_change() from public;

revoke all on function public.create_action_plan_supervision_note(
  uuid, uuid, uuid, text, text
) from public;

grant execute on function public.create_action_plan_supervision_note(
  uuid, uuid, uuid, text, text
) to service_role;

revoke all on function public.respond_to_action_plan_supervision_request(uuid, uuid, text) from public;

grant execute on function public.respond_to_action_plan_supervision_request(uuid, uuid, text) to service_role;

revoke all on function public.decide_action_plan_supervision_request(
  uuid, uuid, public.supervision_note_lifecycle_status, text
) from public;

grant execute on function public.decide_action_plan_supervision_request(
  uuid, uuid, public.supervision_note_lifecycle_status, text
) to service_role;

revoke all on function public.cycle_action_plan_supervision_blockers(uuid) from public;

grant execute on function public.cycle_action_plan_supervision_blockers(uuid) to service_role;

revoke all on function public.prevent_audit_event_mutation() from public;

revoke all on function app_private.is_cycle_respondent_editable(uuid) from public;

revoke all on function app_private.is_response_respondent_editable(uuid) from public;

revoke all on function app_private.is_cycle_question_version_allowed(uuid, uuid) from public;

revoke all on function public.guard_response_question_version_in_cycle_form() from public;

grant execute on function app_private.is_cycle_respondent_editable(uuid) to authenticated;

grant execute on function app_private.is_response_respondent_editable(uuid) to authenticated;

grant execute on function app_private.is_cycle_question_version_allowed(uuid, uuid) to authenticated;

revoke all on function app_private.is_current_official_recommendation(uuid) from public;

grant execute on function app_private.is_current_official_recommendation(uuid)
  to authenticated, service_role;

revoke all on function public.initialize_action_plan_document_upload(
  uuid, uuid, uuid, uuid, bigint, text, text, text, text, bigint, timestamptz
) from public;

grant execute on function public.initialize_action_plan_document_upload(
  uuid, uuid, uuid, uuid, bigint, text, text, text, text, bigint, timestamptz
) to service_role;

revoke all on function public.commit_action_plan_document_upload(
  uuid, uuid, uuid, uuid, bigint, text
) from public;

grant execute on function public.commit_action_plan_document_upload(
  uuid, uuid, uuid, uuid, bigint, text
) to service_role;

revoke all on function public.discard_pending_action_plan_document_upload(
  uuid, uuid, uuid, uuid
) from public;

grant execute on function public.discard_pending_action_plan_document_upload(
  uuid, uuid, uuid, uuid
) to service_role;

revoke all on function public.deactivate_action_plan_document(
  uuid, uuid, uuid, uuid, bigint, text
) from public;

grant execute on function public.deactivate_action_plan_document(
  uuid, uuid, uuid, uuid, bigint, text
) to service_role;

revoke all on function public.match_evidence_adjustment_replacements(uuid) from public;

grant execute on function public.match_evidence_adjustment_replacements(uuid) to service_role;

revoke all on function public.remove_workbench_evidence_item(
  uuid, uuid, uuid, uuid, bigint
) from public;

grant execute on function public.remove_workbench_evidence_item(
  uuid, uuid, uuid, uuid, bigint
) to service_role;

revoke all on function public.create_or_open_cycles_batch(
  uuid, uuid[], text, uuid, timestamptz, timestamptz
) from public;

grant execute on function public.create_or_open_cycles_batch(
  uuid, uuid[], text, uuid, timestamptz, timestamptz
) to service_role;

revoke all on function public.reorder_form_draft_questions(uuid, uuid[]) from public;

grant execute on function public.reorder_form_draft_questions(uuid, uuid[]) to service_role;

revoke all on function public.create_form_with_draft(text, uuid) from public;

grant execute on function public.create_form_with_draft(text, uuid) to service_role;

revoke all on function public.create_form_draft_question(uuid, uuid, text, jsonb, uuid) from public;

grant execute on function public.create_form_draft_question(uuid, uuid, text, jsonb, uuid) to service_role;

revoke all on function public.delete_unpublished_form(uuid, uuid) from public;

grant execute on function public.delete_unpublished_form(uuid, uuid) to service_role;

revoke all on function public.sync_form_assignments(uuid, uuid[], uuid) from public;

grant execute on function public.sync_form_assignments(uuid, uuid[], uuid) to service_role;

revoke all on function public.remove_form_draft_question(uuid, uuid, uuid) from public;

grant execute on function public.remove_form_draft_question(uuid, uuid, uuid) to service_role;


-- Policies canônicas consolidadas: uma policy de leitura por papel/escopo e
-- writes administrativos separados por comando, evitando permissive policies duplicadas.
create policy profiles_read on public.profiles
  for select to authenticated
  using ((select app_private.is_admin()) or user_id = (select auth.uid()));
create policy profiles_self_update on public.profiles
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy respondent_profile_details_read on public.respondent_profile_details
  for select to authenticated
  using ((select app_private.is_admin()) or user_id = (select auth.uid()));

create policy user_notifications_self_read on public.user_notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy user_notifications_self_update on public.user_notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy cycle_reopen_allowed_questions_read on public.cycle_reopen_allowed_questions
  for select to authenticated
  using (
    (select app_private.is_admin())
    or exists (
      select 1
      from public.cycle_reopen_events e
      join public.cycles c on c.id = e.cycle_id
      where e.id = cycle_reopen_allowed_questions.reopen_event_id
        and c.organization_id = (select app_private.current_organization_id())
    )
  );

create policy form_assignments_read on public.form_assignments
  for select to authenticated
  using (
    (select app_private.is_admin())
    or ((select app_private.is_respondent()) and organization_id = (select app_private.current_organization_id()))
  );
create policy form_assignments_insert_admin on public.form_assignments
  for insert to authenticated with check ((select app_private.is_admin()));
create policy form_assignments_update_admin on public.form_assignments
  for update to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
create policy form_assignments_delete_admin on public.form_assignments
  for delete to authenticated using ((select app_private.is_admin()));

create policy form_versions_insert_admin on public.form_versions for insert to authenticated with check ((select app_private.is_admin()));
create policy form_versions_update_admin on public.form_versions for update to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
create policy form_versions_delete_admin on public.form_versions for delete to authenticated using ((select app_private.is_admin()));
create policy forms_insert_admin on public.forms for insert to authenticated with check ((select app_private.is_admin()));
create policy forms_update_admin on public.forms for update to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
create policy forms_delete_admin on public.forms for delete to authenticated using ((select app_private.is_admin()));
create policy questions_insert_admin on public.questions for insert to authenticated with check ((select app_private.is_admin()));
create policy questions_update_admin on public.questions for update to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
create policy questions_delete_admin on public.questions for delete to authenticated using ((select app_private.is_admin()));
create policy sections_insert_admin on public.sections for insert to authenticated with check ((select app_private.is_admin()));
create policy sections_update_admin on public.sections for update to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
create policy sections_delete_admin on public.sections for delete to authenticated using ((select app_private.is_admin()));
create policy waivers_insert_admin on public.question_organization_waivers for insert to authenticated with check ((select app_private.is_admin()));
create policy waivers_update_admin on public.question_organization_waivers for update to authenticated using ((select app_private.is_admin())) with check ((select app_private.is_admin()));
create policy waivers_delete_admin on public.question_organization_waivers for delete to authenticated using ((select app_private.is_admin()));

grant usage on schema public to authenticated, service_role;

revoke insert, update, delete, truncate on all tables in schema public from authenticated;

grant select on all tables in schema public to authenticated;

grant select, insert, update, delete on all tables in schema public to service_role;

revoke update, delete, truncate on table
  public.audit_logs,
  public.library_audit_events
from service_role;

grant select, insert on table
  public.audit_logs,
  public.library_audit_events
to service_role;

grant update (full_name, preferences) on public.profiles to authenticated;

revoke usage, select on all sequences in schema public from authenticated;

grant usage, select on all sequences in schema public to service_role;

revoke all on function public.create_cycle(
  uuid, uuid, text, uuid, timestamptz, timestamptz
) from public;

grant execute on function public.create_cycle(
  uuid, uuid, text, uuid, timestamptz, timestamptz
) to service_role;

revoke all on function public.save_question_library_configuration(
  uuid, uuid, uuid, jsonb, jsonb, jsonb, numeric, uuid
) from public;

grant execute on function public.save_question_library_configuration(
  uuid, uuid, uuid, jsonb, jsonb, jsonb, numeric, uuid
) to service_role;

revoke select, insert, update, delete on storage.objects from authenticated;

revoke all on function public.validate_evidence(uuid, uuid, text, uuid, text, text, timestamptz) from public;

grant execute on function public.validate_evidence(uuid, uuid, text, uuid, text, text, timestamptz) to service_role;

revoke all on function public.validate_not_applicable_response(uuid, uuid, text, uuid, text, text, timestamptz) from public;

grant execute on function public.validate_not_applicable_response(uuid, uuid, text, uuid, text, text, timestamptz) to service_role;

revoke all on function public.create_report_emission(uuid, uuid, text, uuid, timestamptz, text) from public;

grant execute on function public.create_report_emission(uuid, uuid, text, uuid, timestamptz, text) to service_role;

revoke all on function public.enqueue_operational_notifications() from public;

grant execute on function public.enqueue_operational_notifications() to service_role;

revoke all on function public.notify_organization_respondents(
  uuid, text, text, text, text, text, jsonb
) from public;

grant execute on function public.notify_organization_respondents(
  uuid, text, text, text, text, text, jsonb
) to service_role;

revoke all on function public.notify_administrators(
  text, text, text, text, text, jsonb
) from public;

grant execute on function public.notify_administrators(
  text, text, text, text, text, jsonb
) to service_role;

revoke all on function public.notify_cycle_lifecycle() from public;

revoke all on function public.notify_action_plan_change() from public;

revoke all on function public.notify_supervision_note() from public;

revoke all on function public.notify_supervision_request_lifecycle() from public;

revoke all on function public.notify_report_emission() from public;

revoke all on function public.notify_respondent_user(
  uuid, text, text, text, text, text, jsonb
) from public;

grant execute on function public.notify_respondent_user(
  uuid, text, text, text, text, text, jsonb
) to service_role;

revoke all on function public.notify_respondent_open_cycles(uuid, uuid) from public;

grant execute on function public.notify_respondent_open_cycles(uuid, uuid) to service_role;

revoke all on function public.profiles_notify_open_cycles() from public;

revoke all on function public.list_admin_users_page(text, uuid, public.app_user_role, integer, integer) from public;

grant execute on function public.list_admin_users_page(text, uuid, public.app_user_role, integer, integer) to service_role;

revoke all on function public.list_organization_respondents(uuid) from public;

grant execute on function public.list_organization_respondents(uuid) to service_role;

revoke all on public.evidence_operational_view from public, anon, authenticated;

grant select on public.evidence_operational_view to service_role;

revoke all on function public.list_respondent_evidence_filter_options(uuid) from public;

grant execute on function public.list_respondent_evidence_filter_options(uuid) to service_role;

revoke all on function public.get_action_plan_status_metrics(uuid) from public;

grant execute on function public.get_action_plan_status_metrics(uuid) to service_role;

revoke all on function public.claim_automation_jobs(text, text[], integer, interval) from public;

grant execute on function public.claim_automation_jobs(text, text[], integer, interval) to service_role;

revoke all on function public.claim_notification_outbox(text, integer, interval) from public;

grant execute on function public.claim_notification_outbox(text, integer, interval) to service_role;

revoke all on function public.get_cycle_metrics(text, uuid, uuid, public.cycle_state[], text, text) from public;

grant execute on function public.get_cycle_metrics(text, uuid, uuid, public.cycle_state[], text, text) to service_role;

revoke all on public.current_recommendation_read_model from public, anon, authenticated;

grant select on public.current_recommendation_read_model to service_role;

revoke all on function public.list_recommendations_page(uuid, uuid, uuid, uuid, uuid, text, text, integer, integer) from public;

grant execute on function public.list_recommendations_page(uuid, uuid, uuid, uuid, uuid, text, text, integer, integer) to service_role;

revoke all on function public.list_action_plan_recommendations_page(uuid, uuid, uuid, uuid, text, text, text, text, text, text, integer, integer) from public;

grant execute on function public.list_action_plan_recommendations_page(uuid, uuid, uuid, uuid, text, text, text, text, text, text, integer, integer) to service_role;

revoke all on public.form_answer_cycle_read_model from public, anon, authenticated;

grant select on public.form_answer_cycle_read_model to service_role;

revoke all on function public.list_form_answer_respondents_page(uuid, uuid, text, timestamptz, timestamptz, timestamptz, uuid, integer) from public;

grant execute on function public.list_form_answer_respondents_page(uuid, uuid, text, timestamptz, timestamptz, timestamptz, uuid, integer) to service_role;

revoke all on function public.get_form_answers_overview(uuid) from public;

grant execute on function public.get_form_answers_overview(uuid) to service_role;

revoke all on function public.get_form_answers_summary(uuid) from public;

grant execute on function public.get_form_answers_summary(uuid) to service_role;

revoke all on function public.list_form_answer_organization_options(uuid) from public;

grant execute on function public.list_form_answer_organization_options(uuid) to service_role;

revoke all on function public.get_admin_recommendation_monitoring_page(uuid, uuid, uuid, uuid, text, text, date, date, text, text, integer, integer) from public;

grant execute on function public.get_admin_recommendation_monitoring_page(uuid, uuid, uuid, uuid, text, text, date, date, text, text, integer, integer) to service_role;

revoke all on function public.get_admin_action_plan_monitoring_page(uuid, uuid, uuid, text, text, date, date, text, text, integer, integer) from public;

grant execute on function public.get_admin_action_plan_monitoring_page(uuid, uuid, uuid, text, text, date, date, text, text, integer, integer) to service_role;

revoke all on function public.list_open_recommendations_without_plan(uuid, integer, integer) from public;

grant execute on function public.list_open_recommendations_without_plan(uuid, integer, integer) to service_role;

revoke all on function public.validate_evidences_batch(uuid, jsonb, text, uuid, text) from public;

grant execute on function public.validate_evidences_batch(uuid, jsonb, text, uuid, text) to service_role;

revoke all on function public.validate_not_applicable_batch(uuid, jsonb, text, uuid, text) from public;

grant execute on function public.validate_not_applicable_batch(uuid, jsonb, text, uuid, text) to service_role;

revoke all on function public.get_automation_queue_metrics() from public;

grant execute on function public.get_automation_queue_metrics() to service_role;

revoke all on table public.api_rate_limits from anon, authenticated;

grant all on table public.api_rate_limits to service_role;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public;

grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

revoke all on function public.cleanup_operational_data() from public;

grant execute on function public.cleanup_operational_data() to service_role;

revoke all on function public.list_organizations_page(text, integer, integer) from public;

grant execute on function public.list_organizations_page(text, integer, integer) to service_role;

revoke all on function public.list_forms_page(text, text, integer, integer) from public;

grant execute on function public.list_forms_page(text, text, integer, integer) to service_role;

revoke all on function public.list_recommendation_types() from public;

grant execute on function public.list_recommendation_types() to service_role;

revoke all on function public.list_form_assignments_page(uuid[], integer, integer) from public;

grant execute on function public.list_form_assignments_page(uuid[], integer, integer) to service_role;

revoke all on function public.discard_pending_evidence_upload(uuid, uuid, uuid, uuid) from public;

grant execute on function public.discard_pending_evidence_upload(uuid, uuid, uuid, uuid) to service_role;

revoke all on function public.cycles_normalize_reference_period() from public;

revoke all on function public.bump_action_plan_revision() from public;

revoke all on function public.apply_cycle_reference_period_to_batch_result(jsonb, integer, integer, text[]) from public;

revoke all on function public.create_cycles_batch_with_reference(uuid, uuid[], text, integer, integer, uuid, timestamptz, timestamptz) from public;

revoke all on function public.create_or_open_cycles_batch_with_reference(uuid, uuid[], text, integer, integer, uuid, timestamptz, timestamptz) from public;

grant execute on function public.create_cycles_batch_with_reference(uuid, uuid[], text, integer, integer, uuid, timestamptz, timestamptz) to service_role;

grant execute on function public.create_or_open_cycles_batch_with_reference(uuid, uuid[], text, integer, integer, uuid, timestamptz, timestamptz) to service_role;

revoke all on function public.protect_cycle_report_reference_period() from public;

revoke all on function public.protect_report_emission_mutation() from public;

revoke insert, update, delete on public.reports from anon, authenticated, service_role;

revoke all on function public.reserve_report_emission(uuid, uuid, uuid, bigint, timestamptz, text) from public;

revoke all on function public.finalize_report_emission(uuid, text, text, bigint) from public;

revoke all on function public.cancel_report_emission(uuid) from public;

grant execute on function public.reserve_report_emission(uuid, uuid, uuid, bigint, timestamptz, text) to service_role;

grant execute on function public.finalize_report_emission(uuid, text, text, bigint) to service_role;

grant execute on function public.cancel_report_emission(uuid) to service_role;

revoke all on function public.protect_official_report_storage_object() from public;

revoke all on function public.enrich_response_snapshot_na_decision() from public;

revoke all on function public.set_cycle_reference_period(uuid, integer, integer, uuid) from public;

grant execute on function public.set_cycle_reference_period(uuid, integer, integer, uuid) to service_role;

revoke all on function public.list_report_options_page(uuid, uuid, uuid[], text, integer, integer) from public;

grant execute on function public.list_report_options_page(uuid, uuid, uuid[], text, integer, integer) to service_role;

revoke all on function public.upsert_respondent_profile_details(
  uuid, text, text, text, timestamptz, text, text, uuid
) from public;

grant execute on function public.upsert_respondent_profile_details(
  uuid, text, text, text, timestamptz, text, text, uuid
) to service_role;

revoke all on function public.create_or_open_historical_cycle(
  uuid, uuid, text, uuid
) from public;

grant execute on function public.create_or_open_historical_cycle(
  uuid, uuid, text, uuid
) to service_role;

revoke all on function public.advance_historical_cycle_to_validation(
  uuid, uuid, uuid
) from public;

grant execute on function public.advance_historical_cycle_to_validation(
  uuid, uuid, uuid
) to service_role;

revoke all on function public.upsert_question_organization_waiver(
  uuid, uuid, text, uuid
) from public;

grant execute on function public.upsert_question_organization_waiver(
  uuid, uuid, text, uuid
) to service_role;

revoke all on table public.respondent_profile_details from anon, authenticated;

grant select on table public.respondent_profile_details to authenticated;

grant select, insert, update, delete on table public.respondent_profile_details to service_role;

revoke all on function public.list_cycles_page(text, uuid, uuid, public.cycle_state[], text, text, integer, integer) from public;

grant execute on function public.list_cycles_page(text, uuid, uuid, public.cycle_state[], text, text, integer, integer) to service_role;

revoke all on function public.list_cycles_page(
  text, uuid, uuid, public.cycle_state[], text, text, integer, integer
) from public;

grant execute on function public.list_cycles_page(
  text, uuid, uuid, public.cycle_state[], text, text, integer, integer
) to service_role;

grant select on public.cycle_reopen_events to authenticated, service_role;

grant select on public.cycle_submission_events to authenticated, service_role;

revoke insert, update, delete on public.cycle_reopen_events from authenticated;

revoke insert, update, delete on public.cycle_submission_events from authenticated;

revoke all on function public.capture_cycle_submission_deadline() from public;

revoke all on function public.record_cycle_submission_event() from public;

revoke all on function public.cancel_cycle_schedule_jobs(uuid, text) from public;

grant execute on function public.cancel_cycle_schedule_jobs(uuid, text) to service_role;

revoke all on function public.replace_cycle_schedule(uuid, uuid) from public;

grant execute on function public.replace_cycle_schedule(uuid, uuid) to service_role;

revoke all on function public.prepare_cycle_schedule_registration(uuid[], integer[], timestamptz, timestamptz, uuid) from public;

grant execute on function public.prepare_cycle_schedule_registration(uuid[], integer[], timestamptz, timestamptz, uuid) to service_role;

revoke all on function public.execute_scheduled_cycle_action(uuid, uuid, text, bigint) from public;

grant execute on function public.execute_scheduled_cycle_action(uuid, uuid, text, bigint) to service_role;

revoke all on function public.dispatch_cycle_deadline_reminder(uuid, uuid, bigint, integer) from public;

grant execute on function public.dispatch_cycle_deadline_reminder(uuid, uuid, bigint, integer) to service_role;

revoke all on function public.update_cycle_schedule(uuid, timestamptz, timestamptz, timestamptz, timestamptz, uuid) from public;

grant execute on function public.update_cycle_schedule(uuid, timestamptz, timestamptz, timestamptz, timestamptz, uuid) to service_role;

revoke all on function public.create_or_open_cycle(
  uuid, uuid, text, uuid, timestamptz, timestamptz
) from public;

grant execute on function public.create_or_open_cycle(
  uuid, uuid, text, uuid, timestamptz, timestamptz
) to service_role;

revoke all on function public.create_cycles_batch(
  uuid, uuid[], text, uuid, timestamptz, timestamptz
) from public;

grant execute on function public.create_cycles_batch(
  uuid, uuid[], text, uuid, timestamptz, timestamptz
) to service_role;

revoke all on function public.process_cycles_batch_with_reference(
  text, uuid, uuid[], text, integer, integer, uuid,
  timestamptz, timestamptz, integer[], timestamptz, timestamptz
) from public;

grant execute on function public.process_cycles_batch_with_reference(
  text, uuid, uuid[], text, integer, integer, uuid,
  timestamptz, timestamptz, integer[], timestamptz, timestamptz
) to service_role;

revoke all on function public.reopen_cycle(uuid, uuid, text, timestamptz, uuid[]) from public;

grant execute on function public.reopen_cycle(uuid, uuid, text, timestamptz, uuid[]) to service_role;

revoke all on function public.enforce_reopen_metadata() from public;

revoke all on function public.enforce_valid_evidence_file() from public;

grant select on public.cycle_validation_reopen_events to authenticated, service_role;

revoke insert, update, delete on public.cycle_validation_reopen_events from authenticated;

revoke all on function public.enforce_cycle_transition_integrity() from public;

revoke all on function public.enforce_validation_reopen_metadata() from public;

revoke all on function public.validation_reopen_impact(uuid) from public;

grant execute on function public.validation_reopen_impact(uuid) to service_role;

revoke all on function public.reopen_validation_cycle(uuid, uuid, text) from public;

grant execute on function public.reopen_validation_cycle(uuid, uuid, text) to service_role;

revoke all on function public.deactivate_misplaced_legacy_evidence_link(
  uuid, uuid, text, text
) from public;

grant execute on function public.deactivate_misplaced_legacy_evidence_link(
  uuid, uuid, text, text
) to service_role;

revoke all on function public.reconcile_legacy_evidence_link(
  uuid, uuid, uuid, text, integer, text, public.evidence_validation_status
) from public;

grant execute on function public.reconcile_legacy_evidence_link(
  uuid, uuid, uuid, text, integer, text, public.evidence_validation_status
) to service_role;

grant select on public.response_admin_applicability_events to authenticated, service_role;

revoke insert, update, delete on public.response_admin_applicability_events from authenticated;

revoke all on function public.publish_form(
  uuid, uuid
) from public;

grant execute on function public.publish_form(
  uuid, uuid
) to service_role;

revoke all on function public.mark_response_admin_not_applicable(
  uuid, uuid, uuid, text, text, timestamptz
) from public;

grant execute on function public.mark_response_admin_not_applicable(
  uuid, uuid, uuid, text, text, timestamptz
) to service_role;

revoke all on function public.revert_response_admin_not_applicable(
  uuid, uuid, uuid, text, text, timestamptz
) from public;

grant execute on function public.revert_response_admin_not_applicable(
  uuid, uuid, uuid, text, text, timestamptz
) to service_role;

revoke all on function public.mark_responses_admin_not_applicable_batch(
  uuid, uuid, uuid[], text
) from public;

grant execute on function public.mark_responses_admin_not_applicable_batch(
  uuid, uuid, uuid[], text
) to service_role;

grant select on public.response_admin_proof_events to authenticated, service_role;

revoke insert, update, delete on public.response_admin_proof_events from authenticated;

revoke all on function public.dispatch_evidence_adjustments(uuid, uuid) from public;

grant execute on function public.dispatch_evidence_adjustments(uuid, uuid) to service_role;

revoke all on function public.apply_workbench_response(
  uuid, uuid, uuid, public.answer_value, text, bigint, jsonb
) from public;

grant execute on function public.apply_workbench_response(
  uuid, uuid, uuid, public.answer_value, text, bigint, jsonb
) to service_role;

revoke all on function public.commit_cycle_transition(
  uuid, uuid, public.cycle_state, jsonb, jsonb, public.cycle_state
) from public;

grant execute on function public.commit_cycle_transition(
  uuid, uuid, public.cycle_state, jsonb, jsonb, public.cycle_state
) to service_role;

revoke all on function public.decide_response_without_proof(
  uuid, uuid, uuid, text, text, text, timestamptz
) from public;

grant execute on function public.decide_response_without_proof(
  uuid, uuid, uuid, text, text, text, timestamptz
) to service_role;

revoke all on function public.calculate_live_fami_rows(uuid) from public;

revoke all on function public.calculate_live_recommendations(uuid) from public;

revoke all on function public.get_validation_finalization_readiness(uuid) from public;

grant execute on function public.get_validation_finalization_readiness(uuid) to service_role;

revoke all on function public.list_validation_finalization_readiness(uuid[]) from public;

grant execute on function public.list_validation_finalization_readiness(uuid[]) to service_role;

revoke all on function public.get_validation_queue_summary(uuid) from public;

grant execute on function public.get_validation_queue_summary(uuid) to service_role;

revoke all on function public.list_validation_queue_page(uuid, text, uuid, integer, integer) from public;

grant execute on function public.list_validation_queue_page(uuid, text, uuid, integer, integer) to service_role;

revoke all on function public.finalize_validation_cycle(uuid, uuid) from public;

grant execute on function public.finalize_validation_cycle(uuid, uuid) to service_role;

revoke all on function public.find_validation_queue_page_for_evidence(uuid, uuid, uuid, integer) from public;

grant execute on function public.find_validation_queue_page_for_evidence(uuid, uuid, uuid, integer) to service_role;

revoke all on function public.find_validation_queue_page_for_evidence(
  uuid, uuid, uuid, integer
) from public;

grant execute on function public.find_validation_queue_page_for_evidence(
  uuid, uuid, uuid, integer
) to service_role;

grant select on public.cycle_deadline_events to authenticated, service_role;

revoke insert, update, delete on public.cycle_deadline_events from authenticated;

revoke all on function public.notify_cycle_deadline_change(uuid, text, timestamptz, text, uuid) from public;

grant execute on function public.notify_cycle_deadline_change(uuid, text, timestamptz, text, uuid) to service_role;

revoke all on function public.admin_change_cycle_response_deadlines(
  uuid[], timestamptz, text, text, text, uuid, uuid
) from public;

grant execute on function public.admin_change_cycle_response_deadlines(
  uuid[], timestamptz, text, text, text, uuid, uuid
) to service_role;

revoke all on function public.admin_set_cycle_collection_pause(
  uuid[], boolean, text, text, uuid, uuid
) from public;

grant execute on function public.admin_set_cycle_collection_pause(
  uuid[], boolean, text, text, uuid, uuid
) to service_role;

grant select on public.cycle_reopen_allowed_questions to authenticated, service_role;

revoke insert, update, delete on public.cycle_reopen_allowed_questions from authenticated;

revoke all on function app_private.is_cycle_question_collection_editable(uuid, uuid) from public;

grant execute on function app_private.is_cycle_question_collection_editable(uuid, uuid)
  to authenticated, service_role;

revoke all on function public.admin_reopen_cycles_for_responses(
  uuid[], timestamptz, text, text, uuid, uuid, uuid[]
) from public;

grant execute on function public.admin_reopen_cycles_for_responses(
  uuid[], timestamptz, text, text, uuid, uuid, uuid[]
) to service_role;

revoke all on function public.admin_reopen_validation_cycles(
  uuid[], text, text, uuid, uuid
) from public;

grant execute on function public.admin_reopen_validation_cycles(
  uuid[], text, text, uuid, uuid
) to service_role;

revoke all on function public.validation_form_axis_rank(text) from public;

grant execute on function public.validation_form_axis_rank(text) to service_role;

revoke all on function public.get_validation_form_summary(uuid) from public;

grant execute on function public.get_validation_form_summary(uuid) to service_role;

revoke all on function public.list_validation_form_page(
  uuid, text, uuid, text, text, text, text, text, integer, integer, text, uuid
) from public;

grant execute on function public.list_validation_form_page(
  uuid, text, uuid, text, text, text, text, text, integer, integer, text, uuid
) to service_role;

grant select on public.validation_analysis_drafts to authenticated, service_role;

revoke insert, update, delete on public.validation_analysis_drafts from authenticated;

revoke all on function public.mark_validation_analysis_draft_applied(uuid, text, uuid, uuid)
  from public;

grant execute on function public.mark_validation_analysis_draft_applied(uuid, text, uuid, uuid)
  to service_role;

revoke all on function public.save_validation_analysis_draft(
  uuid, uuid, text, uuid, uuid, text, text, text, bigint
) from public;

grant execute on function public.save_validation_analysis_draft(
  uuid, uuid, text, uuid, uuid, text, text, text, bigint
) to service_role;

revoke all on function public.ensure_form_period(uuid, text, text, timestamptz, timestamptz) from public;

grant execute on function public.ensure_form_period(uuid, text, text, timestamptz, timestamptz) to service_role;

grant execute on function public.calculate_live_fami_rows(uuid) to service_role;

revoke all on function public.supersede_absent_proof_with_evidence(uuid, uuid, uuid, jsonb)
  from public;

grant execute on function public.supersede_absent_proof_with_evidence(uuid, uuid, uuid, jsonb)
  to service_role;

revoke all on function public.list_action_plan_recommendations_page(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, integer, integer
) from public;

grant execute on function public.list_action_plan_recommendations_page(
  uuid, uuid, uuid, uuid, text, text, text, text, text, text, integer, integer
) to service_role;

revoke all on function public.get_admin_recommendation_monitoring_page(
  uuid, uuid, uuid, uuid, text, text, date, date, text, text, integer, integer
) from public;

grant execute on function public.get_admin_recommendation_monitoring_page(
  uuid, uuid, uuid, uuid, text, text, date, date, text, text, integer, integer
) to service_role;

revoke all on function public.list_evidences_page(
  text, text, boolean, uuid, uuid, uuid, uuid, timestamptz, timestamptz, uuid[], integer, integer, text, text, text
) from public;

grant execute on function public.list_evidences_page(
  text, text, boolean, uuid, uuid, uuid, uuid, timestamptz, timestamptz, uuid[], integer, integer, text, text, text
) to service_role;

revoke all on function public.get_evidence_metrics(
  text, text, boolean, uuid, uuid, uuid, uuid, timestamptz, timestamptz, uuid[], text, text
) from public;

grant execute on function public.get_evidence_metrics(
  text, text, boolean, uuid, uuid, uuid, uuid, timestamptz, timestamptz, uuid[], text, text
) to service_role;

revoke all on function public.save_respondent_action_plan(
  uuid, uuid, uuid, uuid, text, date, date, text, uuid,
  integer, boolean, bigint, text, text
) from public;

grant execute on function public.save_respondent_action_plan(
  uuid, uuid, uuid, uuid, text, date, date, text, uuid,
  integer, boolean, bigint, text, text
) to service_role;

revoke all on function public.carry_forward_action_plan_documents_on_revision() from public;

revoke all on table public.fami_preliminary_processings from anon, authenticated;

revoke all on table public.fami_preliminary_action_snapshots from anon, authenticated;

revoke all on table public.fami_preliminary_criterion_results from anon, authenticated;

revoke all on table public.fami_preliminary_results from anon, authenticated;

grant select on public.fami_preliminary_processings to authenticated, service_role;

grant select on public.fami_preliminary_action_snapshots to authenticated, service_role;

grant select on public.fami_preliminary_criterion_results to authenticated, service_role;

grant select on public.fami_preliminary_results to authenticated, service_role;

revoke all on function public.materialize_fami_preliminary(uuid, integer, smallint, uuid) from public;

grant execute on function public.materialize_fami_preliminary(uuid, integer, smallint, uuid) to service_role;

alter default privileges in schema public
  revoke insert, update, delete, truncate on tables from authenticated;

alter default privileges in schema public
  grant select on tables to authenticated;

alter default privileges in schema public
  grant select, insert, update, delete on tables to service_role;

alter default privileges in schema public
  grant usage, select on sequences to service_role;

alter default privileges in schema public
  revoke usage, select on sequences from authenticated;


-- Helpers de autorização ficam fora do schema exposto; SECURITY DEFINER não vira RPC público.
revoke all on schema app_private from public, anon;
grant usage on schema app_private to authenticated, service_role;
revoke execute on all functions in schema app_private from public, anon;
grant execute on all functions in schema app_private to authenticated, service_role;

-- Default deny para RPCs em public. O backend usa service_role.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges in schema public grant execute on functions to service_role;
