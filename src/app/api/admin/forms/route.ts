import { NextResponse } from "next/server";
import { withRoute } from "@/infrastructure/api/with-route";
import { FormsAdminService, FormsValidationError } from "@/features/forms/admin-service";

export const GET = withRoute(
  { roles: ["admin"], route: "/api/admin/forms", logMessage: "Failed to list forms" },
  async ({ request }) => {
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? "25") || 25));
    const result = await new FormsAdminService().listPage({
      state: url.searchParams.get("state"),
      search: url.searchParams.get("search"),
      limit,
      offset: (page - 1) * limit,
    });
    return NextResponse.json({ ...result, page, totalPages: Math.max(1, Math.ceil(result.total / limit)) });
  },
);

export const POST = withRoute(
  { roles: ["admin"], route: "/api/admin/forms", logMessage: "Failed to create form" },
  async ({ request, auth }) => {
    if (!auth.userId) {
      throw new FormsValidationError([
        { path: "_", message: "Autenticação obrigatória para criar formulário." },
      ]);
    }
    const payload = await request.json();
    const service = new FormsAdminService();
    const form = await service.create(payload, { userId: auth.userId });
    return NextResponse.json({ form }, { status: 201 });
  },
);
