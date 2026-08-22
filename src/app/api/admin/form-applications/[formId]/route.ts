import { NextResponse } from "next/server";
import { DomainNotFoundError } from "@/infrastructure/api/domain-errors";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { loadFormManagementDetails } from "@/features/cycles/server";

export const GET = withRoute<{ formId: string }>(
  { roles: ["admin"], route: "/api/admin/form-applications/[formId]", logMessage: "Failed to load form application management" },
  async ({ request, params }) => {
    const formId = requireUuid(params.formId, "formId");
    const periodLabel = new URL(request.url).searchParams.get("periodLabel")?.trim() || null;
    const details = await loadFormManagementDetails(createSupabaseServiceRoleClient(), { formId, periodLabel });
    if (!details) throw new DomainNotFoundError("Aplicação do formulário não encontrada.");
    return NextResponse.json({ details });
  },
);
