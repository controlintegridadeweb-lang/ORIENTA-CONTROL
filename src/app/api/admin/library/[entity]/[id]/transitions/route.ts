import { NextResponse } from "next/server";
import { z } from "zod";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { LibraryService, libraryCatalogEntitySchema } from "@/features/library/server";

const bodySchema = z.object({
  action: z.enum(["submit_for_review", "return_review", "publish", "deprecate", "archive"]),
  justification: z.string().trim().max(2000).nullish(),
  reviewerUserId: z.string().uuid().nullish(),
}).strict();

type Params = { entity: string; id: string };

export const POST = withRoute<Params>(
  { roles: ["admin"], route: "/api/admin/library/[entity]/[id]/transitions", logMessage: "Failed to transition library item" },
  async ({ request, auth, params }) => {
    const parsedEntity = libraryCatalogEntitySchema.safeParse(params.entity);
    if (!parsedEntity.success) {
      throw new DomainValidationError([{ path: "entity", message: "Entidade da biblioteca inválida." }]);
    }
    const id = requireUuid(params.id, "id");
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new DomainValidationError(parsed.error.issues.map((issue: { path: PropertyKey[]; message: string }) => ({
        path: issue.path.join(".") || "_",
        message: issue.message,
      })));
    }
    const context = {
      userId: auth.userId,
      justification: parsed.data.justification ?? null,
      reviewerUserId: parsed.data.reviewerUserId ?? null,
    };
    const service = new LibraryService();
    const item = parsed.data.action === "submit_for_review"
      ? await service.submitForReview(parsedEntity.data, id, context)
      : parsed.data.action === "return_review"
        ? await service.returnReview(parsedEntity.data, id, context)
        : parsed.data.action === "publish"
          ? await service.publish(parsedEntity.data, id, context)
          : parsed.data.action === "deprecate"
            ? await service.deprecate(parsedEntity.data, id, context)
            : await service.archive(parsedEntity.data, id, context);
    return NextResponse.json({ item });
  },
);
