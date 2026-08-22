import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  Award,
  CheckCircle2,
  CircleOff,
  CircleSlash,
  ClipboardList,
  Clock,
  Compass,
  Eye,
  FileQuestion,
  Flame,
  HelpCircle,
  Hourglass,
  Loader2,
  Medal,
  PlayCircle,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Target,
  XCircle,
} from "lucide-react";
type PlanStatus = "not_started" | "in_progress" | "completed" | "cancelled";
import type { CycleState } from "@/shared/domain/types";
import { CYCLE_STATE_LABEL } from "@/shared/domain/cycle-labels";
type ValidationStatus = "not_required" | "pending" | "submitted" | "approved" | "invalidated" | "adjustment_requested";
import { formSurface } from "@/shared/layout/form-surface";
type RecommendationStatus =
  | "generated"
  | "in_action_plan"
  | "awaiting_approval"
  | "adjustment_requested"
  | "exception_requested"
  | "completed"
  | "dismissed";
type RespondentReportJobStatus = "queued" | "processing" | "completed" | "failed" | "outdated" | "available";

export type StatusRegistryEntry = {
  key: string;
  label: string;
  description?: string;
  colorClass: string;
  chipColorClass?: string;
  columnBg?: string;
  icon?: LucideIcon;
  iconName?: string;
  priority: number;
};

const STATUS_BADGE_SURFACE = {
  neutral: formSurface.badge.neutral,
  brand: formSurface.badge.brand,
  success: formSurface.badge.success,
  warning: formSurface.badge.warning,
  danger: formSurface.badge.danger,
  info: formSurface.badge.info,
  muted: formSurface.badge.muted,
} as const;

function entry(p: Omit<StatusRegistryEntry, "key"> & { key?: string }): StatusRegistryEntry {
  const key = p.key ?? p.label;
  return { key, label: p.label, description: p.description, colorClass: p.colorClass, chipColorClass: p.chipColorClass, columnBg: p.columnBg, icon: p.icon, iconName: p.iconName, priority: p.priority };
}

export const EVIDENCE_VALIDATION_REGISTRY: Record<ValidationStatus, StatusRegistryEntry> = {
  not_required: entry({
    key: "not_required",
    label: "Fora da fila",
    description: "Critério marcado como não se aplica; a evidência não entra na validação.",
    colorClass: STATUS_BADGE_SURFACE.muted,
    icon: CircleSlash,
    priority: 100,
  }),
  pending: entry({ key: "pending", label: "Aguardando envio do diagnóstico", colorClass: STATUS_BADGE_SURFACE.warning, icon: Hourglass, priority: 30 }),
  submitted: entry({ key: "submitted", label: "Aguardando validação", colorClass: STATUS_BADGE_SURFACE.info, icon: Clock, priority: 40 }),
  approved: entry({ key: "approved", label: "Aprovada", colorClass: STATUS_BADGE_SURFACE.success, icon: CheckCircle2, priority: 100 }),
  invalidated: entry({ key: "invalidated", label: "Não aprovada", colorClass: STATUS_BADGE_SURFACE.danger, icon: XCircle, priority: 15 }),
  adjustment_requested: entry({ key: "adjustment_requested", label: "Ajuste solicitado", colorClass: STATUS_BADGE_SURFACE.warning, icon: FileQuestion, priority: 20 }),
};

export const RECOMMENDATION_REGISTRY: Record<RecommendationStatus, StatusRegistryEntry> = {
  generated: entry({ key: "generated", label: "Gerada", colorClass: STATUS_BADGE_SURFACE.neutral, icon: Clock, priority: 50 }),
  in_action_plan: entry({ key: "in_action_plan", label: "Em plano de ação", colorClass: STATUS_BADGE_SURFACE.info, icon: PlayCircle, priority: 35 }),
  awaiting_approval: entry({ key: "awaiting_approval", label: "Execução concluída · aguardando aceite", colorClass: STATUS_BADGE_SURFACE.warning, icon: Hourglass, priority: 25 }),
  adjustment_requested: entry({ key: "adjustment_requested", label: "Solicitação de ajuste", colorClass: STATUS_BADGE_SURFACE.danger, icon: ShieldAlert, priority: 15 }),
  exception_requested: entry({ key: "exception_requested", label: "Exceção em análise", colorClass: STATUS_BADGE_SURFACE.warning, icon: FileQuestion, priority: 20 }),
  completed: entry({ key: "completed", label: "Aprovada", colorClass: STATUS_BADGE_SURFACE.success, icon: CheckCircle2, priority: 100 }),
  dismissed: entry({ key: "dismissed", label: "Dispensada", colorClass: STATUS_BADGE_SURFACE.muted, icon: CircleSlash, priority: 95 }),
};

export const RECOMMENDATION_STATUS_LABELS: Record<RecommendationStatus, string> = Object.fromEntries(
  (Object.keys(RECOMMENDATION_REGISTRY) as RecommendationStatus[]).map((k) => [k, RECOMMENDATION_REGISTRY[k].label]),
) as Record<RecommendationStatus, string>;

/** Rótulos visíveis dos motivos/tipos de recomendação (chaves = enum do domínio). */
export const RECOMMENDATION_TYPE_LABELS = {
  nao_implementacao: "Não implementado",
  ausencia_evidencia: "Evidência não apresentada",
  evidencia_insuficiente: "Evidência insuficiente",
} as const;

export type RecommendationTypeKey = keyof typeof RECOMMENDATION_TYPE_LABELS;

const RECOMMENDATION_TYPE_REGISTRY: Record<string, StatusRegistryEntry> = {
  nao_implementacao: entry({
    key: "nao_implementacao",
    label: RECOMMENDATION_TYPE_LABELS.nao_implementacao,
    description: "Motivo da recomendação: a resposta no diagnóstico foi Não. Não muda ao atualizar o plano de ação.",
    colorClass: "bg-rose-100 text-rose-800",
    icon: XCircle,
    priority: 20,
  }),
  ausencia_evidencia: entry({
    key: "ausencia_evidencia",
    label: RECOMMENDATION_TYPE_LABELS.ausencia_evidencia,
    description: "Motivo da recomendação: faltou evidência obrigatória. Não muda ao atualizar o plano de ação.",
    colorClass: "bg-orange-100 text-orange-800",
    icon: AlertCircle,
    priority: 21,
  }),
  evidencia_insuficiente: entry({
    key: "evidencia_insuficiente",
    label: RECOMMENDATION_TYPE_LABELS.evidencia_insuficiente,
    description: "Motivo da recomendação: a evidência foi insuficiente ou não aprovada. Não muda ao atualizar o plano de ação.",
    colorClass: "bg-amber-100 text-amber-900",
    icon: AlertCircle,
    priority: 22,
  }),
};

export const ACTION_PLAN_REGISTRY: Record<PlanStatus, StatusRegistryEntry> = {
  not_started: entry({ key: "not_started", label: "Não iniciado", colorClass: STATUS_BADGE_SURFACE.neutral, icon: Hourglass, priority: 48 }),
  in_progress: entry({ key: "in_progress", label: "Em andamento", colorClass: STATUS_BADGE_SURFACE.info, icon: PlayCircle, priority: 36 }),
  completed: entry({ key: "completed", label: "Concluída", colorClass: STATUS_BADGE_SURFACE.success, icon: CheckCircle2, priority: 100 }),
  cancelled: entry({ key: "cancelled", label: "Cancelado", colorClass: STATUS_BADGE_SURFACE.muted, icon: CircleOff, priority: 90 }),
};

const FORM_WORKFLOW_REGISTRY: Record<CycleState, StatusRegistryEntry> = {
  draft: entry({ key: "draft", label: CYCLE_STATE_LABEL.draft, colorClass: "bg-slate-50 text-slate-700", icon: ClipboardList, priority: 60 }),
  in_response: entry({ key: "in_response", label: CYCLE_STATE_LABEL.in_response, colorClass: "bg-sky-50 text-sky-700", icon: PlayCircle, priority: 50 }),
  submitted: entry({ key: "submitted", label: CYCLE_STATE_LABEL.submitted, colorClass: "bg-sky-50 text-sky-700", icon: Send, priority: 45 }),
  in_validation: entry({ key: "in_validation", label: CYCLE_STATE_LABEL.in_validation, colorClass: "bg-indigo-50 text-indigo-700", icon: Eye, priority: 38 }),
  awaiting_adjustment: entry({ key: "awaiting_adjustment", label: CYCLE_STATE_LABEL.awaiting_adjustment, colorClass: "bg-amber-50 text-amber-700", icon: FileQuestion, priority: 22 }),
  validated: entry({ key: "validated", label: CYCLE_STATE_LABEL.validated, colorClass: "bg-emerald-50 text-emerald-700", icon: ShieldCheck, priority: 85 }),
  completed: entry({ key: "completed", label: CYCLE_STATE_LABEL.completed, colorClass: "bg-slate-50/70 text-slate-600", icon: CheckCircle2, priority: 100 }),
};

const REPORT_JOB_REGISTRY: Record<RespondentReportJobStatus, StatusRegistryEntry> = {
  queued: entry({ key: "queued", label: "Em fila", colorClass: "bg-slate-50/70 text-slate-700", icon: Clock, priority: 44 }),
  processing: entry({ key: "processing", label: "Processando", colorClass: "bg-sky-50 text-sky-700", icon: Loader2, priority: 40 }),
  completed: entry({ key: "completed", label: "Concluído", colorClass: "bg-emerald-50 text-emerald-700", icon: CheckCircle2, priority: 100 }),
  failed: entry({ key: "failed", label: "Falhou", colorClass: "bg-rose-50 text-rose-700", icon: AlertCircle, priority: 10 }),
  outdated: entry({ key: "outdated", label: "Desatualizado", colorClass: "bg-amber-50 text-amber-700", icon: RefreshCw, priority: 28 }),
  available: entry({ key: "available", label: "Disponível", colorClass: "bg-indigo-50 text-indigo-700", icon: HelpCircle, priority: 92 }),
};

export type FamiMaturityLevel = 1 | 2 | 3 | 4 | 5;

export const FAMI_MATURITY_LEVEL_REGISTRY: Record<FamiMaturityLevel, StatusRegistryEntry> = {
  1: entry({ key: "fami_level_1", label: "Nível 1 · Inicial", colorClass: "border border-[#E12456]/25 bg-[#E12456]/10 text-[#B01B44]", icon: Flame, priority: 10 }),
  2: entry({ key: "fami_level_2", label: "Nível 2 · Em desenvolvimento", colorClass: "border border-[#C3681D]/25 bg-[#C3681D]/10 text-[#8F4B14]", icon: Compass, priority: 20 }),
  3: entry({ key: "fami_level_3", label: "Nível 3 · Intermediário", colorClass: "border border-[#007AC3]/25 bg-[#007AC3]/10 text-[#005F97]", icon: Target, priority: 30 }),
  4: entry({ key: "fami_level_4", label: "Nível 4 · Avançado", colorClass: "border border-[#663300]/25 bg-[#663300]/10 text-[#663300]", icon: Medal, priority: 40 }),
  5: entry({ key: "fami_level_5", label: "Nível 5 · Maduro", colorClass: "border border-[#009669]/25 bg-[#009669]/10 text-[#007A55]", icon: Award, priority: 50 }),
};

export type WorkflowStatusDomain =
  | "evidence_validation"
  | "recommendation"
  | "action_plan"
  | "report_job"
  | "form_workflow"
  | "fami_maturity_level";

export type WorkflowStatusMap = {
  evidence_validation: ValidationStatus;
  recommendation: RecommendationStatus;
  action_plan: PlanStatus;
  report_job: RespondentReportJobStatus;
  form_workflow: CycleState;
  fami_maturity_level: FamiMaturityLevel;
};

const WORKFLOW_STATUS_REGISTRY: {
  [K in WorkflowStatusDomain]: Record<WorkflowStatusMap[K], StatusRegistryEntry>;
} = {
  evidence_validation: EVIDENCE_VALIDATION_REGISTRY,
  recommendation: RECOMMENDATION_REGISTRY,
  action_plan: ACTION_PLAN_REGISTRY,
  report_job: REPORT_JOB_REGISTRY,
  form_workflow: FORM_WORKFLOW_REGISTRY,
  fami_maturity_level: FAMI_MATURITY_LEVEL_REGISTRY,
};

const FALLBACK_ENTRY: StatusRegistryEntry = entry({
  key: "unknown",
  label: "Indefinido",
  colorClass: "bg-slate-50/70 text-slate-600",
  icon: HelpCircle,
  priority: 999,
});

export function recommendationTypeEntry(type: string): StatusRegistryEntry {
  const key = type.trim();
  if (!key) return FALLBACK_ENTRY;
  return RECOMMENDATION_TYPE_REGISTRY[key] ?? { ...FALLBACK_ENTRY, key };
}

export function recommendationTypeLabel(type: string | null | undefined): string {
  if (type == null || type.trim() === "") return "—";
  return recommendationTypeEntry(type).label;
}

export function workflowStatusLabel<D extends WorkflowStatusDomain>(
  domain: D,
  status: WorkflowStatusMap[D] | string | null | undefined,
): string {
  if (status == null || String(status).trim() === "") return "—";
  return workflowStatusEntry(domain, status as WorkflowStatusMap[D]).label;
}

export function workflowStatusEntry<D extends WorkflowStatusDomain>(
  domain: D,
  status: WorkflowStatusMap[D],
): StatusRegistryEntry {
  const map = WORKFLOW_STATUS_REGISTRY[domain] as Record<string, StatusRegistryEntry>;
  const key = String(status);
  return map[key] ?? RECOMMENDATION_TYPE_REGISTRY[key] ?? { ...FALLBACK_ENTRY, key };
}

export type WorkflowStatusFilterOption<D extends WorkflowStatusDomain> = {
  value: WorkflowStatusMap[D];
  label: string;
};

export function workflowStatusFilterOptions<D extends WorkflowStatusDomain>(
  domain: D,
  options?: { exclude?: ReadonlyArray<WorkflowStatusMap[D]> },
): WorkflowStatusFilterOption<D>[] {
  const map = WORKFLOW_STATUS_REGISTRY[domain] as Record<string, StatusRegistryEntry>;
  const exclude = new Set<string>((options?.exclude ?? []).map((v) => String(v)));
  return (Object.keys(map) as Array<WorkflowStatusMap[D]>)
    .filter((k) => !exclude.has(String(k)))
    .map((k) => ({ value: k, label: map[String(k)].label }));
}
