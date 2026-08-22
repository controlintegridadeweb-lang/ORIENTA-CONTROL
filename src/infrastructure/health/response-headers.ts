import "server-only";
function resolveRequestId(request: Request): string {
  const incoming = request.headers.get("x-request-id")?.trim();
  return incoming && /^[A-Za-z0-9._:-]{8,128}$/.test(incoming) ? incoming : crypto.randomUUID();
}
export function healthResponseHeaders(request: Request, release: string): HeadersInit {
  return { "Cache-Control": "no-store, max-age=0", "x-request-id": resolveRequestId(request), "x-orienta-release": release };
}
