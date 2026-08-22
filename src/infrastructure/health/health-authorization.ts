import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
const digest = (value: string) => createHash("sha256").update(value, "utf8").digest();
export function isReadinessRequestAuthorized(request: Request): boolean {
  const expected = process.env.HEALTHCHECK_SECRET?.trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  return Boolean(supplied && timingSafeEqual(digest(supplied), digest(expected)));
}
