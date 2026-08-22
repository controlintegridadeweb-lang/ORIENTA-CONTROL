import { NextResponse } from "next/server";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { withRoute } from "@/infrastructure/api/with-route";
import { LibraryService, libraryCatalogEntitySchema } from "@/features/library/server";

export const POST = withRoute<{ entity: string }>(
  { roles: ["admin"], route: "/api/admin/library/[entity]", logMessage: "Failed to create library item" },
  async ({ request, auth, params }) => {
    const parsedEntity = libraryCatalogEntitySchema.safeParse(params.entity);
    if (!parsedEntity.success) {
      throw new DomainValidationError([{ path: "entity", message: "Entidade da biblioteca inválida." }]);
    }
    const item = await new LibraryService().create(parsedEntity.data, await request.json(), { userId: auth.userId });
    return NextResponse.json({ item }, { status: 201 });
  },
);
