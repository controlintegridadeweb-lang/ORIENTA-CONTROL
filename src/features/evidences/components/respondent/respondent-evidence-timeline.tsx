"use client";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  FileQuestion,
  Hourglass,
  Upload,
  XCircle,
} from "lucide-react";
import { evidenceLabels } from "@/shared/labels/official-labels";
import { workflowStatusLabel } from "@/shared/ui/status-registry";
import type { EvidenceValidationEntry } from "@/features/evidences/types";

type Props = {
  submittedAt: string;
  history: EvidenceValidationEntry[];
};

type TimelineEntry = {
  key: string;
  label: string;
  description?: string | null;
  iso: string;
  Icon: LucideIcon;
  tone: "slate" | "emerald" | "rose" | "amber" | "sky";
};

function entryFromValidation(v: EvidenceValidationEntry): TimelineEntry {
  switch (v.status) {
    case "approved":
      return {
        key: v.id,
        label: `Validação: ${workflowStatusLabel("evidence_validation", "approved")}`,
        description: v.justification,
        iso: v.validatedAt,
        Icon: BadgeCheck,
        tone: "emerald",
      };
    case "invalidated":
      return {
        key: v.id,
        label: `Validação: ${workflowStatusLabel("evidence_validation", "invalidated")}`,
        description: v.justification,
        iso: v.validatedAt,
        Icon: XCircle,
        tone: "rose",
      };
    case "adjustment_requested":
      return {
        key: v.id,
        label: evidenceLabels.respondentAdjustmentStatus,
        description: v.justification,
        iso: v.validatedAt,
        Icon: FileQuestion,
        tone: "amber",
      };
    case "pending":
    default:
      return {
        key: v.id,
        label: `Validação: ${workflowStatusLabel("evidence_validation", "pending")}`,
        description: v.justification,
        iso: v.validatedAt,
        Icon: Hourglass,
        tone: "slate",
      };
  }
}

const TONE: Record<TimelineEntry["tone"], { ring: string; bg: string; text: string }> = {
  slate: { ring: "ring-slate-200", bg: "bg-slate-50", text: "text-slate-700" },
  emerald: { ring: "ring-emerald-200", bg: "bg-emerald-50", text: "text-emerald-700" },
  rose: { ring: "ring-rose-200", bg: "bg-rose-50", text: "text-rose-700" },
  amber: { ring: "ring-amber-200", bg: "bg-amber-50", text: "text-amber-800" },
  sky: { ring: "ring-sky-200", bg: "bg-sky-50", text: "text-sky-700" },
};

export function RespondentEvidenceTimeline({ submittedAt, history }: Props) {
  const sorted = [...history].sort(
    (a, b) => new Date(a.validatedAt).getTime() - new Date(b.validatedAt).getTime(),
  );

  const entries: TimelineEntry[] = [
    {
      key: "submitted",
      label: "Evidência enviada",
      iso: submittedAt,
      Icon: Upload,
      tone: "sky",
    },
    ...sorted.map(entryFromValidation),
  ];

  return (
    <ol className="relative ml-2 space-y-3 border-l border-slate-200 pl-5">
      {entries.map((e) => {
        const tone = TONE[e.tone];
        const Icon = e.Icon;
        return (
          <li key={e.key} className="relative">
            <span
              className={`absolute left-[-31px] flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-white ${tone.bg} ${tone.ring}`}
              aria-hidden
            >
              <Icon className={`h-3 w-3 ${tone.text}`} />
            </span>
            <p className="text-sm font-medium text-slate-900">{e.label}</p>
            <p className="text-micro text-slate-500">
              {e.iso ? formatPlatformDateTime(e.iso, { dateStyle: "short", timeStyle: "short" }) : "—"}
            </p>
            {e.description ? (
              <p className="mt-1 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
                {e.description}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
