#!/usr/bin/env node
/**
 * Confere a identidade da homologação sem abrir conexão.
 * Não imprime chaves nem senhas.
 */
import { prepareWritableEnvironment, publicTargetSummary } from "../shared/writable-target.mjs";

try {
  process.env.ORIENTA_TARGET = "homologacao";
  const identity = prepareWritableEnvironment();
  const summary = publicTargetSummary(process.env);
  console.log(
    JSON.stringify(
      {
        status: "identidade-compativel",
        target: identity.target,
        projectRef: identity.projectRef,
        supabaseHost: summary.supabaseHost,
        databaseHost: summary.databaseHost,
        conexao: "nao-aberta",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}
