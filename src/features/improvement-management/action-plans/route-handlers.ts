import { NextResponse } from "next/server";
import { requireUuid, withRoute } from "@/infrastructure/api/with-route";
import { ActionPlansNotFoundError } from "@/features/improvement-management/action-plans/access";
import { ActionPlansQueryService } from "@/features/improvement-management/action-plans/query-service";

type RouteProfile = "admin" | "respondent";

export function createGetActionPlanByRecommendationRoute(profile: RouteProfile) {
  const route = `/api/${profile}/action-plans/recommendations/:recommendationId`;
  return withRoute<{ recommendationId: string }>(
    {
      roles: [profile],
      route,
      logMessage: `Failed to load ${profile} recommendation action plan`,
    },
    async ({ params, auth }) => {
      const organizationId = auth.organizationId;
      if (auth.role === "respondent" && !organizationId) {
        return NextResponse.json(
          { error: "Usuário sem organização vinculada." },
          { status: 403 },
        );
      }

      const recommendationId = requireUuid(params.recommendationId, "recommendationId");
      const item = await new ActionPlansQueryService().getByRecommendation(recommendationId, {
        role: auth.role,
        organizationId,
      });
      if (!item) throw new ActionPlansNotFoundError("Recomendação não encontrada.");
      return NextResponse.json({ item });
    },
  );
}

export function createListActionPlanAuditRoute(profile: RouteProfile) {
  const route = `/api/${profile}/action-plans/[planId]/audit`;
  return withRoute<{ planId: string }>(
    {
      roles: [profile],
      route,
      logMessage: `Failed to list ${profile} action plan audit`,
    },
    async ({ auth, params, request }) => {
      if (auth.role === "respondent" && !auth.organizationId) {
        return NextResponse.json(
          { error: "Usuário sem organização vinculada." },
          { status: 403 },
        );
      }
      const url = new URL(request.url);
      const page = await new ActionPlansQueryService().listPlanAudit(
        params.planId,
        { role: auth.role, organizationId: auth.organizationId },
        {
          limit: url.searchParams.get("limit") ?? undefined,
          offset: url.searchParams.get("offset") ?? undefined,
        },
      );
      return NextResponse.json(page);
    },
  );
}

export function createListRecommendationActionPlanAuditRoute(profile: RouteProfile) {
  const route = `/api/${profile}/action-plans/recommendations/[recommendationId]/audit`;
  return withRoute<{ recommendationId: string }>(
    {
      roles: [profile],
      route,
      logMessage: `Failed to list ${profile} recommendation action plan audit`,
    },
    async ({ auth, params, request }) => {
      if (auth.role === "respondent" && !auth.organizationId) {
        return NextResponse.json(
          { error: "Usuário sem organização vinculada." },
          { status: 403 },
        );
      }
      const recommendationId = requireUuid(params.recommendationId, "recommendationId");
      const url = new URL(request.url);
      const page = await new ActionPlansQueryService().listRecommendationAudit(
        recommendationId,
        { role: auth.role, organizationId: auth.organizationId },
        {
          limit: url.searchParams.get("limit") ?? undefined,
          offset: url.searchParams.get("offset") ?? undefined,
        },
      );
      return NextResponse.json(page);
    },
  );
}

export function createListActionPlanProgressUpdatesRoute(profile: RouteProfile) {
  const route = `/api/${profile}/action-plans/[planId]/progress-updates`;
  return withRoute<{ planId: string }>(
    {
      roles: [profile],
      route,
      logMessage: `Failed to list ${profile} action plan progress updates`,
    },
    async ({ auth, params }) => {
      if (auth.role === "respondent" && !auth.organizationId) {
        return NextResponse.json(
          { error: "Usuário sem organização vinculada." },
          { status: 403 },
        );
      }
      const planId = requireUuid(params.planId, "planId");
      const items = await new ActionPlansQueryService().listPlanProgressUpdates(planId, {
        role: auth.role,
        organizationId: auth.organizationId,
      });
      return NextResponse.json({ items });
    },
  );
}
