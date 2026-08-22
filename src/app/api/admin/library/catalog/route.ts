import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { LibraryService } from "@/features/library/server";


export const GET = withRoute(
  { roles: ["admin"], route: "/api/admin/library/catalog", logMessage: "Failed to load library catalog snapshot" },
  async () => {
    const catalog = await new LibraryService().snapshotCatalog();
    return NextResponse.json(catalog);
  },
);
