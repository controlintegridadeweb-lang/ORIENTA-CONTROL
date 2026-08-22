import { NextResponse } from "next/server";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { LibraryService, libraryCatalogEntitySchema } from "@/features/library/server";

type Params = { entity: string; id: string };
const ROUTE = "/api/admin/library/[entity]/[id]";

function entity(value: string) {
  const parsed = libraryCatalogEntitySchema.safeParse(value);
  if (!parsed.success) {
    throw new DomainValidationError([{ path: "entity", message: "Entidade da biblioteca inválida." }]);
  }
  return parsed.data;
}

export const PUT = withRoute<Params>(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to update library item" },
  async ({ request, auth, params }) => {
    const id = requireUuid(params.id, "id");
    const item = await new LibraryService().update(entity(params.entity), id, await request.json(), { userId: auth.userId });
    return NextResponse.json({ item });
  },
);

export const DELETE = withRoute<Params>(
  { roles: ["admin"], route: ROUTE, logMessage: "Failed to delete library item" },
  async ({ auth, params }) => {
    const id = requireUuid(params.id, "id");
    await new LibraryService().remove(entity(params.entity), id, { userId: auth.userId });
    return NextResponse.json({ ok: true });
  },
);
