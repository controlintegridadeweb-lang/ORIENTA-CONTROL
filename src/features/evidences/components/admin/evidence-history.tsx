"use client";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import type { EvidenceValidationEntry } from "@/features/evidences/types";
import { StatusBadge } from "./status-badge";

export function EvidenceHistory({ history }: { history: EvidenceValidationEntry[] }) {
  if (history.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-500">
        Nenhuma validação registrada ainda.
      </p>
    );
  }
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/90 bg-white shadow-sm">
      <p className="border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-xs font-semibold text-slate-600">
        Histórico ({history.length})
      </p>
      <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto overscroll-contain">
        {history.map((entry) => (
          <li key={entry.id} className="space-y-1.5 px-3 py-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={entry.status} />
              <span className="tabular-nums text-slate-500">
                {formatPlatformDateTime(entry.validatedAt, { dateStyle: "short", timeStyle: "short" })}
              </span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">Administrador global</span>
            </div>
            {entry.justification ? (
              <p className="whitespace-pre-wrap rounded-md border border-slate-100 bg-slate-50/80 px-2.5 py-2 leading-relaxed text-slate-700">
                {entry.justification}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
