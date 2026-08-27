import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import type { AuthContext } from "@/infrastructure/api/auth";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { ensureRespondentAssignmentAccess } from "@/features/forms/assignments/http";
import { resolveCycleOperationalScope } from "@/infrastructure/supabase/cycle-operational-scope";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { listBimonthlyReports } from "@/features/improvement-management/monitoring/bimonthly/read";
import { materializeBimonthlyReport } from "@/features/improvement-management/monitoring/bimonthly/materialize-service";

const querySchema = z.object({
  cycleId: z.string().uuid(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
});

const bodySchema = z
  .object({
    cycleId: z.string().uuid(),
    referenceYear: z.number().int().min(1900).max(2100),
    bimester: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
      z.literal(5),
      z.literal(6),
    ]),
  })
  .strict();

function databaseMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  return String((error as { message?: unknown }).message ?? "");
}

function bimonthlyErrorResponse(error: unknown): NextResponse | null {
  const message = databaseMessage(error);
  if (message.includes("bimonthly_period_not_started")) {
    return NextResponse.json({ error: "O bimestre ainda não começou." }, { status: 409 });
  }
  if (message.includes("bimonthly_period_already_closed")) {
    return NextResponse.json(
      { error: "Este bimestre já foi fechado e o relatório histórico não pode ser alterado." },
      { status: 409 },
    );
  }
  if (message.includes("bimonthly_period_not_closed")) {
    return NextResponse.json(
      { error: "O fechamento automático só ocorre depois da data de corte." },
      { status: 409 },
    );
  }
  if (message.includes("bimonthly_source_fami_not_available_for_period")) {
    return NextResponse.json(
      {
        error:
          "Não existe Resultado FAMI oficial com data anterior ou igual à data de corte deste bimestre.",
      },
      { status: 409 },
    );
  }
  if (message.includes("bimonthly_cycle_not_found")) {
    return NextResponse.json({ error: "Diagnóstico não encontrado." }, { status: 404 });
  }
  if (message.includes("bimonthly_admin_required") || message.includes("preliminary_admin_required")) {
    return NextResponse.json(
      { error: "Somente administradores podem gerar o relatório de acompanhamento." },
      { status: 403 },
    );
  }
  return null;
}

async function assertCycleAccess(
  cycleId: string,
  auth: AuthContext,
): Promise<Response | null> {
  const scope = await resolveCycleOperationalScope(
    createSupabaseServiceRoleClient(),
    cycleId,
  );
  if (!scope) {
    return NextResponse.json({ error: "Diagnóstico não encontrado." }, { status: 404 });
  }
  const tenantError = ensureOrganizationAccess(auth, scope.cycle.organizationId);
  if (tenantError) return tenantError;
  return ensureRespondentAssignmentAccess(
    auth.role,
    scope.formId,
    scope.cycle.organizationId,
  );
}

export const GET = withRoute(
  {
    roles: ["admin", "respondent"],
    route: "/api/monitoring/bimonthly",
    internalErrorMessage: "Falha ao carregar os relatórios bimestrais.",
  },
  async ({ request, auth }) => {
    const url = new URL(request.url);
    const parsed = querySchema.safeParse({
      cycleId: url.searchParams.get("cycleId") ?? undefined,
      year: url.searchParams.get("year") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const accessError = await assertCycleAccess(parsed.data.cycleId, auth);
    if (accessError) return accessError;

    const payload = await listBimonthlyReports(
      createSupabaseServiceRoleClient(),
      parsed.data.cycleId,
      parsed.data.year,
    );
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store" },
    });
  },
);

export const POST = withRoute(
  {
    roles: ["admin"],
    route: "/api/monitoring/bimonthly",
    internalErrorMessage: "Não foi possível gerar o relatório bimestral.",
    extraErrorHandlers: [bimonthlyErrorResponse],
  },
  async ({ request, auth }) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const accessError = await assertCycleAccess(parsed.data.cycleId, auth);
    if (accessError) return accessError;

    const payload = await materializeBimonthlyReport(createSupabaseServiceRoleClient(), {
      cycleId: parsed.data.cycleId,
      referenceYear: parsed.data.referenceYear,
      bimester: parsed.data.bimester,
      actorUserId: auth.userId,
    });
    return NextResponse.json(payload, { status: 201 });
  },
);
