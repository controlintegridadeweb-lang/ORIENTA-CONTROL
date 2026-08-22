import { evidenceFileUrl } from "@/features/evidences/file-links";

type Props = {
  evidenceId: string;
};

export function EvidenceFileActions({ evidenceId }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <a
        href={evidenceFileUrl(evidenceId)}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200/80 bg-white px-3 py-2 text-sm font-medium text-brand-800 shadow-sm transition hover:border-brand-300 hover:bg-brand-50"
      >
        Visualizar arquivo
      </a>
      <a
        href={evidenceFileUrl(evidenceId, { download: true })}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50"
      >
        Baixar arquivo
      </a>
    </div>
  );
}
