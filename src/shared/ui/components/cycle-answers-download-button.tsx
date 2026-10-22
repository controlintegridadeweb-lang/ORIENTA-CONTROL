"use client";

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { downloadHttpAttachment } from "@/shared/export/download-http-attachment";
import { formSurface } from "@/shared/layout/form-surface";
import { cycleAnswersExportPath } from "@/shared/navigation/cycle-answers-export-path";

type Props = {
  cycleId: string;
  className?: string;
};

export function CycleAnswersDownloadButton({ cycleId, className }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await downloadHttpAttachment(cycleAnswersExportPath(cycleId), "respostas.xlsx");
    } catch (cause) {
      setError(cause instanceof Error && cause.message ? cause.message : "Não foi possível baixar as respostas.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void download()}
        disabled={pending}
        aria-busy={pending}
        className={className ?? `${formSurface.secondaryButtonSm} w-full sm:w-auto`}
      >
        <FileSpreadsheet className="h-3.5 w-3.5" aria-hidden />
        {pending ? "Baixando..." : "Baixar respostas"}
      </button>
      {error ? (
        <p role="alert" className="basis-full text-xs text-rose-700">
          {error}
        </p>
      ) : null}
    </>
  );
}
