import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { listFamiCycleOptions } from "@/features/fami/cycle-options";

const querySchema = z.object({ organizationId: z.string().uuid().optional() });

/** Ciclos com processamento FAMI concluído disponíveis para leitura histórica explícita. */
export const GET = withRoute(
  { roles: ["admin", "respondent"], route: "/api/fami/cycles", logMessage: "Failed to list FAMI cycles" },
  async ({ request, auth }) => {
    const parsed = querySchema.safeParse({
      organizationId: new URL(request.url).searchParams.get("organizationId") ?? undefined,
    });
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    const organizationId = auth.role === "respondent"
      ? auth.organizationId ?? undefined
      : parsed.data.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId é obrigatório para selecionar um diagnóstico FAMI." }, { status: 400 });
    }
    const tenantError = ensureOrganizationAccess(auth, organizationId);
    if (tenantError) return tenantError;

    const cycles = await listFamiCycleOptions(
      createSupabaseServiceRoleClient(),
      organizationId,
    );
    return NextResponse.json({ cycles });
  },
);
