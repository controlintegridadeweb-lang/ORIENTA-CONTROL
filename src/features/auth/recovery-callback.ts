export const RECOVERY_LINK_INVALID =
  "Link de recuperação inválido ou expirado. Solicite um novo link.";

export const RECOVERY_LINK_MISSING =
  "Abra o link de recuperação recebido por e-mail. Se ele não chegou, solicite outro e confira a caixa de spam.";

export type RecoveryCallback =
  | { kind: "otp"; tokenHash: string }
  | { kind: "code"; code: string }
  | { kind: "session"; accessToken: string; refreshToken: string }
  | { kind: "error"; message: string }
  | { kind: "none" };

function callbackParams(url: URL): URLSearchParams {
  const params = new URLSearchParams(url.searchParams);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
  hash.forEach((value, key) => {
    params.set(key, value);
  });
  return params;
}

/**
 * Lê o retorno do e-mail de recuperação.
 *
 * O Auth pode entregar `token_hash` (link gerado no admin), `code` (PKCE, só
 * no navegador que pediu o e-mail) ou `access_token` no fragmento (link que
 * funciona em outro aparelho).
 */
export function readRecoveryCallback(href: string): RecoveryCallback {
  const params = callbackParams(new URL(href));
  if (params.get("error") || params.get("error_description")) {
    return { kind: "error", message: RECOVERY_LINK_INVALID };
  }

  const tokenHash = params.get("token_hash");
  if (tokenHash && params.get("type") === "recovery") {
    return { kind: "otp", tokenHash };
  }

  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (accessToken && refreshToken) {
    const type = params.get("type");
    if (type && type !== "recovery") {
      return { kind: "error", message: RECOVERY_LINK_INVALID };
    }
    return { kind: "session", accessToken, refreshToken };
  }

  const code = params.get("code");
  if (code) return { kind: "code", code };
  return { kind: "none" };
}
