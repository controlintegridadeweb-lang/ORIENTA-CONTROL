import { afterEach, describe, expect, it, vi } from "vitest";
import { __loggerTesting, logError, logInfo } from "./logger";

describe("logger seguro", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("remove segredos, cookies, URLs assinadas, bearer e e-mails do contexto", () => {
    const sanitized = __loggerTesting.sanitizeValue({
      authorization: "Bearer secret-token",
      cookie: "session=abc",
      signedUrl: "https://storage.test/object?token=secret",
      fileName: "documento-pessoa.pdf",
      storage_path: "org/ciclo/documento-pessoa.pdf",
      qr_code: "data:image/svg+xml;utf-8,<svg/>",
      otpauth: "otpauth://totp/ORIENTA",
      nested: {
        email: "pessoa@example.com",
        message: "Contato pessoa@example.com com Bearer abc.def.ghi",
        url: "https://storage.test/object?token=segredo&x=1",
      },
    }) as Record<string, unknown>;

    expect(sanitized.authorization).toBe("[REDACTED]");
    expect(sanitized.cookie).toBe("[REDACTED]");
    expect(sanitized.signedUrl).toBe("[REDACTED]");
    expect(sanitized.fileName).toBe("[REDACTED]");
    expect(sanitized.storage_path).toBe("[REDACTED]");
    expect(sanitized.qr_code).toBe("[REDACTED]");
    expect(sanitized.otpauth).toBe("[REDACTED]");
    expect(sanitized.nested).toEqual({
      email: "[REDACTED_EMAIL]",
      message: "Contato [REDACTED_EMAIL] com Bearer [REDACTED]",
      url: "https://storage.test/object?token=[REDACTED]&x=1",
    });
  });

  it("não registra stack em produção", () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logError("Falha", new Error("erro de pessoa@example.com"), {
      accessToken: "segredo",
      stack: "stack arbitrária",
    });

    const payload = spy.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload.message).toBe("erro de [REDACTED_EMAIL]");
    expect(payload.accessToken).toBe("[REDACTED]");
    expect(payload.stack).toBeUndefined();
  });

  it("trata referências circulares sem quebrar o log", () => {
    const context: Record<string, unknown> = {};
    context.self = context;
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);

    expect(() => logInfo("Teste", context)).not.toThrow();
    expect(spy.mock.calls[0]?.[1]).toMatchObject({ self: "[CIRCULAR]" });
  });
});
