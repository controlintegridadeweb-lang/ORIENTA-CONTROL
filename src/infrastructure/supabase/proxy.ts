import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Proxy (middleware) de sessão e proteção de rotas.
 *
 * Camada de AUTENTICAÇÃO (rede de segurança), não de autorização por papel:
 *
 *   • Mantém a sessão Supabase fresca a cada navegação (refresh de cookies via
 *     @supabase/ssr) — sem isto a sessão "expira" cedo no SSR.
 *   • Bloqueia o acesso a áreas privadas (`/admin`, `/respondente`) sem sessão,
 *     redirecionando para o login com `redirect` preservado.
 *
 * A AUTORIZAÇÃO por papel e por organização continua nas camadas internas, que
 * leem `profiles` no servidor: `requireRole` (páginas) e `requireAuth` +
 * guardas de tenant (APIs). Não duplicamos a regra de papel aqui para não criar
 * duas fontes de verdade.
 */

const PRIVATE_PREFIXES = ["/admin", "/respondente"];
const LOGIN_PATH = "/";

function supabaseConnectSources(): string[] {
  const sources = ["'self'", "https://*.supabase.co", "wss://*.supabase.co"];
  const raw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!raw) return sources;
  try {
    const parsed = new URL(raw);
    sources.push(parsed.origin);
    sources.push(`${parsed.protocol === "https:" ? "wss" : "ws"}://${parsed.host}`);
  } catch {
    // Configuração inválida será tratada pela guarda de autenticação.
  }
  return [...new Set(sources)];
}

function buildContentSecurityPolicy(nonce: string): string {
  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'${process.env.NODE_ENV === "development" ? " 'unsafe-inline'" : ""}`,
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob: https://*.supabase.co",
    "font-src 'self' data:",
    `connect-src ${supabaseConnectSources().join(" ")}`,
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];
  return directives.join("; ");
}

function withSecurityHeaders(
  response: NextResponse,
  nonce: string,
  requestId: string,
): NextResponse {
  response.headers.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  response.headers.set("x-nonce", nonce);
  response.headers.set("x-request-id", requestId);
  return response;
}

function isPrivatePath(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export async function updateSession(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const incomingRequestId = request.headers.get("x-request-id")?.trim();
  const requestId =
    incomingRequestId && /^[A-Za-z0-9._:-]{8,128}$/.test(incomingRequestId)
      ? incomingRequestId
      : crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("Content-Security-Policy", buildContentSecurityPolicy(nonce));
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  // Sem config de auth não há como validar sessão. Falhar fechado nas áreas
  // privadas é mais seguro do que deixar passar.
  if (!url || !anonKey) {
    if (isPrivatePath(request.nextUrl.pathname)) {
      const redirectUrl = new URL(LOGIN_PATH, request.url);
      redirectUrl.searchParams.set(
        "redirect",
        `${request.nextUrl.pathname}${request.nextUrl.search}`,
      );
      return withSecurityHeaders(NextResponse.redirect(redirectUrl), nonce, requestId);
    }
    return withSecurityHeaders(response, nonce, requestId);
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request: { headers: requestHeaders } });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  // getUser() revalida o token contra o Auth; não usar getSession() no proxy.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  if (!user && isPrivatePath(pathname)) {
    const redirectUrl = new URL(LOGIN_PATH, request.url);
    redirectUrl.searchParams.set("redirect", `${pathname}${request.nextUrl.search}`);
    return withSecurityHeaders(NextResponse.redirect(redirectUrl), nonce, requestId);
  }

  // Não redirecionar usuário autenticado fora do login aqui: a página `/` já
  // escolhe `/admin` ou `/respondente` conforme o papel em profiles.
  return withSecurityHeaders(response, nonce, requestId);
}
