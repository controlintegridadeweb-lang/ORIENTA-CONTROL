import { describe, expect, it } from "vitest";
import { readRecoveryCallback, RECOVERY_LINK_INVALID } from "./recovery-callback";

describe("readRecoveryCallback", () => {
  it("lê o token_hash do link gerado no admin", () => {
    expect(
      readRecoveryCallback("https://orienta.example/auth/update-password?token_hash=abc&type=recovery"),
    ).toEqual({ kind: "otp", tokenHash: "abc" });
  });

  it("lê a sessão no fragmento, que funciona em outro aparelho", () => {
    expect(
      readRecoveryCallback(
        "https://orienta.example/auth/update-password#access_token=access&refresh_token=refresh&type=recovery",
      ),
    ).toEqual({ kind: "session", accessToken: "access", refreshToken: "refresh" });
  });

  it("lê o code do fluxo PKCE", () => {
    expect(readRecoveryCallback("https://orienta.example/auth/update-password?code=pkce-code")).toEqual({
      kind: "code",
      code: "pkce-code",
    });
  });

  it("recusa o retorno quando o Auth devolve erro", () => {
    expect(
      readRecoveryCallback(
        "https://orienta.example/#error=access_denied&error_description=redirect+not+allowed",
      ),
    ).toEqual({ kind: "error", message: RECOVERY_LINK_INVALID });
  });

  it("ignora uma sessão que não é de recuperação", () => {
    expect(
      readRecoveryCallback(
        "https://orienta.example/#access_token=access&refresh_token=refresh&type=signup",
      ),
    ).toEqual({ kind: "error", message: RECOVERY_LINK_INVALID });
  });

  it("não vê callback na página aberta direto", () => {
    expect(readRecoveryCallback("https://orienta.example/auth/update-password")).toEqual({ kind: "none" });
  });
});
