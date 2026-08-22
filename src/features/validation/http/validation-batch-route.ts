import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { createSupabaseServiceRoleClient } from "@/infrastructure/supabase/server";
import { validationFailureMessage } from "@/features/validation/public-errors";
import { markResponsesAdminNotApplicableBatch, resolveAuthorizedCycleScope } from "@/features/cycles/server";

const evidenceItemSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "approved", "invalidated", "adjustment_requested"]),
  validatedAt: z.string().datetime({ offset: true }).nullable(),
});

const naItemSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["pending", "approved", "rejected"]),
  validatedAt: z.string().datetime({ offset: true }).nullable(),
});

const schema = z
  .discriminatedUnion("kind", [
    z.object({
      kind: z.literal("evidence"),
      items: z.array(evidenceItemSchema).min(1).max(200),
      action: z.enum(["approve", "invalidate", "request_adjustment"]),
      justification: z.string().trim().max(2000).nullable().optional(),
    }),
    z.object({
      kind: z.literal("not_applicable"),
      items: z.array(naItemSchema).min(1).max(200),
      action: z.enum(["approve", "reject"]),
      rejectionReason: z.string().trim().max(2000).nullable().optional(),
    }),
    z.object({
      kind: z.literal("admin_not_applicable"),
      responseIds: z.array(z.string().uuid()).min(1).max(200),
      justification: z
        .string()
        .trim()
        .min(1, "Informe a justificativa da decisão.")
        .max(2000),
    }),
  ])
  .superRefine((value, context) => {
    if (value.kind === "admin_not_applicable") {
      if (new Set(value.responseIds).size !== value.responseIds.length) {
        context.addIssue({
          code: "custom",
          path: ["responseIds"],
          message: "A seleção contém itens duplicados.",
        });
      }
      return;
    }
    const ids = value.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["items"],
        message: "A seleção contém itens duplicados.",
      });
    }
    if (
      value.kind === "not_applicable" &&
      value.action === "reject" &&
      !value.rejectionReason?.trim()
    ) {
      context.addIssue({
        code: "custom",
        path: ["rejectionReason"],
        message: "Informe o motivo da rejeição.",
      });
    }
  });

const rpcResultSchema = z.object({
  results: z.array(
    z.discriminatedUnion("status", [
      z.object({
        id: z.string(),
        status: z.literal("succeeded"),
        result: z
          .object({ validatedAt: z.string().datetime({ offset: true }) })
          .passthrough(),
      }),
      z.object({
        id: z.string(),
        status: z.literal("failed"),
        code: z.string().optional(),
      }),
    ]),
  ),
});

export const POST = withRoute<{ cycleId: string }>(
  {
    roles: ["admin"],
    route: "/api/admin/cycles/[cycleId]/validation/batch",
  },
  async ({ params, request, auth }) => {
    const cycleId = requireUuid(params.cycleId, "cycleId");
    const body = schema.parse(await request.json());
    const client = createSupabaseServiceRoleClient();
    const authorized = await resolveAuthorizedCycleScope(client, auth, cycleId);
    if (authorized.error) return authorized.error;

    if (body.kind === "admin_not_applicable") {
      const result = await markResponsesAdminNotApplicableBatch(client, cycleId, {
        responseIds: body.responseIds,
        justification: body.justification,
        actorUserId: auth.userId,
      });
      return NextResponse.json({
        results: result.results.map((item) =>
          item.status === "failed"
            ? {
                id: item.id,
                status: item.status,
                code: item.code ?? "validation_failed",
                message: validationFailureMessage(item.code),
              }
            : {
                id: item.id,
                status: item.status,
                result: {
                  validatedAt:
                    item.result?.adminNaDecidedAt ?? new Date().toISOString(),
                  ...item.result,
                },
              },
        ),
      });
    }

    const rpc =
      body.kind === "evidence"
        ? "validate_evidences_batch"
        : "validate_not_applicable_batch";
    const args =
      body.kind === "evidence"
        ? {
            p_cycle_id: cycleId,
            p_items: body.items,
            p_action: body.action,
            p_actor_user_id: auth.userId,
            p_justification: body.justification ?? null,
          }
        : {
            p_cycle_id: cycleId,
            p_items: body.items,
            p_action: body.action,
            p_actor_user_id: auth.userId,
            p_rejection_reason: body.rejectionReason ?? null,
          };

    const { data, error } = await client.rpc(rpc, args as never);
    if (error) throw error;

    const parsed = rpcResultSchema.parse(data);
    return NextResponse.json({
      results: parsed.results.map((item) =>
        item.status === "failed"
          ? {
              id: item.id,
              status: item.status,
              code: item.code ?? "validation_failed",
              message: validationFailureMessage(item.code),
            }
          : item,
      ),
    });
  },
);
