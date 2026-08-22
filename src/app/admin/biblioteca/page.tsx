import { BibliotecaShell } from "@/features/library/components/library-shell";
import { firstSearchParam } from "@/features/admin/search-params";
import { LIBRARY_ITEM_STATUSES, type LibraryCatalogSnapshot, type LibraryItemStatus } from "@/features/library/types";
import { LibraryService } from "@/features/library/service";
import { logWarn } from "@/infrastructure/observability/logger";

const EMPTY_SNAPSHOT: LibraryCatalogSnapshot = {
  axes: [],
  sections: [],
  recommendations: [],
};

async function loadSnapshot(): Promise<{ snapshot: LibraryCatalogSnapshot; error: string | null }> {
  try {
    const service = new LibraryService();
    const snapshot = await service.snapshotCatalog();
    return { snapshot, error: null };
  } catch (error) {
    logWarn("Failed to load biblioteca snapshot", error, { route: "/admin/biblioteca" });
    return {
      snapshot: EMPTY_SNAPSHOT,
      error: error instanceof Error ? error.message : "Não foi possível carregar a biblioteca geral.",
    };
  }
}

export default async function AdminBibliotecaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [loaded, params] = await Promise.all([loadSnapshot(), searchParams]);
  const rawStatus = firstSearchParam(params, "status") as LibraryItemStatus | undefined;
  const rawPage = Number(firstSearchParam(params, "page") ?? "1");

  return (
    <BibliotecaShell
      initial={loaded.snapshot}
      layout="admin"
      error={loaded.error}
      initialView={{
        search: firstSearchParam(params, "q") ?? "",
        status: rawStatus && LIBRARY_ITEM_STATUSES.includes(rawStatus) ? rawStatus : "all",
        tag: firstSearchParam(params, "tag") ?? "",
        page: Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1,
      }}
    />
  );
}
