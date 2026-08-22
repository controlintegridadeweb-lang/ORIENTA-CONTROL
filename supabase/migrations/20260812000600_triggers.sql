-- ORIENTA greenfield baseline — Triggers finais
-- Gerada a partir do estado final pré-cutover; não contém dados históricos reais.

create trigger profiles_single_global_admin_guard
before update or delete on public.profiles
for each row
execute function public.guard_single_global_admin_profile();

create trigger axes_immutable
before update or delete on public.axes
for each row execute function public.block_mutation();

create trigger sections_set_updated_at
before update on public.sections
for each row execute function public.set_updated_at();

create trigger questions_set_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

create trigger question_versions_immutable
before update or delete on public.question_versions
for each row execute function public.block_mutation();

create trigger forms_set_updated_at
before update on public.forms
for each row execute function public.set_updated_at();

create trigger forms_preserve_published_name
before update of name on public.forms
for each row execute function public.prevent_published_form_rename();

create trigger form_drafts_set_updated_at
before update on public.form_drafts
for each row execute function public.set_updated_at();

create trigger form_versions_require_assignment
before insert or update of state on public.form_versions
for each row execute function public.enforce_published_form_has_assignment();

create trigger form_assignments_preserve_published_destination
before delete on public.form_assignments
for each row execute function public.prevent_last_published_assignment_removal();

create trigger cycles_set_updated_at
before update on public.cycles
for each row execute function public.set_updated_at();

create trigger audit_cycles
after insert or update or delete on public.cycles
for each row execute function public.audit_row_change();

create trigger form_assignments_preserve_cycle_history
before delete on public.form_assignments
for each row execute function public.prevent_form_assignment_delete_with_cycles();

create trigger responses_sync_na_fields
before insert or update of answer, notes, na_justification, na_validation_status
on public.responses
for each row
execute function public.responses_sync_na_fields();

create trigger responses_bump_revision
before update on public.responses
for each row execute function public.bump_response_revision();

create trigger responses_set_updated_at
before update on public.responses
for each row execute function public.set_updated_at();

create trigger audit_responses
after insert or update or delete on public.responses
for each row execute function public.audit_row_change();

create trigger audit_evidences
after insert or update or delete on public.evidences
for each row execute function public.audit_row_change();

create trigger response_snapshots_immutable
before update or delete on public.response_snapshots
for each row execute function public.block_mutation();

create trigger evidence_snapshots_immutable
before update or delete on public.evidence_snapshots
for each row execute function public.block_mutation();

create trigger processing_waiver_snapshots_immutable
before update or delete on public.processing_waiver_snapshots
for each row execute function public.block_mutation();

create trigger responses_deactivate_incompatible_evidence
after update of answer, is_not_applicable on public.responses
for each row
when (new.answer <> 'yes'::public.answer_value)
execute function public.deactivate_incompatible_evidence_on_response_change();

create trigger evidences_deactivate_incompatible_on_write
before insert or update of response_id, deactivated_at on public.evidences
for each row
execute function public.deactivate_incompatible_evidence_on_evidence_write();

create trigger audit_question_organization_waivers
after insert or update or delete on public.question_organization_waivers
for each row execute function public.audit_row_change();

create trigger question_waivers_lock_active_cycles
before insert or update or delete on public.question_organization_waivers
for each row execute function public.lock_waiver_active_cycles();

create trigger action_plans_lock_cycle
before insert or update or delete on public.action_plans
for each row execute function public.lock_action_plan_cycle();

create trigger action_plans_axis_matches_recommendation
before insert or update of recommendation_id, axis_id on public.action_plans
for each row execute function public.enforce_action_plan_axis_matches_recommendation();

create trigger action_plans_bump_item_revision
before update on public.action_plans
for each row execute function public.bump_action_plan_item_revision();

create trigger action_plans_set_updated_at
before update on public.action_plans
for each row execute function public.set_updated_at();

create trigger audit_action_plans
after insert or update or delete on public.action_plans
for each row execute function public.audit_row_change();

create trigger pending_action_plan_document_uploads_enforce_scope
before insert or update of action_plan_id, organization_id, action_revision
on public.pending_action_plan_document_uploads
for each row execute function public.enforce_pending_action_plan_document_upload_scope();

create trigger action_plan_documents_enforce_scope
before insert or update of action_plan_id, organization_id, action_revision, deactivated_at
on public.action_plan_documents
for each row execute function public.enforce_action_plan_document_scope();

create trigger audit_action_plan_documents
after insert or update or delete on public.action_plan_documents
for each row execute function public.audit_row_change();

create trigger library_recommendations_set_updated_at
before update on public.library_recommendations
for each row execute function public.set_updated_at();

create trigger library_item_versions_protect
before update or delete on public.library_item_versions
for each row execute function public.protect_library_item_version();

create trigger question_library_binding_set_updated_at
before update on public.question_library_binding
for each row execute function public.set_updated_at();

create trigger recommendation_exceptions_set_updated_at
before update on public.recommendation_exceptions
for each row execute function public.set_updated_at();

create trigger recommendation_exceptions_enforce_scope
before insert or update of organization_id, recommendation_id, question_id
on public.recommendation_exceptions
for each row execute function public.enforce_recommendation_exception_scope();

create trigger recommendation_exceptions_preserve_terminal_decision
before update on public.recommendation_exceptions
for each row execute function public.enforce_recommendation_exception_terminal_state();

create trigger action_plan_documents_preserve_approved_package
before insert or update of deactivated_at on public.action_plan_documents
for each row execute function public.prevent_approved_action_plan_document_change();

create trigger audit_action_plan_supervision_notes
after insert or update or delete on public.action_plan_supervision_notes
for each row execute function public.audit_row_change();

create trigger action_plan_supervision_notes_enforce_scope
before insert on public.action_plan_supervision_notes
for each row execute function public.enforce_action_plan_supervision_note();

create trigger action_plans_block_cancel_with_open_supervision
before update of status on public.action_plans
for each row execute function public.prevent_action_plan_cancellation_with_open_request();

create trigger action_plans_supersede_stale_approval
after update of revision on public.action_plans
for each row execute function public.supersede_action_plan_approval_after_change();

create trigger audit_logs_append_only_update_delete
before update or delete on public.audit_logs
for each statement execute function public.prevent_audit_event_mutation();

create trigger audit_logs_append_only_truncate
before truncate on public.audit_logs
for each statement execute function public.prevent_audit_event_mutation();

create trigger library_audit_events_append_only_update_delete
before update or delete on public.library_audit_events
for each statement execute function public.prevent_audit_event_mutation();

create trigger library_audit_events_append_only_truncate
before truncate on public.library_audit_events
for each statement execute function public.prevent_audit_event_mutation();

create trigger profiles_enforce_identity
before update on public.profiles
for each row execute function public.prevent_profile_identity_change();

create trigger responses_respondent_mutation_guard
before update on public.responses
for each row execute function public.guard_respondent_live_data_mutation();

create trigger responses_cycle_form_question_guard
before insert or update of cycle_id, question_version_id on public.responses
for each row execute function public.guard_response_question_version_in_cycle_form();

create trigger evidences_respondent_mutation_guard
before insert or update on public.evidences
for each row execute function public.guard_respondent_live_data_mutation();

create trigger cycles_validation_queue_transition_guard
before update of state on public.cycles
for each row
execute function public.guard_validation_queue_transition();

create trigger automation_jobs_set_updated_at
before update on public.automation_jobs
for each row execute function public.set_updated_at();

create trigger automation_job_items_set_updated_at
before update on public.automation_job_items
for each row execute function public.set_updated_at();

create trigger notification_outbox_set_updated_at
before update on public.notification_outbox
for each row execute function public.set_updated_at();

create trigger cycles_notify_lifecycle
after update of state on public.cycles
for each row execute function public.notify_cycle_lifecycle();

create trigger action_plans_notify_admin
after insert or update or delete on public.action_plans
for each row execute function public.notify_action_plan_change();

create trigger action_plan_supervision_notes_notify_respondents
after insert on public.action_plan_supervision_notes
for each row execute function public.notify_supervision_note();

create trigger action_plan_supervision_notes_notify_lifecycle
after update of lifecycle_status on public.action_plan_supervision_notes
for each row execute function public.notify_supervision_request_lifecycle();

create trigger profiles_notify_open_cycles
after insert or update of organization_id, role on public.profiles
for each row execute function public.profiles_notify_open_cycles();

create trigger cycles_normalize_reference_period
before insert or update of period_label, reference_start_year, reference_end_year
on public.cycles
for each row execute function public.cycles_normalize_reference_period();

create trigger action_plans_bump_cycle_revision
after insert or update or delete on public.action_plans
for each row execute function public.bump_action_plan_revision();

create trigger reports_notify_respondents
after update of status on public.reports
for each row
when (old.status = 'preparing' and new.status = 'completed')
execute function public.notify_report_emission();

create trigger cycles_report_reference_period_immutable
before update of reference_start_year, reference_end_year on public.cycles
for each row execute function public.protect_cycle_report_reference_period();

create trigger reports_immutable
before update or delete on public.reports
for each row execute function public.protect_report_emission_mutation();

create trigger official_report_storage_object_immutable
before update or delete on storage.objects
for each row execute function public.protect_official_report_storage_object();

create trigger response_snapshots_enrich_na_decision
before insert on public.response_snapshots
for each row execute function public.enrich_response_snapshot_na_decision();

create trigger respondent_profile_details_target_guard
before insert or update of user_id on public.respondent_profile_details
for each row execute function public.ensure_respondent_profile_details_target();

create trigger respondent_profile_details_set_updated_at
before update on public.respondent_profile_details
for each row execute function public.set_updated_at();

create trigger audit_respondent_profile_details
after insert or update or delete on public.respondent_profile_details
for each row execute function public.audit_row_change();

create trigger cycles_capture_submission_deadline
before update of state on public.cycles
for each row execute function public.capture_cycle_submission_deadline();

create trigger cycles_record_submission_event
after update of state on public.cycles
for each row execute function public.record_cycle_submission_event();

create trigger cycles_enforce_reopen_metadata
before update of state on public.cycles
for each row execute function public.enforce_reopen_metadata();

create trigger evidences_require_valid_file
before insert on public.evidences
for each row execute function public.enforce_valid_evidence_file();

create trigger cycles_enforce_transition_integrity
before update of state on public.cycles
for each row execute function public.enforce_cycle_transition_integrity();

create trigger cycles_enforce_validation_reopen_metadata
before update of state on public.cycles
for each row execute function public.enforce_validation_reopen_metadata();

create trigger cycles_capture_original_response_deadline
before insert or update of response_deadline_at on public.cycles
for each row execute function public.capture_original_response_deadline();

create trigger validation_analysis_drafts_set_updated_at
before update on public.validation_analysis_drafts
for each row execute function public.set_updated_at();

create trigger audit_validation_analysis_drafts
after insert or update or delete on public.validation_analysis_drafts
for each row execute function public.audit_row_change();

create trigger evidences_apply_validation_analysis_draft
after update of validation_status on public.evidences
for each row
execute function public.trg_apply_validation_analysis_draft_on_evidence();

create trigger responses_apply_validation_analysis_draft
after update of na_validation_status, admin_proof_status, admin_applicability_status
on public.responses
for each row
execute function public.trg_apply_validation_analysis_draft_on_response();

create trigger form_periods_set_updated_at
before update on public.form_periods
for each row execute function public.set_updated_at();

create trigger audit_form_periods
after insert or update or delete on public.form_periods
for each row execute function public.audit_row_change();

create trigger action_plans_carry_forward_documents
after update of revision on public.action_plans
for each row
when (new.revision is distinct from old.revision)
execute function public.carry_forward_action_plan_documents_on_revision();

create trigger fami_preliminary_processings_immutable
before update or delete on public.fami_preliminary_processings
for each row execute function public.block_mutation();

create trigger fami_preliminary_action_snapshots_immutable
before update or delete on public.fami_preliminary_action_snapshots
for each row execute function public.block_mutation();

create trigger fami_preliminary_criterion_results_immutable
before update or delete on public.fami_preliminary_criterion_results
for each row execute function public.block_mutation();

create trigger fami_preliminary_results_immutable
before update or delete on public.fami_preliminary_results
for each row execute function public.block_mutation();
