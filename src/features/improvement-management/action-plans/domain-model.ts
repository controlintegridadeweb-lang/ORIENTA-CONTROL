
import type { PlanStatus } from "@/features/improvement-management/action-plans/schemas";
import { STRUCTURAL_AXIS_ORDER } from "@/shared/domain/axis";
import { addCalendarDays, businessToday } from "@/shared/datetime/business-date";
import {
  parseResponsibleLabel,
  isDbActionPlanStatus,
  planStatusFromDb,
} from "@/features/improvement-management/action-plans/plan-status-map";
import { deriveActionStatus } from "@/features/improvement-management/action-plans/plan-progress";
import type { RecommendationStatus } from "@/features/improvement-management/recommendations/schemas";

export type ActionPlanDocument = {
  id: string;
  actionRevision: number;
  kind: "file" | "link";
  title: string;
  externalLink: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  fileValidationStatus: "not_applicable" | "valid" | "rejected" | "removed";
  validatedAt: string | null;
  createdAt: string;
  isCurrentRevision: boolean;
};

export type ActionPlanAction = {
  id: string;
  actionText: string;
  startDate: string;
  dueDate: string;
  responsibleSector: string;
  responsibleUserId: string | null;
  responsibleName: string;
  /** Percentual 0–100 informado pelo responsável (fonte oficial). */
  progressPercentage: number;
  status: PlanStatus;
  observations: string | null;
  updatedAt: string;
  revision: number;
  documents: ActionPlanDocument[];
  slaLabel: "ok" | "due_soon" | "overdue" | "na";
};

export type ActionPlanRecommendationNode = {
  recommendationId: string;
  recommendationText: string;
  recommendationType: string;
  recommendationStatus: RecommendationStatus;
  questionPrompt: string;
  sectionName: string;
  actions: ActionPlanAction[];
};

type ActionPlanAxisNode = {
  axisId: string;
  axisName: string;
  recommendations: ActionPlanRecommendationNode[];
};

type ActionPlanByCycleSummary = {
  totalRecommendations: number;
  recommendationsWithActions: number;
  totalActions: number;
  actionsByStatus: Partial<Record<PlanStatus, number>>;
};

export type ActionPlanByCyclePayload = {
  cycleId: string;
  formId: string;
  formName: string;
  formVersion: number;
  organizationId: string;
  organizationName: string;
  axes: ActionPlanAxisNode[];
  summary: ActionPlanByCycleSummary;
};

export type RecommendationWithPlansRow = {
  id: string;
  form_id: string;
  organization_id: string;
  recommendation_type: string;
  current_text: string;
  status: RecommendationStatus;
  question_id?: string;
  questions: QuestionJoinLike | QuestionJoinLike[] | null;
  action_plans: ActionPlanRaw[] | null;
};

type QuestionJoinLike = {
  id?: string;
  prompt: string;
  section_id?: string | null;
  section_order?: number | null;
  question_order?: number | null;
  sections:
    | { name: string; axes: AxisJoinLike | AxisJoinLike[] | null }
    | { name: string; axes: AxisJoinLike | AxisJoinLike[] | null }[]
    | null;
};

type AxisJoinLike = { id: string; name: string } | { id: string; name: string }[];

type ActionPlanRaw = {
  id: string;
  action_text?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  responsible_label?: string | null;
  responsible_user_id?: string | null;
  responsible_sector?: string | null;
  responsible_name?: string | null;
  progress_percentage?: number | null;
  status?: string | null;
  execution_notes?: string | null;
  observations?: string | null;
  updated_at?: string | null;
  revision?: number | null;
  documents?: Array<{
    id?: string | null;
    action_revision?: number | null;
    kind?: string | null;
    title?: string | null;
    external_link?: string | null;
    original_filename?: string | null;
    mime_type?: string | null;
    size_bytes?: number | null;
    file_validation_status?: string | null;
    validated_at?: string | null;
    created_at?: string | null;
  }> | null;
  action_plan_documents?: ActionPlanRaw["documents"];
};

export function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeAxis(axis: AxisJoinLike | null): { id: string; name: string } | null {
  if (!axis) return null;
  const row = Array.isArray(axis) ? axis[0] : axis;
  if (!row?.id) return null;
  return { id: String(row.id), name: String(row.name ?? "") };
}

export function computeActionSla(
  plan: {
    dueDate: string;
    status: PlanStatus;
  },
  now: Date = new Date(),
): "ok" | "due_soon" | "overdue" | "na" {
  if (!plan.dueDate) return "na";
  if (plan.status === "completed" || plan.status === "cancelled") return "na";
  const due = plan.dueDate.slice(0, 10);
  const today = businessToday(now);
  const week = addCalendarDays(today, 7);
  if (due < today) return "overdue";
  if (due <= week) return "due_soon";
  return "ok";
}

export function aggregateSlaFromActions(
  actions: Pick<ActionPlanAction, "slaLabel">[],
): "ok" | "due_soon" | "overdue" | "na" {
  if (actions.length === 0) return "na";
  if (actions.some((a) => a.slaLabel === "overdue")) return "overdue";
  if (actions.some((a) => a.slaLabel === "due_soon")) return "due_soon";
  if (actions.some((a) => a.slaLabel === "ok")) return "ok";
  return "na";
}

function parsePlanStatus(raw: string): PlanStatus {
  if (!isDbActionPlanStatus(raw)) {
    throw new Error(`Status de plano de integridade e compliance inválido retornado pelo banco: ${raw}`);
  }
  return planStatusFromDb(raw);
}

function parseProgressPercentage(raw: unknown): number {
  if (typeof raw === "number" && Number.isInteger(raw) && raw >= 0 && raw <= 100) {
    return raw;
  }
  throw new Error(`progress_percentage inválido retornado pelo banco: ${String(raw)}`);
}

function rawPlanToAction(row: ActionPlanRaw): ActionPlanAction {
  const dueDate = String(row.due_date ?? "").slice(0, 10);
  const startDate = String(row.start_date ?? dueDate).slice(0, 10);
  const persistedStatus = parsePlanStatus(String(row.status ?? "todo"));
  const progressPercentage = parseProgressPercentage(row.progress_percentage);
  const status = deriveActionStatus(
    progressPercentage,
    persistedStatus === "cancelled",
  );
  const { sector, name } = parseResponsibleLabel(
    String(row.responsible_label ?? row.responsible_name ?? ""),
  );
  const revision = Math.max(1, Number(row.revision ?? 1));
  const documents = (Array.isArray(row.documents) ? row.documents : Array.isArray(row.action_plan_documents) ? row.action_plan_documents : [])
    .filter((document) => document?.id && (document.kind === "file" || document.kind === "link"))
    .map((document) => ({
      id: String(document.id),
      actionRevision: Math.max(1, Number(document.action_revision ?? 1)),
      kind: document.kind as "file" | "link",
      title: String(document.title ?? "Comprovação"),
      externalLink: document.external_link ? String(document.external_link) : null,
      originalFilename: document.original_filename ? String(document.original_filename) : null,
      mimeType: document.mime_type ? String(document.mime_type) : null,
      sizeBytes: document.size_bytes == null ? null : Number(document.size_bytes),
      fileValidationStatus: ["not_applicable", "valid", "rejected", "removed"].includes(String(document.file_validation_status))
        ? String(document.file_validation_status) as ActionPlanDocument["fileValidationStatus"]
        : "rejected",
      validatedAt: document.validated_at ? String(document.validated_at) : null,
      createdAt: String(document.created_at ?? ""),
      isCurrentRevision: Math.max(1, Number(document.action_revision ?? 1)) === revision,
    }));
  const action: ActionPlanAction = {
    id: String(row.id),
    actionText: String(row.action_text ?? ""),
    startDate,
    dueDate,
    responsibleSector: sector || String(row.responsible_sector ?? ""),
    responsibleUserId: row.responsible_user_id ? String(row.responsible_user_id) : null,
    responsibleName: name || String(row.responsible_name ?? ""),
    progressPercentage,
    status,
    observations: (row.execution_notes as string | null) ?? row.observations ?? null,
    updatedAt: String(row.updated_at ?? ""),
    revision,
    documents,
    slaLabel: "na",
  };
  action.slaLabel = computeActionSla(action);
  return action;
}

function normalizePlans(raw: unknown): ActionPlanRaw[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x) => x && typeof x === "object" && "id" in (x as object)) as ActionPlanRaw[];
  return [raw as ActionPlanRaw].filter((x) => x?.id);
}

function axisSortKey(name: string): number {
  const idx = STRUCTURAL_AXIS_ORDER.indexOf(name as (typeof STRUCTURAL_AXIS_ORDER)[number]);
  return idx >= 0 ? idx : STRUCTURAL_AXIS_ORDER.length;
}

/**
 * Agrupa recomendacoes + acoes por eixo estrutural.
 */
export function buildActionPlanByCyclePayload(params: {
  cycleId: string;
  formId: string;
  formName: string;
  formVersion: number;
  organizationId: string;
  organizationName: string;
  recommendationRows: RecommendationWithPlansRow[];
}): ActionPlanByCyclePayload {
  const axesMap = new Map<
    string,
    { axisId: string; axisName: string; recs: Map<string, ActionPlanRecommendationNode> }
  >();

  const actionsByStatus: Partial<Record<PlanStatus, number>> = {};
  let totalActions = 0;
  let recommendationsWithActions = 0;

  for (const row of params.recommendationRows) {
    const q = pickOne(row.questions as QuestionJoinLike | QuestionJoinLike[] | null);
    const sec = q ? pickOne(q.sections) : null;
    const axisRow = sec ? normalizeAxis(sec.axes as AxisJoinLike | null) : null;
    const structuralAxisId = axisRow?.id ?? null;
    const axisKey = structuralAxisId ?? "__sem_eixo";
    const axisName = axisRow?.name ?? "";

    let bucket = axesMap.get(axisKey);
    if (!bucket) {
      bucket = { axisId: structuralAxisId ?? "", axisName, recs: new Map() };
      axesMap.set(axisKey, bucket);
    }

    const plansSorted = normalizePlans(row.action_plans)
      .map(rawPlanToAction)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

    if (plansSorted.length > 0) recommendationsWithActions += 1;
    for (const ac of plansSorted) {
      totalActions += 1;
      actionsByStatus[ac.status] = (actionsByStatus[ac.status] ?? 0) + 1;
    }

    bucket.recs.set(row.id, {
      recommendationId: row.id,
      recommendationText: row.current_text,
      recommendationType: row.recommendation_type,
      recommendationStatus: row.status,
      questionPrompt: q?.prompt ?? "(pergunta removida)",
      sectionName: sec?.name ?? "",
      actions: plansSorted,
    });
  }

  const axes: ActionPlanAxisNode[] = Array.from(axesMap.values())
    .map((b) => ({
      axisId: b.axisId,
      axisName: b.axisName || "(sem eixo)",
      recommendations: Array.from(b.recs.values()).sort((x, y) =>
        x.recommendationText.localeCompare(y.recommendationText, "pt-BR"),
      ),
    }))
    .sort((a, b) => axisSortKey(a.axisName || "") - axisSortKey(b.axisName || "") || a.axisName.localeCompare(b.axisName, "pt-BR"));

  return {
    cycleId: params.cycleId,
    formId: params.formId,
    formName: params.formName,
    formVersion: params.formVersion,
    organizationId: params.organizationId,
    organizationName: params.organizationName,
    axes,
    summary: {
      totalRecommendations: params.recommendationRows.length,
      recommendationsWithActions,
      totalActions,
      actionsByStatus,
    },
  };
}
