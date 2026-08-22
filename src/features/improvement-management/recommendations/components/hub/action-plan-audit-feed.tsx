"use client";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import type { ActionPlanAuditEntry } from "@/features/improvement-management/action-plans/types";
import {
  formatActivityRelative,
  parseActionPlanAuditEntry,
  type ParsedActionPlanAuditEvent,
} from "@/features/improvement-management/action-plans/audit-presentation";
import { typography } from "@/shared/layout/design-system";

export type AuditFeedItem = {
  id: string;
  entry: ActionPlanAuditEntry;
  actionLabel?: string;
};

type Props = {
  items: AuditFeedItem[];
  emptyMessage?: string;
};

const TONE_STYLE: Record<
  ParsedActionPlanAuditEvent["tone"],
  { iconBg: string; iconColor: string }
> = {
  success: { iconBg: "bg-emerald-600", iconColor: "text-white" },
  info: { iconBg: "bg-sky-600", iconColor: "text-white" },
  warning: { iconBg: "bg-amber-500", iconColor: "text-white" },
  neutral: { iconBg: "bg-slate-600", iconColor: "text-white" },
  muted: { iconBg: "bg-slate-500", iconColor: "text-white" },
};

function descriptionText(
  description: ParsedActionPlanAuditEvent["description"],
): string | null {
  if (description == null) return null;
  if (typeof description === "string") return description.trim() || null;
  return null;
}

function normalizePrefix(value: string): string {
  return value.replace(/…$/, "").trim();
}

function isSameContext(contextLine: string, descText: string): boolean {
  const context = normalizePrefix(contextLine);
  const desc = descText.trim();
  if (!context || !desc) return false;
  if (desc === contextLine || desc === context) return true;
  if (desc.startsWith(context) || context.startsWith(desc.slice(0, Math.min(desc.length, 48)))) {
    return true;
  }
  return false;
}

function resolveDetailLines(
  contextLine: string | null,
  descText: string | null,
): { context: string | null; detail: string | null } {
  if (contextLine && descText) {
    if (isSameContext(contextLine, descText)) {
      return { context: null, detail: descText };
    }
    return { context: contextLine, detail: descText };
  }
  return { context: contextLine, detail: descText };
}

export function ActionPlanAuditFeed({
  items,
  emptyMessage = "Nenhuma atividade registrada ainda.",
}: Props) {
  if (items.length === 0) {
    return (
      <p className={`py-2 text-center ${typography.auxiliary}`}>{emptyMessage}</p>
    );
  }

  return (
    <ol className="relative ml-1 space-y-3 border-l border-slate-200 pl-5">
      {items.map(({ id, entry, actionLabel }) => {
        const ev = parseActionPlanAuditEntry(entry);
        const style = TONE_STYLE[ev.tone];
        const Icon = ev.icon;
        const { context, detail } = resolveDetailLines(
          actionLabel?.trim() || null,
          descriptionText(ev.description),
        );

        return (
          <li key={id} className="relative">
            <span
              aria-hidden
              className={`absolute -left-[calc(1.25rem+10px)] top-3 flex h-5 w-5 items-center justify-center rounded-full ${style.iconBg}`}
            >
              <Icon className={`h-3 w-3 ${style.iconColor}`} strokeWidth={2.25} />
            </span>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 transition-colors hover:border-slate-300 hover:bg-white">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                <p className="text-sm font-semibold text-slate-900">{ev.label}</p>
                <time
                  className="shrink-0 text-micro tabular-nums text-slate-400"
                  dateTime={ev.date}
                  title={formatPlatformDateTime(ev.date, { dateStyle: "short", timeStyle: "short" })}
                >
                  {formatActivityRelative(ev.date)}
                </time>
              </div>
              {context ? (
                <p className="mt-1.5 line-clamp-1 text-xs font-medium text-slate-700">{context}</p>
              ) : null}
              {detail ? (
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-slate-600">{detail}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
