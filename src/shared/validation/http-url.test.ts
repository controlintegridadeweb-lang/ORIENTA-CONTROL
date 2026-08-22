import { describe, expect, it } from "vitest";
import { isHttpUrl } from "./http-url";

describe("isHttpUrl", () => {
  it.each([
    "https://exemplo.org/documento",
    "http://localhost:3000/evidencia",
  ])("aceita URL web absoluta: %s", (value) => {
    expect(isHttpUrl(value)).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "ftp://exemplo.org/documento",
    "/arquivo/local",
    "texto",
  ])("rejeita esquema não web: %s", (value) => {
    expect(isHttpUrl(value)).toBe(false);
  });
});
