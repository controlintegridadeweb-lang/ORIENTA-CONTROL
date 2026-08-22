"use client";

import { formatPlatformDateTime } from "@/shared/datetime/platform-date-time";
import { ExternalLink } from "lucide-react";
import type { EvidenceListItem } from "@/features/evidences/types";
import { normalizeWorkbenchText } from "@/features/evidences/normalize-workbench-text";
import { evidenceFileUrl } from "@/features/evidences/file-links";
import { typography } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { StatusBadge } from "./status-badge";

type Props = {
  items: EvidenceListItem[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onOpenDetail: (item: EvidenceListItem) => void;
};

export function EvidencesCardsList({ items, selected, onToggleSelect, onOpenDetail }: Props) {
  return (
    <ul className="md:hidden space-y-3.5">
      {items.map((item, index) => {
        const titleText = normalizeWorkbenchText(item.title);
        const contextLine = `${item.formName} v${item.formVersion} · ${item.questionPrompt}`;
        const stripe =
          index % 2 === 1 ? "bg-slate-50/40" : "";

        return (
          <li key={item.id}>
            <article
              className={`${formSurface.entityListCard} ${stripe} border-slate-200/90 px-0 py-0`}
            >
              <div className="flex gap-3 px-4 pt-4 sm:px-5 sm:pt-5">
                <Checkbox
                  id={`ev-card-${item.id}`}
                  checked={selected.has(item.id)}
                  onChange={() => onToggleSelect(item.id)}
                  aria-label={`Selecionar ${titleText}`}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <p
                    className="line-clamp-2 text-micro leading-snug text-slate-500"
                    title={contextLine}
                  >
                    {contextLine}
                  </p>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className={`min-w-0 flex-1 ${typography.cardTitle}`}>
                      <span className="line-clamp-2" title={titleText || undefined}>
                        {titleText}
                      </span>
                    </h3>
                    <div className="flex shrink-0 flex-col items-end gap-1.5 sm:items-start sm:pt-0.5">
                      <StatusBadge status={item.currentStatus} />
                      <time
                        className={`${typography.meta} tabular-nums`}
                        dateTime={item.submittedAt}
                        title={formatPlatformDateTime(item.submittedAt, { dateStyle: "short", timeStyle: "short" })}
                      >
                        {formatPlatformDateTime(item.submittedAt, { dateStyle: "short", timeStyle: "short" })}
                      </time>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 bg-slate-50/50 px-4 py-3.5 sm:px-5">
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-0.5">
                    <dt className="text-micro font-medium uppercase tracking-wider text-slate-500">
                      Organização
                    </dt>
                    <dd
                      className="truncate text-sm font-medium text-slate-800"
                      title={item.organizationName}
                    >
                      {item.organizationName}
                    </dd>
                  </div>
                  <div className="space-y-0.5">
                    <dt className="text-micro font-medium uppercase tracking-wider text-slate-500">
                      Anexo
                    </dt>
                    <dd className="text-sm">
                      {item.externalLink ? (
                        <a
                          href={item.externalLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex max-w-full items-center gap-1 truncate font-medium text-sky-700 hover:underline"
                          title={item.externalLink}
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden /> Link enviado
                        </a>
                      ) : item.storagePath ? (
                        <a
                          href={evidenceFileUrl(item.id)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-sky-700 hover:underline"
                        >
                          Visualizar arquivo
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-4 py-3 sm:px-5">
                <button
                  type="button"
                  onClick={() => onOpenDetail(item)}
                  className={`${formSurface.secondaryButtonSm} w-full justify-center sm:w-auto`}
                >
                  Abrir detalhes
                </button>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
