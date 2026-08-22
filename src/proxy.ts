import type { NextRequest } from "next/server";
import { updateSession } from "@/infrastructure/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  /**
   * Aplica a todas as rotas EXCETO assets estáticos e a pasta de API.
   * As rotas de API têm sua própria guarda (`requireAuth`) e não devem ser
   * redirecionadas (devem responder 401/403 em JSON, não 3xx para HTML).
   */
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
