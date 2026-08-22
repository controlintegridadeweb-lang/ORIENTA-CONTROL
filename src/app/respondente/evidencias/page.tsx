import { redirect } from "next/navigation";
import { getCurrentUser } from "@/infrastructure/auth/current-user";
import { firstSearchParam } from "@/features/admin/search-params";
import { respondentEvidenceFilterOptions } from "@/features/evidences/respondent-service";
import {
  RespondentEvidencesShell,
  type RespondentEvidencesShellInitial,
} from "@/features/evidences/components/respondent/respondent-evidences-shell";
import { layout } from "@/shared/layout/design-system";
import { formSurface } from "@/shared/layout/form-surface";
import { validationStatusSchema } from "@/features/evidences/schemas";
import { respondentEvidenceListPath } from "@/shared/navigation/evidence-list-paths";
import { isInvalidUuidParam, parseUuidParam } from "@/shared/validation/uuid";

function parseOffset(value: string | undefined): number {
  const offset = Number(value);
  return Number.isInteger(offset) && offset >= 0 ? offset : 0;
}

/** Rota canônica de consulta de todas as evidências do respondente. */

export default async function RespondenteEvidenciasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawCycleId = firstSearchParam(sp, "cycleId");
  const rawFormId = firstSearchParam(sp, "formId");
  const rawStatus = firstSearchParam(sp, "status");
  const cycleId = parseUuidParam(rawCycleId);
  const formId = parseUuidParam(rawFormId);
  const parsedStatus = rawStatus ? validationStatusSchema.safeParse(rawStatus) : null;

  if (isInvalidUuidParam(rawCycleId) || isInvalidUuidParam(rawFormId)) {
    redirect(
      respondentEvidenceListPath({
        cycleId,
        formId,
        search: firstSearchParam(sp, "search"),
        axisName: firstSearchParam(sp, "axisName"),
        sectionName: firstSearchParam(sp, "sectionName"),
        pendingOnly: firstSearchParam(sp, "pendingOnly") === "1",
        offset: parseOffset(firstSearchParam(sp, "offset")),
        status: parsedStatus?.success ? parsedStatus.data : undefined,
      }),
    );
  }
  const user = await getCurrentUser();
  if (!user?.organizationId) {
    return (
      <div className={formSurface.messageWarning}>
        Sua conta não está vinculada a uma organização. Entre em contato com o administrador.
      </div>
    );
  }

  const filterOptions = await respondentEvidenceFilterOptions(user.organizationId);
  const initial: RespondentEvidencesShellInitial = {
    cycleId,
    formId,
    search: firstSearchParam(sp, "search") ?? undefined,
    axisName: firstSearchParam(sp, "axisName") ?? undefined,
    sectionName: firstSearchParam(sp, "sectionName") ?? undefined,
    pendingOnly: firstSearchParam(sp, "pendingOnly") === "1",
    offset: parseOffset(firstSearchParam(sp, "offset")),
    status: parsedStatus?.success ? parsedStatus.data : undefined,
  };

  return (
    <div className={layout.pageStack}>
      <RespondentEvidencesShell
        formOptions={filterOptions.forms}
        cycleOptions={filterOptions.cycles}
        hierarchyOptions={filterOptions.hierarchy}
        initial={initial}
      />
    </div>
  );
}
