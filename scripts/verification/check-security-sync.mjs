import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const failures = [];

function requireMatch(file, pattern, message) {
  const source = read(file);
  if (!pattern.test(source)) failures.push(`${file}: ${message}`);
}

function requireNoMatch(file, pattern, message) {
  const source = read(file);
  if (pattern.test(source)) failures.push(`${file}: ${message}`);
}

function requireAbsent(file, message) {
  if (fs.existsSync(path.join(root, file))) failures.push(`${file}: ${message}`);
}

function walkFiles(directory) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  const output = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walkFiles(relative));
    else output.push(relative);
  }
  return output;
}

function topLevelArgumentCount(source, openIndex) {
  let depth = 1;
  let commaCount = 0;
  let quote = null;
  for (let index = openIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (char === quote) {
        if (source[index + 1] === quote) index += 1;
        else quote = null;
      }
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      continue;
    }
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        const body = source.slice(openIndex + 1, index).trim();
        return body ? commaCount + 1 : 0;
      }
    } else if (char === "," && depth === 1) commaCount += 1;
  }
  return null;
}

function requireSqlCallArity(file, functionName, expected) {
  const source = read(file);
  const pattern = new RegExp(`public\\.${functionName}\\s*\\(`, "gi");
  for (const match of source.matchAll(pattern)) {
    const openIndex = match.index + match[0].lastIndexOf("(");
    const actual = topLevelArgumentCount(source, openIndex);
    if (actual !== expected) {
      failures.push(`${file}: ${functionName} usa ${actual ?? "assinatura incompleta"} argumento(s); esperado ${expected}`);
    }
  }
}

requireMatch(
  "supabase/config.toml",
  /minimum_password_length\s*=\s*12[\s\S]*password_requirements\s*=\s*"lower_upper_letters_digits_symbols"/,
  "política de senha forte ausente",
);
requireMatch(
  "supabase/config.toml",
  /auto_expose_new_tables\s*=\s*false/,
  "novas tabelas podem ser expostas automaticamente pela Data API",
);
requireMatch(
  "src/infrastructure/supabase/server.ts",
  /^import "server-only";/m,
  "cliente privilegiado não está marcado como server-only",
);
requireMatch(
  "src/features/reports/http/download-route.ts",
  /createSignedUrl[\s\S]*NextResponse\.redirect/,
  "download de relatório não usa URL assinada temporária",
);
requireNoMatch(
  "src/features/reports/http/download-route.ts",
  /\.download\s*\(/,
  "download de relatório voltou a fazer proxy de bytes pelo Next.js",
);
requireMatch(
  "src/infrastructure/observability/logger.ts",
  /SENSITIVE_KEY[\s\S]*REDACTED[\s\S]*NODE_ENV !== "production"/,
  "logger não aplica redaction ou ainda registra stack em produção",
);
requireNoMatch(
  ".env.example",
  /ALLOW_DEV_PROFILE_FALLBACK|NEXT_PUBLIC_DEFAULT_(?:ADMIN|RESPONDENT)_USER_ID/,
  "fallback legado de identidade permanece documentado",
);
requireNoMatch(
  "next.config.ts",
  /ignoreBuildErrors\s*:\s*true/,
  "build do Next.js ignora erros TypeScript",
);

for (const actionFile of [
  "src/features/auth/server-actions.ts",
  "src/app/admin/organizacoes/actions.ts",
  "src/app/admin/usuarios/actions.ts",
]) {
  requireMatch(actionFile, /safeParse\s*\(/, "Server Action não valida FormData com schema explícito");
  requireNoMatch(
    actionFile,
    /(?:String|Number|Boolean)\s*\(\s*formData\.get/,
    "Server Action voltou a fazer coerção manual de FormData",
  );
}
requireMatch(
  "supabase/config.toml",
  /\[auth\.sessions\][\s\S]*timebox\s*=\s*"12h"[\s\S]*inactivity_timeout\s*=\s*"2h"/,
  "limites de sessão ausentes",
);
requireMatch(
  "supabase/config.toml",
  /\[auth\.mfa\.totp\][\s\S]*enroll_enabled\s*=\s*true[\s\S]*verify_enabled\s*=\s*true/,
  "MFA TOTP não está habilitado",
);
requireMatch(
  "src/infrastructure/supabase/proxy.ts",
  /script-src 'self' 'nonce-\$\{nonce\}' 'strict-dynamic'/,
  "CSP não usa nonce e strict-dynamic",
);
requireMatch(
  "supabase/config.toml",
  /\[auth\.rate_limit\][\s\S]*sign_in_sign_ups\s*=\s*10[\s\S]*token_verifications\s*=\s*10/,
  "limites de autenticação estão permissivos",
);
requireMatch(
  "supabase/config.toml",
  /\[auth\.email\][\s\S]*max_frequency\s*=\s*"60s"/,
  "recuperação de senha permite envios em frequência excessiva",
);
requireMatch(
  "src/infrastructure/supabase/proxy.ts",
  /style-src 'self' 'nonce-\$\{nonce\}'[\s\S]*style-src-attr 'unsafe-inline'/,
  "CSP de estilos não separa elementos com nonce de atributos inline",
);
requireAbsent(
  "src/app/api/auth/mfa/reset/route.ts",
  "reset autônomo de MFA em AAL1 voltou a ser exposto",
);
requireNoMatch(
  "src/features/auth/components/mfa-form.tsx",
  /\/api\/auth\/mfa\/reset/,
  "tela de MFA voltou a oferecer reset autônomo",
);
for (const eventType of [
  "admin_mfa_recovery_started",
  "admin_mfa_recovery_failed",
  "admin_mfa_recovery_completed",
]) {
  requireMatch(
    "scripts/maintenance/recover-admin-mfa.mjs",
    new RegExp(eventType),
    `procedimento operacional de recuperação de MFA não registra ${eventType}`,
  );
}
requireMatch(
  "scripts/maintenance/recover-admin-mfa.mjs",
  /arg === "--execute"[\s\S]*if \(!execute\)/,
  "procedimento operacional de recuperação de MFA não usa simulação por padrão",
);
requireMatch(
  "src/infrastructure/security/csrf.ts",
  /sec-fetch-site[\s\S]*headers\.get\("origin"\)/,
  "proteção CSRF explícita ausente",
);
requireMatch(
  "src/infrastructure/api/auth.ts",
  /rejectCrossSiteMutation\(request\)/,
  "rotas autenticadas diretas não aplicam proteção CSRF",
);
requireNoMatch(
  "src/infrastructure/api/auth.ts",
  /SUPABASE_SERVICE_ROLE_KEY|createSupabaseServiceRoleClient/,
  "autorização ainda usa service_role para consultar o próprio perfil",
);
requireMatch(
  "src/app/api/auth/sign-in/route.ts",
  /auth:sign-in:account-network[\s\S]*auth:sign-in:network[\s\S]*Retry-After/,
  "login não possui rate limit persistente por conta e rede",
);
requireMatch(
  "src/features/auth/server-actions.ts",
  /auth:password-reset:account-network[\s\S]*auth:password-reset:network/,
  "recuperação de senha não possui rate limit persistente",
);
requireMatch(
  "src/application/automation/cron-authorization.ts",
  /timingSafeEqual[\s\S]*sha256/,
  "CRON_SECRET não usa comparação em tempo constante",
);
requireMatch(
  "supabase/migrations/20260812000600_triggers.sql",
  /audit_logs_append_only_update_delete[\s\S]*library_audit_events_append_only_truncate/,
  "trilhas de auditoria não são append-only",
);
requireMatch(
  "supabase/migrations/20260812000800_security_rls.sql",
  /revoke insert, update, delete, truncate on all tables in schema public from authenticated/,
  "authenticated ainda possui privilégios de mutação ou truncate por grant global",
);
requireMatch(
  "supabase/migrations/20260812000800_security_rls.sql",
  /revoke update, delete, truncate on table[\s\S]*public\.audit_logs[\s\S]*from service_role/,
  "service_role ainda pode reescrever a auditoria",
);
requireMatch(
  "src/infrastructure/api/auth.ts",
  /profile\.role === "admin" && !identity\.mfaVerified/,
  "API administrativa não exige AAL2",
);
requireMatch(
  "src/infrastructure/api/with-route.ts",
  /\["POST", "PUT", "PATCH", "DELETE"\][\s\S]*consumeRateLimit/,
  "mutações não possuem rate limit padrão",
);
requireMatch(
  "supabase/migrations/20260812000700_storage.sql",
  /values \('planos-acao', 'planos-acao', false, 20971520\)/,
  "bucket de comprovações do plano não está privado ou sem limite de 20 MB",
);
requireMatch(
  "src/infrastructure/health/readiness-service.ts",
  /\["evidencias", "planos-acao", "relatorios"\]/,
  "readiness não verifica todos os buckets privados da aplicação",
);
requireMatch(
  "src/app/api/action-plan-documents/\[documentId\]/file/route.ts",
  /ensureOrganizationAccess[\s\S]*file_validation_status !== "valid"[\s\S]*createSignedUrl/,
  "download de comprovação do plano não exige escopo da organização, validação estrutural e URL assinada",
);
requireMatch(
  "src/app/api/evidences/\[evidenceId\]/file/route.ts",
  /ensureOrganizationAccess[\s\S]*file_validation_status !== "valid"[\s\S]*createSignedUrl/,
  "download de evidência não exige escopo da organização, validação estrutural e URL assinada",
);
requireMatch(
  "src/infrastructure/health/readiness-service.ts",
  /executeCheck\("upload_storage", checkUploadStorage\)/,
  "readiness não verifica infraestrutura de upload",
);
requireMatch(
  "supabase/migrations/20260812000200_schema.sql",
  /alter table public\.action_plan_documents replica identity full;/,
  "comprovações do plano não possuem replica identity full",
);
requireMatch(
  "supabase/migrations/20260812000700_storage.sql",
  /alter publication supabase_realtime add table public\.action_plan_documents/,
  "comprovações do plano não estão publicadas no Realtime",
);
requireMatch(
  "supabase/migrations/20260812000200_schema.sql",
  /create table public\.action_plan_storage_cleanup_queue/,
  "comprovações removidas não possuem outbox durável de limpeza",
);
requireMatch(
  "supabase/migrations/20260812000900_comments.sql",
  /Outbox transacional de exclusão de objetos do bucket privado planos-acao/,
  "outbox de comprovantes não está documentada como transacional",
);
requireMatch(
  "supabase/migrations/20260812000200_schema.sql",
  /create table public\.pending_action_plan_document_uploads[\s\S]*size_bytes bigint not null check \(size_bytes > 0 and size_bytes <= 20971520\)[\s\S]*expires_at timestamptz/,
  "uploads diretos de comprovação não possuem estágio temporário limitado e auditável",
);
requireMatch(
  "supabase/migrations/20260812000800_security_rls.sql",
  /alter table public\.pending_action_plan_document_uploads enable row level security/,
  "uploads temporários de comprovação não possuem RLS",
);
requireMatch(
  "supabase/migrations/20260812000500_functions.sql",
  /create or replace function public\.initialize_action_plan_document_upload[\s\S]*for update of ap, c[\s\S]*insert into public\.pending_action_plan_document_uploads/,
  "inicialização do upload não revalida escopo e revisão sob lock transacional",
);
requireMatch(
  "supabase/migrations/20260812000500_functions.sql",
  /create or replace function public\.commit_action_plan_document_upload[\s\S]*delete from public\.pending_action_plan_document_uploads/,
  "confirmação de upload não consome o registro temporário transacionalmente",
);
requireMatch(
  "supabase/migrations/20260812000500_functions.sql",
  /p_verified_mime_type is null or btrim\(p_verified_mime_type\) not in/,
  "confirmação de upload aceita MIME verificado nulo",
);
requireMatch(
  "supabase/migrations/20260812000500_functions.sql",
  /create or replace function public\.discard_pending_action_plan_document_upload[\s\S]*insert into public\.action_plan_storage_cleanup_queue/,
  "descarte de upload temporário não registra limpeza na mesma transação",
);
requireMatch(
  "src/features/improvement-management/action-plans/client.ts",
  /uploadToSignedUrl[\s\S]*pendingUploadId[\s\S]*method: "PATCH"/,
  "cliente de comprovação não usa upload direto assinado seguido de confirmação",
);
requireNoMatch(
  "src/app/api/respondent/action-plans/[planId]/documents/route.ts",
  /formData\(|multipart\/form-data|instanceof File/,
  "rota de comprovação voltou a transportar bytes pelo runtime serverless",
);
requireMatch(
  "supabase/migrations/20260812000500_functions.sql",
  /create or replace function public\.deactivate_action_plan_document[\s\S]*insert into public\.action_plan_storage_cleanup_queue/,
  "desativação de comprovação não registra a limpeza na mesma transação",
);
requireMatch(
  "src/app/api/maintenance/pending-evidence-cleanup/route.ts",
  /cleanupExpiredPendingActionPlanDocumentUploads[\s\S]*cleanupQueuedActionPlanStorageObjects/,
  "cron de manutenção não processa uploads temporários e fila do bucket planos-acao",
);
requireMatch(
  "src/app/api/maintenance/pending-evidence-cleanup/route.ts",
  /const \[uploads, actionPlanUploads, operational\][\s\S]*cleanupExpiredPendingActionPlanDocumentUploads[\s\S]*const \[storageObjects, actionPlanStorageObjects\]/,
  "cron de manutenção voltou a processar expiração e outbox na mesma fase concorrente",
);
requireNoMatch(
  "supabase/migrations/20260812000800_security_rls.sql",
  /create policy recommendation_exceptions_.*(?:insert|update|delete|all)/i,
  "exceções institucionais permitem mutação direta pela Data API",
);
requireMatch(
  "src/app/api/workbench/evidence/upload/route.ts",
  /route: "\/api\/workbench\/evidence\/upload"[\s\S]*mutationRateLimit: false/,
  "upload de evidência não desativa o rate limit genérico",
);
requireMatch(
  "src/application/workbench-evidence-upload/initialize-evidence-upload.ts",
  /scope: "evidence-upload"[\s\S]*limit: 20[\s\S]*windowSeconds: 15 \* 60/,
  "upload de evidência não aplica o limite especializado",
);
requireMatch(
  "src/app/api/admin/automation/reports/route.ts",
  /route: "\/api\/admin\/automation\/reports"[\s\S]*mutationRateLimit: false[\s\S]*scope: "report-bundle"/,
  "pacote de relatórios aplica rate limit genérico além do limite especializado",
);
requireMatch(
  "src/app/api/admin/automation/import/route.ts",
  /route: "\/api\/admin\/automation\/import"[\s\S]*mutationRateLimit: false[\s\S]*scope: "admin-import"/,
  "importação administrativa aplica rate limit genérico além do limite especializado",
);
requireMatch(
  "scripts/imports/lib/respondent-seed.mjs",
  /fixedPassword\.length < 12[\s\S]*isWeakPassword\(fixedPassword\)/,
  "bootstrap de respondentes não aplica a política mínima de senha",
);
requireMatch(
  "scripts/imports/lib/respondent-seed.mjs",
  /export function resolvePasswordFactory\(\{ mode, fixedPassword \}\)/,
  "bootstrap ainda aceita bypass de senha fraca",
);
requireMatch(
  "scripts/imports/lib/diagnostic-response-storage.mjs",
  /select\(\s*"id,question_version_id,answer,notes,revision(?:,[^"]*)?"\s*,?\s*\)/,
  "importação histórica não carrega a revisão persistida das respostas",
);
requireMatch(
  "scripts/imports/diagnostic-responses.mjs",
  /p_expected_revision: existing\?\.revision/,
  "importação histórica não envia a revisão esperada para concorrência otimista",
);
requireMatch(
  "supabase/verify/data_api_privileges.sql",
  /apply_workbench_response\(uuid,uuid,uuid,public\.answer_value,text,bigint,jsonb\)[\s\S]*remove_workbench_evidence_item\(uuid,uuid,uuid,uuid,bigint\)/,
  "verificação de privilégios usa assinaturas antigas do workbench",
);
requireMatch(
  "supabase/verify/action_plans_cycle_editability.sql",
  /revisão antiga foi aceita[\s\S]*sqlstate '40001'/,
  "verificação SQL não cobre concorrência do plano de integridade e compliance",
);
requireMatch(
  "supabase/verify/action_plan_progress_monotonic.sql",
  /action_plan_progress_cannot_decrease[\s\S]*progress_percentage = 55/,
  "verificação SQL não cobre a regra de progresso monotônico da ação",
);
requireMatch(
  "supabase/verify/workbench_multiple_evidences.sql",
  /stale_response_revision_was_accepted[\s\S]*sqlstate '40001'/,
  "verificação SQL não cobre concorrência de respostas/evidências",
);

requireMatch(
  "src/features/workbench/components/use-workbench-realtime.ts",
  /hasLocalDrafts[\s\S]*O diagnóstico foi alterado em outra sessão[\s\S]*retryAction: "reload"/,
  "Realtime pode descartar rascunhos locais do workbench",
);
requireMatch(
  "src/features/improvement-management/recommendations/components/hub/recommendation-actions-workspace.tsx",
  /handleRemotePlanChange[\s\S]*activePanel\.kind !== "none"[\s\S]*plano foi alterado em outra aba[\s\S]*table: "action_plans"[\s\S]*onChange: handleRemotePlanChange[\s\S]*table: "action_plan_documents"[\s\S]*onChange: handleRemotePlanChange/,
  "Realtime pode sobrescrever edição aberta do plano de integridade e compliance ou de suas comprovações",
);

requireMatch(
  "supabase/migrations/20260812000500_functions.sql",
  /p_expected_revision bigint default null[\s\S]*response_revision_conflict/,
  "respostas não possuem controle otimista de concorrência",
);
requireMatch(
  "supabase/migrations/20260812000500_functions.sql",
  /p_expected_revision bigint default null[\s\S]*action_plan_revision_conflict/,
  "ações não possuem controle otimista de concorrência",
);
requireMatch(
  "supabase/migrations/20260812000200_schema.sql",
  /alter table public\.responses replica identity full;/,
  "respostas não possuem replica identity full",
);
requireMatch(
  "supabase/migrations/20260812000700_storage.sql",
  /alter publication supabase_realtime add table public\.responses/,
  "respostas não estão publicadas no Realtime",
);
requireMatch(
  "supabase/migrations/20260812000200_schema.sql",
  /alter table public\.action_plans replica identity full;/,
  "ações não possuem replica identity full",
);
requireMatch(
  "supabase/migrations/20260812000700_storage.sql",
  /alter publication supabase_realtime add table public\.action_plans/,
  "ações não estão publicadas no Realtime",
);


requireSqlCallArity("supabase/verify/not_applicable_validation.sql", "apply_workbench_response", 7);
requireSqlCallArity("supabase/verify/respondent_profile_details_import.sql", "apply_workbench_response", 7);
requireSqlCallArity("supabase/verify/workbench_multiple_evidences.sql", "apply_workbench_response", 7);
requireSqlCallArity("supabase/verify/workbench_multiple_evidences.sql", "remove_workbench_evidence_item", 5);
requireSqlCallArity("supabase/verify/action_plans_cycle_editability.sql", "save_respondent_action_plan", 13);

for (const file of walkFiles("src").filter((name) => /\.(?:ts|tsx)$/.test(name))) {
  const source = read(file);
  if (/^\s*["']use client["'];/m.test(source) &&
      /createSupabaseServiceRoleClient|SUPABASE_SERVICE_ROLE_KEY/.test(source)) {
    failures.push(`${file}: componente cliente referencia credencial privilegiada`);
  }
}

if (failures.length > 0) {
  console.error("Falhas de segurança/sincronização:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("✓ Segurança e sincronização: MFA, sessões, RLS/Data API, URLs assinadas, logs, concorrência e Realtime validados.");
