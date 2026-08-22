"use client";

import { formatPlatformDate, formatPlatformTime } from "@/shared/datetime/platform-date-time";
import { ExternalLink } from "lucide-react";
import type { EvidenceListItem } from "@/features/evidences/types";
import { normalizeWorkbenchText } from "@/features/evidences/normalize-workbench-text";
import { evidenceFileUrl } from "@/features/evidences/file-links";
import { typography } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import { Checkbox } from "@/shared/ui/components/checkbox";
import { StatusBadge } from "./status-badge";

type Props = {
  item: EvidenceListItem;
  zebraEven: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onOpen: () => void;
  selectId: string;
};

export function EvidenceRow({
  item,
  zebraEven,
  selected,
  onToggleSelect,
  onOpen,
  selectId,
}: Props) {
  const titleText = normalizeWorkbenchText(item.title);
  const zebraClass = zebraEven
    ? formSurface.brandTable.rowEven
    : formSurface.brandTable.rowOdd;

  return (
    <tr className={zebraClass}>
      <td className={`${formSurface.brandTable.cell} w-10 pl-4 sm:pl-5`}>
        <Checkbox
          id={selectId}
          checked={selected}
          onChange={() => onToggleSelect(item.id)}
          aria-label={`Selecionar evidência ${titleText}`}
        />
      </td>
      <td className={`${formSurface.brandTable.cell} min-w-0 text-slate-800`}>
        <p className="truncate font-semibold text-slate-900" title={item.formName}>
          {item.formName}
        </p>
        <p className={`mt-1 ${typography.meta} tabular-nums`} title={`Versao ${item.formVersion}`}>
          v{item.formVersion}
        </p>
      </td>
      <td className={`${formSurface.brandTable.cell} min-w-0`}>
        <p className="line-clamp-2 text-sm text-slate-800" title={item.questionPrompt}>
          {item.questionPrompt}
        </p>
      </td>
      <td className={`${formSurface.brandTable.cell} min-w-0`}>
        <p className="truncate text-sm font-medium text-slate-900" title={item.organizationName}>
          {item.organizationName}
        </p>
      </td>
      <td className={`${formSurface.brandTable.cell} whitespace-nowrap text-xs tabular-nums text-slate-600`}>
        {formatPlatformDate(item.submittedAt, { dateStyle: "short" })}
        <span className={`mt-1 block text-2xs font-normal text-slate-400`}>
          {formatPlatformTime(item.submittedAt)}
        </span>
      </td>
      <td className={`${formSurface.brandTable.cell} align-middle`}>
        <div className="flex min-h-8 items-center">
          <StatusBadge status={item.currentStatus} />
        </div>
      </td>
      <td className={`${formSurface.brandTable.cell} min-w-0`}>
        <p className="line-clamp-2 text-sm font-medium text-slate-900" title={titleText || undefined}>
          {titleText}
        </p>
        <div className="mt-1 flex min-h-5 flex-wrap items-center gap-2 text-micro">
          {item.externalLink ? (
            <a
              href={item.externalLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex max-w-full items-center gap-1 truncate text-sky-700 hover:underline"
              title={item.externalLink}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-3 w-3 shrink-0" aria-hidden /> Link
            </a>
          ) : item.storagePath ? (
            <a
              href={evidenceFileUrl(item.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-sky-700 hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              Visualizar arquivo
            </a>
          ) : (
            <span className="text-slate-400">—</span>
          )}
        </div>
      </td>
      <td className={`${formSurface.brandTable.cell} pr-4 text-right sm:pr-5`}>
        <button
          type="button"
          onClick={onOpen}
          className={formSurface.primaryButtonSm}
        >
          Detalhes
        </button>
      </td>
    </tr>
  );
}
