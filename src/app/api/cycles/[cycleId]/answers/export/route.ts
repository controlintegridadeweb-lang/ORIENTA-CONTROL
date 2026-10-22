import { NextResponse } from "next/server";
import { resolveAuthorizedCycleScope } from "@/features/cycles/server";
import { loadFormBasic } from "@/features/forms/answers-queries";
import { loadCycleAnswersExport } from "@/features/forms/cycle-answers/load";
import { buildCycleAnswersXlsx } from "@/features/forms/cycle-answers/xlsx";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";

export const GET = withRoute<{ cycleId: string }>(
  {
    roles: ["admin", "respondent"],
    route: "/api/cycles/[cycleId]/answers/export",
    logMessage: "Failed to export cycle answers",
  },
  async ({ auth, params }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const supabase = createSupabaseServiceRoleClient();
    const authorized = await resolveAuthorizedCycleScope(supabase, auth, cycleId);
    if (authorized.error) return authorized.error;

    const form = await loadFormBasic(supabase, authorized.scope.formId);
    const data = await loadCycleAnswersExport(supabase, {
      cycleId,
      formVersionId: authorized.scope.cycle.formVersionId,
      formName: form.name,
    });
    const file = await buildCycleAnswersXlsx(data);

    return new NextResponse(new Uint8Array(file.content), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${file.filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);
