import {
  EvidencesShell,
  type EvidencesShellInitialFilters,
} from "@/features/evidences/components/admin/evidences-shell";
import { firstSearchParam } from "@/features/admin/search-params";
import { layout } from "@/shared/layout/design-system";

function parseOffset(value: string | undefined): number {
  const offset = Number(value);
  return Number.isInteger(offset) && offset >= 0 ? offset : 0;
}

export default async function AdminEvidenciasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const st = firstSearchParam(sp, "status");
  const initialFilters: EvidencesShellInitialFilters = {
    cycleId: firstSearchParam(sp, "cycleId") ?? "",
    questionId: firstSearchParam(sp, "questionId") ?? "",
    evidenceId: firstSearchParam(sp, "evidenceId") ?? "",
    organizationId: firstSearchParam(sp, "organizationId") ?? "",
    formId: firstSearchParam(sp, "formId") ?? "",
    search: firstSearchParam(sp, "search") ?? "",
    from: firstSearchParam(sp, "from") ?? "",
    to: firstSearchParam(sp, "to") ?? "",
    offset: parseOffset(firstSearchParam(sp, "offset")),
    ...(st ? { status: st as EvidencesShellInitialFilters["status"] } : {}),
  };

  return (
    <div className={layout.pageStack}>
      <EvidencesShell initialFilters={initialFilters} />
    </div>
  );
}
