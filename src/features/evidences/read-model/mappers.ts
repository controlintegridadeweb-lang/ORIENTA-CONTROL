import { isEvidenceRequired } from "@/shared/domain/evidence-parameter";
import type { ValidationStatus } from "../schemas";
import type { EvidenceListItem, EvidenceValidationEntry } from "../types";
import type {
  EvidenceAuditRow,
  EvidencePageRpcRow,
  JoinedEvidenceRow,
} from "./contracts";

export function mapEmbeddedValidationToUi(
  validationStatus: string,
  cycleState: string,
): ValidationStatus {
  if (validationStatus === "approved") return "approved";
  if (validationStatus === "invalidated") return "invalidated";
  if (validationStatus === "adjustment_requested") return "adjustment_requested";
  if (cycleState === "submitted" || cycleState === "in_validation") return "submitted";
  return "pending";
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function validationChanged(row: EvidenceAuditRow): boolean {
  const before = row.before_json;
  const after = row.after_json;
  if (!before || !after) return false;
  return (
    before.validation_status !== after.validation_status ||
    before.validation_justification !== after.validation_justification ||
    before.validated_at !== after.validated_at ||
    before.validated_by !== after.validated_by
  );
}

export function mapAuditHistory(
  auditRows: EvidenceAuditRow[],
): EvidenceValidationEntry[] {
  return auditRows.filter(validationChanged).map((audit) => {
    const after = audit.after_json ?? {};
    return {
      id: audit.id,
      status: mapEmbeddedValidationToUi(
        stringValue(after.validation_status) ?? "pending",
        "draft",
      ),
      justification: stringValue(after.validation_justification),
      validatedBy:
        stringValue(after.validated_by) ??
        audit.actor_user_id ??
        "Usuário não identificado",
      validatedAt: stringValue(after.validated_at) ?? audit.created_at,
    };
  });
}

export function buildCurrentHistory(
  row: JoinedEvidenceRow,
): EvidenceValidationEntry[] {
  if (!row.validated_at || !row.validated_by) return [];
  return [{
    id: `${row.id}-current`,
    status: mapEmbeddedValidationToUi(
      row.validation_status,
      row.responses.cycles.state,
    ),
    justification: row.validation_justification,
    validatedBy: row.validated_by,
    validatedAt: row.validated_at,
  }];
}

function evidenceTitle(row: JoinedEvidenceRow): string {
  const titled = row.title?.trim();
  if (titled) return titled;
  if (row.kind === "file") {
    return row.original_filename?.trim() || row.storage_path || "Arquivo";
  }
  if (row.kind === "text") return "Texto";
  return row.external_link?.trim() || "Link";
}

export function mapEvidenceRow(
  row: JoinedEvidenceRow,
  history: EvidenceValidationEntry[],
): EvidenceListItem {
  const response = row.responses;
  const cycle = response.cycles;
  const formVersion = cycle.form_versions;
  const questionVersion = response.question_versions;

  return {
    id: row.id,
    responseId: response.id,
    cycleId: response.cycle_id,
    cycleState: cycle.state,
    organizationId: cycle.organization_id,
    organizationName: cycle.organizations.name,
    formId: formVersion.form_id,
    formName: formVersion.forms.name,
    formVersion: formVersion.version,
    periodLabel: cycle.period_label,
    questionId: questionVersion.question_id,
    questionPrompt: questionVersion.prompt,
    axisName: questionVersion.axis_name,
    sectionName: questionVersion.section_name,
    requiresEvidence: isEvidenceRequired({
      evidence_parameter: questionVersion.evidence_parameter,
    }),
    title: evidenceTitle(row),
    description: row.link_reason?.trim() ?? "",
    evidenceType: row.kind,
    storagePath: row.storage_path,
    externalLink: row.external_link,
    textBody: row.kind === "text" ? row.text_body?.trim() || null : null,
    exceptionReason: row.kind === "link" ? row.link_reason : null,
    submittedAt: row.submitted_at,
    submittedBy: row.submitted_by,
    currentStatus: mapEmbeddedValidationToUi(row.validation_status, cycle.state),
    lastValidatedAt: row.validated_at,
    lastJustification: row.validation_justification,
    history,
  };
}

function evidenceTitleFromRpc(row: EvidencePageRpcRow): string {
  const titled = row.title?.trim();
  if (titled) return titled;
  if (row.kind === "file") {
    return row.original_filename?.trim() || row.storage_path || "Arquivo";
  }
  if (row.kind === "text") return "Texto";
  return row.external_link?.trim() || "Link";
}

export function mapEvidencePageRpcRow(
  row: EvidencePageRpcRow,
  history: EvidenceValidationEntry[],
): EvidenceListItem {
  const currentHistory = row.validated_at && row.validated_by
    ? [{
        id: `${row.id}-current`,
        status: row.current_status,
        justification: row.validation_justification,
        validatedBy: row.validated_by,
        validatedAt: row.validated_at,
      }]
    : [];

  return {
    id: row.id,
    responseId: row.response_id,
    cycleId: row.cycle_id,
    cycleState: row.cycle_state,
    organizationId: row.organization_id,
    organizationName: row.organization_name,
    formId: row.form_id,
    formName: row.form_name,
    formVersion: row.form_version,
    periodLabel: row.period_label,
    questionId: row.question_id,
    questionPrompt: row.question_prompt,
    axisName: row.axis_name,
    sectionName: row.section_name,
    requiresEvidence: isEvidenceRequired({ evidence_parameter: row.evidence_parameter }),
    title: evidenceTitleFromRpc(row),
    description: row.link_reason?.trim() ?? "",
    evidenceType: row.kind,
    storagePath: row.storage_path,
    externalLink: row.external_link,
    textBody: row.kind === "text" ? row.text_body?.trim() || null : null,
    exceptionReason: row.kind === "link" ? row.link_reason : null,
    submittedAt: row.submitted_at,
    submittedBy: row.submitted_by,
    currentStatus: row.current_status,
    lastValidatedAt: row.validated_at,
    lastJustification: row.validation_justification,
    history: history.length > 0 ? history : currentHistory,
  };
}
