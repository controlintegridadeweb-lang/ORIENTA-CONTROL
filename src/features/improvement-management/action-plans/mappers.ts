import {
  aggregateSlaFromActions,
  computeActionSla,
  pickOne,
  type ActionPlanAction,
} from "@/features/improvement-management/action-plans/domain-model";
import {
  parseResponsibleLabel,
  isDbActionPlanStatus,
  planStatusFromDb,
} from "./plan-status-map";
import { deriveActionStatus } from "./plan-progress";
import type { PlanStatus } from "./schemas";
import type {
  ActionPlanListItem,
  FormRow,
  OrgRow,
  QuestionJoin,
  RecommendationRowRaw,
} from "./types";

export const RESPONDENT_AXIS_UNRESOLVED_MESSAGE =
  "Não foi possível salvar a ação porque esta recomendação ainda não está corretamente associada a um eixo no sistema. Isso é configurado pela administração (pergunta, seção e biblioteca). Entre em contato informando que não foi possível registrar uma ação para esta recomendação.";

function parsePlanStatus(raw: string): PlanStatus {
  if (!isDbActionPlanStatus(raw)) {
    throw new Error(`Status de plano de ação inválido retornado pelo banco: ${raw}`);
  }
  return planStatusFromDb(raw);
}

function rowToPlanActions(raw: unknown): ActionPlanAction[] {
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out: ActionPlanAction[] = [];
  for (const row of arr) {
    if (!row || typeof row !== "object" || !("id" in row)) continue;
    const r = row as Record<string, unknown>;
    const dueDate = String(r.due_date ?? "").slice(0, 10);
    const startDate = String(r.start_date ?? dueDate).slice(0, 10);
    const persistedStatus = parsePlanStatus(String(r.status ?? "todo"));
    const progressPercentage = Number(r.progress_percentage);
    if (!Number.isInteger(progressPercentage) || progressPercentage < 0 || progressPercentage > 100) {
      throw new Error(`progress_percentage inválido na leitura do plano: ${String(r.progress_percentage)}`);
    }
    const status = deriveActionStatus(
      progressPercentage,
      persistedStatus === "cancelled",
    );
    const { sector, name } = parseResponsibleLabel(String(r.responsible_label ?? ""));
    const action: ActionPlanAction = {
      id: String(r.id),
      actionText: String(r.action_text ?? ""),
      startDate,
      dueDate,
      responsibleSector: sector,
      responsibleUserId: r.responsible_user_id ? String(r.responsible_user_id) : null,
      responsibleName: name,
      progressPercentage,
      status,
      observations: (r.execution_notes as string | null) ?? null,
      updatedAt: String(r.updated_at ?? ""),
      revision: Math.max(1, Number(r.revision ?? 1)),
      documents: (Array.isArray(r.documents) ? r.documents : Array.isArray(r.action_plan_documents) ? r.action_plan_documents : [])
        .filter((document): document is Record<string, unknown> => Boolean(document && typeof document === "object" && "id" in document))
        .filter((document) => !document.deactivated_at)
        .map((document) => ({
          id: String(document.id),
          actionRevision: Math.max(1, Number(document.action_revision ?? 1)),
          kind: document.kind === "link" ? "link" : "file",
          title: String(document.title ?? "Comprovação"),
          externalLink: document.external_link ? String(document.external_link) : null,
          originalFilename: document.original_filename ? String(document.original_filename) : null,
          mimeType: document.mime_type ? String(document.mime_type) : null,
          sizeBytes: document.size_bytes == null ? null : Number(document.size_bytes),
          fileValidationStatus: ["not_applicable", "valid", "rejected", "removed"].includes(String(document.file_validation_status))
            ? String(document.file_validation_status) as ActionPlanAction["documents"][number]["fileValidationStatus"]
            : "rejected",
          validatedAt: document.validated_at ? String(document.validated_at) : null,
          createdAt: String(document.created_at ?? ""),
          isCurrentRevision: Math.max(1, Number(document.action_revision ?? 1)) === Math.max(1, Number(r.revision ?? 1)),
        })),
      slaLabel: "na",
    };
    action.slaLabel = computeActionSla(action);
    out.push(action);
  }
  return out.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function toListItem(
  row: RecommendationRowRaw,
  structure?: { axisName: string; sectionName: string },
): ActionPlanListItem {
  const form = pickOne(row.forms as FormRow | FormRow[] | null);
  const org = pickOne(row.organizations as OrgRow | OrgRow[] | null);
  const question = pickOne(row.questions as QuestionJoin | QuestionJoin[] | null);
  const section = question ? pickOne(question.sections) : null;
  const axis = section?.axes ? pickOne(section.axes) : null;
  const plans = rowToPlanActions(row.action_plans);
  const slaLabel = aggregateSlaFromActions(plans);
  const sectionOrder = Number(
    row.section_order ?? question?.section_order ?? 0,
  );
  const questionOrder = Number(
    row.question_order ?? question?.question_order ?? 0,
  );

  return {
    recommendationId: row.id,
    cycleId: row.cycle_id,
    cycleState: row.cycle_state,
    periodLabel: row.period_label,
    questionId: (row.question_id as string) ?? "",
    formId: row.form_id,
    formName: form?.name ?? "(formulário removido)",
    formVersion: form?.version ?? 0,
    organizationId: row.organization_id,
    organizationName: org?.name ?? "(org removida)",
    questionPrompt: question?.prompt ?? "(pergunta removida)",
    sectionId: question?.section_id ?? "",
    sectionName: structure?.sectionName || section?.name || "",
    sectionOrder: Number.isFinite(sectionOrder) ? sectionOrder : 0,
    questionOrder: Number.isFinite(questionOrder) ? questionOrder : 0,
    axisId: row.axis_id || axis?.id || "",
    axisName: structure?.axisName || axis?.name || "",
    recommendationType: row.recommendation_type,
    recommendationText: row.current_text,
    recommendationStatus: row.status,
    plans,
    slaLabel,
    recommendationCreatedAt: row.created_at,
  };
}
