import "server-only";

import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

function digest(value: string): Buffer {
  return createHash("sha256").update(value, "utf8").digest();
}

function safeSecretEqual(supplied: string, expected: string): boolean {
  return timingSafeEqual(digest(supplied), digest(expected));
}

export function authorizeCron(request: Request): NextResponse | null {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json({ error: "CRON_SECRET não configurado." }, { status: 503 });
  }

  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!supplied || !safeSecretEqual(supplied, expected)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  return null;
}
