import type { PlanStatus } from "./schemas";

export type DbActionPlanStatus = "todo" | "doing" | "done" | "cancelled";

export function isDbActionPlanStatus(value: string): value is DbActionPlanStatus {
  return value === "todo" || value === "doing" || value === "done" || value === "cancelled";
}

/** Mapeia o contrato da interface para o enum `action_plan_status`. */
export function planStatusToDb(status: PlanStatus): DbActionPlanStatus {
  switch (status) {
    case "not_started":
      return "todo";
    case "in_progress":
      return "doing";
    case "completed":
      return "done";
    case "cancelled":
      return "cancelled";
  }
}

/** Mapeia um valor validado do enum do banco para a interface. */
export function planStatusFromDb(status: DbActionPlanStatus): PlanStatus {
  switch (status) {
    case "todo":
      return "not_started";
    case "doing":
      return "in_progress";
    case "done":
      return "completed";
    case "cancelled":
      return "cancelled";
  }
}

export function formatResponsibleLabel(sector: string, name: string): string {
  const s = sector.trim();
  const n = name.trim();
  if (s && n) return `${s} — ${n}`;
  return n || s;
}

export function parseResponsibleLabel(label: string): {
  sector: string;
  name: string;
} {
  const idx = label.indexOf("—");
  if (idx >= 0) {
    return {
      sector: label.slice(0, idx).trim(),
      name: label.slice(idx + 1).trim(),
    };
  }
  return { sector: "", name: label.trim() };
}
