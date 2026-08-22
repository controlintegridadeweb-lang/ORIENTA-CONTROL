import { RISK_META, type AdminPlanItem, type RiskLevel } from "@/features/improvement-management/action-plans/admin-monitoring";
import { formatLocalDate } from "@/shared/datetime/business-date";

export function firstLineRecommendation(text: string): string {
  const line = text.trim().split(/\r?\n/)[0]?.trim() ?? "";
  return line || "(sem título)";
}

/** Texto da ação cadastrada; null quando ainda não há plano/ação. */
export function firstLineAction(item: AdminPlanItem): string | null {
  const line = item.actionText.trim().split(/\r?\n/)[0]?.trim() ?? "";
  if (!line || !item.hasPlan) return null;
  return line;
}

export function formatPlanDate(iso: string | null | undefined): string {
  return formatLocalDate(iso);
}

export function riskBadge(risk: RiskLevel): { label: string; className: string } {
  const meta = RISK_META[risk];
  return { label: meta.label, className: meta.badgeClasses };
}
