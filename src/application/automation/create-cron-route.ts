import { NextResponse } from "next/server";
import { authorizeCron } from "@/application/automation/cron-authorization";
import { logError } from "@/infrastructure/observability/logger";

type CronRouteOptions<ResultKey extends string, Result> = {
  route: string;
  execute: () => Promise<Result>;
  resultKey: ResultKey;
  logMessage: string;
  publicError: string;
};

/**
 * Cria o controlador padrão das rotas cron sem ocultar a operação executada.
 * Rotas com resposta ou transação próprias devem manter controlador explícito.
 */
export function createCronRoute<ResultKey extends string, Result>({
  route,
  execute,
  resultKey,
  logMessage,
  publicError,
}: CronRouteOptions<ResultKey, Result>) {
  return async function cronRoute(request: Request) {
    const requestId = request.headers.get("x-request-id")?.trim() || crypto.randomUUID();
    const startedAt = performance.now();
    const unauthorized = authorizeCron(request);
    if (unauthorized) {
      unauthorized.headers.set("x-request-id", requestId);
      unauthorized.headers.set("Cache-Control", "no-store, max-age=0");
      return unauthorized;
    }

    try {
      const result = await execute();
      return NextResponse.json(
        {
          ok: true,
          processedAt: new Date().toISOString(),
          durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
          [resultKey]: result,
        },
        { headers: { "x-request-id": requestId, "Cache-Control": "no-store, max-age=0" } },
      );
    } catch (error) {
      logError(logMessage, error, {
        route,
        requestId,
        durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
      });
      return NextResponse.json(
        { error: publicError },
        { status: 500, headers: { "x-request-id": requestId, "Cache-Control": "no-store, max-age=0" } },
      );
    }
  };
}
