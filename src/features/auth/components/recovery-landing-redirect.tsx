"use client";

import { useLayoutEffect } from "react";
import { readRecoveryCallback } from "@/features/auth/recovery-callback";

/**
 * O Auth manda o usuário para a Site URL quando o redirect da recuperação não
 * está na lista permitida. A Site URL é o login; o fragmento com a sessão não
 * chega ao servidor. Esta ponte leva o retorno para a página que define a senha.
 */
export function RecoveryLandingRedirect() {
  useLayoutEffect(() => {
    const callback = readRecoveryCallback(window.location.href);
    if (callback.kind === "none") return;
    const target = `/auth/update-password${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }, []);

  return null;
}
