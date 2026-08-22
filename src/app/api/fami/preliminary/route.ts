import { NextResponse } from "next/server";
import { z } from "zod";
import { withRoute } from "@/infrastructure/api/with-route";
import type { AuthContext } from "@/infrastructure/api/auth";
import { ensureOrganizationAccess } from "@/infrastructure/api/tenant-guard";
import { ensureRespondentAssignmentAccess } from "@/features/forms/assignments/http";
import { resolveCycleOperationalScope } from "@/infrastructure/supabase/cycle-operational-scope";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { listPreliminaryCheckpoints } from "@/features/fami/preliminary/read";

const querySchema = z.object({
  cycleId: z.string().uuid(),
  year: z.coerce.number().int().min(1900).max(2100).optional(),
});

const bodySchema = z
  .object({
    cycleId: z.string().uuid(),
    referenceYear: z.number().int().min(1900).max(2100),
    quadrimester: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  })
  .strict();

function databaseMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "";
  return String((error as { message?: unknown }).message ?? "");
}

function preliminaryErrorResponse(error: unknown): NextResponse | null {
  const message = databaseMessage(error);
  if (message.includes("preliminary_period_not_started")) {
    return NextResponse.json(
      { error: "O quadrimestre ainda não começou." },
      { status: 409 },
    );
  }
  if (message.includes("preliminary_period_already_closed")) {
    return NextResponse.json(
      { error: "Este quadrimestre já foi fechado e o snapshot histórico não pode ser alterado." },
      { status: 409 },
    );
  }
  if (message.includes("preliminary_period_not_closed")) {
    return NextResponse.json(
      { error: "O fechamento automático só ocorre depois da data de corte." },
      { status: 409 },
    );
  }
  if (message.includes("preliminary_source_fami_not_available_for_period")) {
    return NextResponse.json(
      { error: "Não existe Resultado FAMI oficial com data anterior ou igual à data de corte deste quadrimestre. Se o diagnóstico foi validado depois do corte, esse período não pode ser registrado." },
      { status: 409 },
    );
  }
  if (message.includes("preliminary_official_reconstruction_mismatch")) {
    return NextResponse.json(
      { error: "O Resultado FAMI oficial histórico não pôde ser reproduzido com segurança. O indicador preliminar não foi registrado." },
      { status: 409 },
    );
  }
  if (message.includes("preliminary_cycle_not_found")) {
    return NextResponse.json({ error: "Diagnóstico não encontrado." }, { status: 404 });
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
    route: "/api/fami/preliminary",
    internalErrorMessage: "Falha ao carregar o histórico do FAMI preliminar.",
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

    const payload = await listPreliminaryCheckpoints(
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
    route: "/api/fami/preliminary",
    internalErrorMessage: "Não foi possível calcular o FAMI preliminar.",
    extraErrorHandlers: [preliminaryErrorResponse],
  },
  async ({ request, auth }) => {
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const accessError = await assertCycleAccess(parsed.data.cycleId, auth);
    if (accessError) return accessError;

    const client = createSupabaseServiceRoleClient();
    const { data, error } = await client.rpc("materialize_fami_preliminary", {
      p_cycle_id: parsed.data.cycleId,
      p_reference_year: parsed.data.referenceYear,
      p_quadrimester: parsed.data.quadrimester,
      p_actor_user_id: auth.userId,
    });
    if (error) throw error;

    const history = await listPreliminaryCheckpoints(
      client,
      parsed.data.cycleId,
      parsed.data.referenceYear,
    );
    return NextResponse.json({ materialized: data, ...history }, { status: 201 });
  },
);
