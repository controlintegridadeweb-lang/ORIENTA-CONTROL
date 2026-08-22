import { NextResponse } from "next/server";
import { cycleStateLabelOrFallback } from "@/shared/domain/cycle-labels";

export function lockedEvidenceUploadResponse(state: string, paused = false) {
  return NextResponse.json(
    {
      error: paused
        ? "A coleta deste diagnóstico está temporariamente suspensa pela administração."
        : "O upload de evidências está bloqueado nesta etapa do diagnóstico: " +
          `${cycleStateLabelOrFallback(state)}.`,
    },
    { status: 409 },
  );
}
