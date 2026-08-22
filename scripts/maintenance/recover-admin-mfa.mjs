import { randomUUID } from "node:crypto";

function parseArgs(argv) {
  const values = new Map();
  let execute = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--execute") {
      execute = true;
      continue;
    }
    if (!arg.startsWith("--")) throw new Error(`Argumento inválido: ${arg}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Valor ausente para ${arg}`);
    values.set(arg.slice(2), value.trim());
    index += 1;
  }
  return { values, execute };
}

function required(values, key, minimumLength = 1) {
  const value = values.get(key);
  if (!value || value.length < minimumLength) {
    throw new Error(`Informe --${key} com pelo menos ${minimumLength} caracteres.`);
  }
  return value;
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function audit(client, event) {
  const { error } = await client.from("audit_logs").insert({
    actor_user_id: null,
    event_type: event.eventType,
    entity_type: "auth_user",
    record_id: event.targetUserId,
    before_json: null,
    after_json: {
      operationId: event.operationId,
      reason: event.reason,
      confirmationReference: event.confirmationReference,
      operator: event.operator,
      factorCount: event.factorCount,
      removedFactorCount: event.removedFactorCount,
      status: event.status,
      failure: event.failure ?? null,
    },
  });
  if (error) throw new Error(`Falha ao registrar auditoria: ${error.message}`);
}

async function registerFailure(client, context, error) {
  try {
    await audit(client, {
      ...context,
      eventType: "admin_mfa_recovery_failed",
      status: "failed",
      failure: error instanceof Error ? error.message : "Falha não identificada.",
    });
  } catch (auditError) {
    const auditMessage = auditError instanceof Error ? auditError.message : String(auditError);
    const originalMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`${originalMessage} Também não foi possível registrar a falha: ${auditMessage}`);
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help")) {
    console.log(`Uso:
  npm run security:mfa-recover -- --user-id <uuid> --reason <texto> --confirmation-reference <referência> --operator <nome> [--execute]

Sem --execute, o comando apenas valida o administrador e informa a quantidade de fatores TOTP.`);
    return;
  }

  const { values, execute } = parseArgs(argv);
  const { createServiceRoleSupabaseClient } = await import(
    "../shared/create-service-role-supabase-client.mjs"
  );
  const targetUserId = required(values, "user-id");
  const reason = required(values, "reason", 20);
  const confirmationReference = required(values, "confirmation-reference", 8);
  const operator = required(values, "operator", 3);

  if (!isUuid(targetUserId)) throw new Error("--user-id deve ser um UUID válido.");

  const client = createServiceRoleSupabaseClient();
  const { data: profile, error: profileError } = await client
    .from("profiles")
    .select("role")
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (profileError) throw new Error(`Falha ao validar o perfil: ${profileError.message}`);
  if (profile?.role !== "admin") {
    throw new Error("A recuperação por este procedimento é restrita a administradores.");
  }

  const { data, error: listError } = await client.auth.admin.mfa.listFactors({
    userId: targetUserId,
  });
  if (listError) throw new Error(`Falha ao listar fatores MFA: ${listError.message}`);

  const factors = (data?.factors ?? []).filter((factor) => factor.factor_type === "totp");
  console.log(`Administrador validado. Fatores TOTP encontrados: ${factors.length}.`);

  if (!execute) {
    console.log("Simulação concluída. Nenhum fator foi removido.");
    console.log("Repita com --execute somente após confirmar a identidade por canal independente.");
    return;
  }

  if (factors.length === 0) {
    console.log("Nenhum fator TOTP ativo. Nada foi alterado.");
    return;
  }

  const context = {
    operationId: randomUUID(),
    targetUserId,
    reason,
    confirmationReference,
    operator,
    factorCount: factors.length,
    removedFactorCount: 0,
  };

  await audit(client, {
    ...context,
    eventType: "admin_mfa_recovery_started",
    status: "started",
  });

  try {
    for (const factor of factors) {
      const { error } = await client.auth.admin.mfa.deleteFactor({
        id: factor.id,
        userId: targetUserId,
      });
      if (error) throw new Error(`Falha ao remover fator MFA: ${error.message}`);
      context.removedFactorCount += 1;
    }
  } catch (error) {
    await registerFailure(client, context, error);
    throw error;
  }

  await audit(client, {
    ...context,
    eventType: "admin_mfa_recovery_completed",
    status: "completed",
  });

  console.log("Fatores TOTP removidos. O administrador deverá cadastrar um novo fator no próximo login.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
