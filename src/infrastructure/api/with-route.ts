import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, type AppRole, type AuthContext } from "@/infrastructure/api/auth";
import { handleDomainError } from "@/infrastructure/api/domain-errors";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { logError } from "@/infrastructure/observability/logger";
import { consumeRateLimit } from "@/infrastructure/security/rate-limit";
import { rejectCrossSiteMutation } from "@/infrastructure/security/csrf";

/**
 * Contexto entregue ao handler de rota: a request original, o AuthContext ja
 * autenticado (nunca null) e os params dinamicos da rota ja resolvidos
 * (Promise<params> aguardada).
 */
type RouteCtx<P> = {
  request: Request;
  auth: AuthContext;
  params: P;
};

/** Handler de rota: recebe o RouteCtx e devolve uma Response (ou NextResponse). */
export type RouteHandler<P> = (ctx: RouteCtx<P>) => Promise<Response>;

/** Assinatura nativa de um segundo argumento de rota do App Router. */
type NextRouteContext<P> = { params: Promise<P> };

export type WithRouteOptions = {
  /** Papeis autorizados (passados a requireAuth). */
  roles: AppRole[];
  /**
   * Rotulo da rota usado no log de erro (ex.: "/api/admin/forms"). Mantem o
   * mesmo formato do antigo `logError(msg, error, { route })`.
   */
  route: string;
  /** Mensagem de log usada quando o handler lanca (default generico). */
  logMessage?: string;
  /** Mensagem pública usada apenas no fallback HTTP 500. */
  internalErrorMessage?: string;
  /**
   * Handlers extras de erro (mesmo contrato de handleDomainError) para erros
   * que NAO sao subclasses de DomainError — ex.: FormPublishPendingError.
   */
  extraErrorHandlers?: Array<(e: unknown) => NextResponse | null>;
  /** Limite persistente para mutações. false desativa o padrão da rota. */
  mutationRateLimit?: { limit: number; windowSeconds: number } | false;
};

/**
 * Envolve um handler de rota centralizando o que e identico em todas as ~79
 * rotas: autenticacao + early-return, resolucao dos params dinamicos e o
 * try/catch com log e mapeamento de erro de dominio.
 *
 * A logica especifica de cada rota (org scope, tenant-guard, body, chamada de
 * service) permanece visivel dentro do handler — o wrapper nao a esconde.
 *
 * Uso:
 *   export const GET = withRoute(
 *     { roles: ["admin"], route: "/api/admin/forms" },
 *     async ({ auth, request }) => { ... return NextResponse.json(...) },
 *   );
 *
 * Para rotas dinamicas, informe o tipo de params no generico:
 *   withRoute<{ formId: string }>({ ... }, async ({ params }) => { ... })
 */
// Rotas sem segmento dinamico recebem apenas `Request`; rotas com params
// recebem o contexto obrigatorio que o App Router do Next 16 espera.
// Os overloads preservam a assinatura nativa exportada por cada route.ts.
export function withRoute(
  options: WithRouteOptions,
  handler: RouteHandler<Record<string, never>>,
): (request: Request) => Promise<Response>;
export function withRoute<P>(
  options: WithRouteOptions,
  handler: RouteHandler<P>,
): (request: Request, ctx: NextRouteContext<P>) => Promise<Response>;
export function withRoute<P = Record<string, never>>(
  options: WithRouteOptions,
  handler: RouteHandler<P>,
): (request: Request, ctx?: NextRouteContext<P>) => Promise<Response> {
  return async (request: Request, ctx?: NextRouteContext<P>) => {
    const csrfError = rejectCrossSiteMutation(request);
    if (csrfError) return csrfError;

    const authResult = await requireAuth(request, options.roles);
    if (authResult.error) return authResult.error;
    const context = authResult.context;

    try {
      const method = request.method.toUpperCase();
      const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
      if (isMutation && options.mutationRateLimit !== false) {
        const configured = options.mutationRateLimit ?? {
          limit: context.role === "admin" ? 90 : 150,
          windowSeconds: 300,
        };
        const rate = await consumeRateLimit({
          scope: `api:${method}:${options.route}`,
          subject: context.userId,
          limit: configured.limit,
          windowSeconds: configured.windowSeconds,
        });
        if (!rate.allowed) {
          return NextResponse.json(
            { error: "Muitas operações em pouco tempo. Aguarde e tente novamente." },
            {
              status: 429,
              headers: { "Retry-After": String(rate.retryAfterSeconds) },
            },
          );
        }
      }

      const params = (ctx?.params ? await ctx.params : {}) as P;
      return await handler({ request, auth: context, params });
    } catch (error) {
      logError(options.logMessage ?? `Route error: ${options.route}`, error, {
        route: options.route,
      });
      return handleDomainError(
        error,
        options.extraErrorHandlers,
        options.internalErrorMessage,
      );
    }
  };
}

const uuidSchema = z.string().uuid();

/**
 * Valida um valor como UUID, lancando DomainValidationError (HTTP 400) com o
 * path informado quando invalido. Substitui o bloco repetido:
 *   const parsed = uuid.safeParse(x);
 *   if (!parsed.success) return NextResponse.json({ error: ... }, { status: 400 });
 */
export function requireUuid(value: unknown, path = "id"): string {
  const parsed = uuidSchema.safeParse(value);
  if (!parsed.success) {
    throw new DomainValidationError(
      [{ path, message: `${path} inválido.` }],
      `${path} inválido.`,
    );
  }
  return parsed.data;
}
