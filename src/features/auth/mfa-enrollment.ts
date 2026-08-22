import { logError } from "@/infrastructure/observability/logger";

/** Nome estável do fator TOTP administrativo. */
export const ADMIN_TOTP_FRIENDLY_NAME = "ORIENTA Administrador";

export type MfaStage =
  | "session"
  | "aal"
  | "list_factors"
  | "unenroll_unverified"
  | "enroll"
  | "verify"
  | "assurance_refresh";

export type MfaUserErrorCode =
  | "session_expired"
  | "mfa_unavailable"
  | "pending_factor"
  | "invalid_code"
  | "already_configured"
  | "temporary_failure"
  | "unexpected";

export type MfaSetup =
  | { mode: "enroll"; factorId: string; qrCode: string; secret: string }
  | { mode: "challenge"; factorId: string };

export type MfaAuthErrorDetails = {
  name: string | null;
  message: string;
  status: number | null;
  code: string | null;
};

type FactorLike = {
  id: string;
  factor_type: string;
  status: string;
  friendly_name?: string | null;
};

type AuthResult<T> = { data: T | null; error: unknown };

/** Superfície mínima do SDK usada pelo fluxo MFA (compatível com mocks). */
export type MfaAuthClient = {
  auth: {
    getSession: () => Promise<AuthResult<{ session: { access_token?: string } | null }>>;
    mfa: {
      getAuthenticatorAssuranceLevel: () => Promise<
        AuthResult<{ currentLevel: string | null; nextLevel: string | null }>
      >;
      listFactors: () => Promise<
        AuthResult<{ all: FactorLike[]; totp: FactorLike[] }>
      >;
      unenroll: (params: { factorId: string }) => Promise<AuthResult<unknown>>;
      enroll: (params: {
        factorType: "totp";
        friendlyName: string;
      }) => Promise<
        AuthResult<{
          id: string;
          totp?: { qr_code?: string | null; secret?: string | null; uri?: string | null } | null;
        } | null>
      >;
      challengeAndVerify: (params: {
        factorId: string;
        code: string;
      }) => Promise<AuthResult<unknown>>;
    };
  };
};

export class MfaFlowError extends Error {
  readonly code: MfaUserErrorCode;
  readonly stage: MfaStage;
  readonly requestId: string;
  readonly auth: MfaAuthErrorDetails | null;

  constructor(input: {
    code: MfaUserErrorCode;
    stage: MfaStage;
    message: string;
    cause?: unknown;
    auth?: MfaAuthErrorDetails | null;
    requestId?: string;
  }) {
    super(input.message);
    this.name = "MfaFlowError";
    this.code = input.code;
    this.stage = input.stage;
    this.auth = input.auth ?? null;
    this.requestId = input.requestId ?? createRequestId();
    if (input.cause !== undefined) {
      this.cause = input.cause;
    }
  }
}

let prepareInflight: Promise<MfaSetup> | null = null;
let verifyInflight: Promise<void> | null = null;

export function __resetMfaEnrollmentStateForTests() {
  prepareInflight = null;
  verifyInflight = null;
}

function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `mfa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function readAuthErrorDetails(error: unknown): MfaAuthErrorDetails {
  if (!error || typeof error !== "object") {
    return {
      name: null,
      message: error == null ? "unknown_error" : String(error),
      status: null,
      code: null,
    };
  }
  const record = error as Record<string, unknown>;
  return {
    name: typeof record.name === "string" ? record.name : null,
    message: typeof record.message === "string" ? record.message : "unknown_error",
    status:
      typeof record.status === "number"
        ? record.status
        : typeof record.statusCode === "number"
          ? record.statusCode
          : null,
    code: typeof record.code === "string" ? record.code : null,
  };
}

export function classifyMfaAuthError(
  error: unknown,
  stage: MfaStage,
): MfaUserErrorCode {
  const details = readAuthErrorDetails(error);
  const code = (details.code ?? "").toLowerCase();
  const name = (details.name ?? "").toLowerCase();
  const message = details.message.toLowerCase();

  if (
    name.includes("authsessionmissingerror") ||
    code === "session_not_found" ||
    code === "refresh_token_not_found" ||
    code === "bad_jwt" ||
    (message.includes("session") && message.includes("missing")) ||
    message.includes("not authenticated") ||
    details.status === 401
  ) {
    return "session_expired";
  }

  if (
    code === "mfa_totp_enroll_disabled" ||
    code === "mfa_phone_enroll_disabled" ||
    code === "mfa_disabled" ||
    code === "insufficient_aal" ||
    message.includes("enroll is disabled") ||
    message.includes("mfa is disabled")
  ) {
    return "mfa_unavailable";
  }

  if (code === "mfa_factor_name_conflict" || message.includes("friendly name")) {
    return "pending_factor";
  }

  if (
    stage === "verify" &&
    (code === "mfa_verification_failed" ||
      code === "mfa_challenge_expired" ||
      code === "mfa_verified_factor_exists" ||
      message.includes("invalid") ||
      message.includes("expired"))
  ) {
    return "invalid_code";
  }

  if (
    code === "unexpected_failure" ||
    code === "over_request_rate_limit" ||
    (details.status !== null && details.status >= 500)
  ) {
    return "temporary_failure";
  }

  return "unexpected";
}

export function userMessageForMfaError(
  code: MfaUserErrorCode,
  requestId?: string,
): string {
  switch (code) {
    case "session_expired":
      return "Sua sessão expirou. Entre novamente com e-mail e senha para continuar.";
    case "mfa_unavailable":
      return "A autenticação em duas etapas está indisponível neste ambiente. Contate o responsável técnico.";
    case "pending_factor":
      return "Há um cadastro de autenticador pendente. Aguarde e tente novamente.";
    case "invalid_code":
      return "Código inválido ou expirado. Gere um novo código e tente novamente.";
    case "already_configured":
      return "A autenticação em duas etapas já está concluída nesta sessão.";
    case "temporary_failure":
      return "Falha temporária do serviço de autenticação. Tente novamente em instantes.";
    case "unexpected":
    default:
      return requestId
        ? `Não foi possível concluir a autenticação em duas etapas. Informe o código de rastreamento ${requestId} ao responsável técnico.`
        : "Não foi possível concluir a autenticação em duas etapas. Tente novamente ou contate o responsável técnico.";
  }
}

function toFlowError(error: unknown, stage: MfaStage): MfaFlowError {
  if (error instanceof MfaFlowError) return error;
  const auth = readAuthErrorDetails(error);
  const code = classifyMfaAuthError(error, stage);
  return new MfaFlowError({
    code,
    stage,
    message: userMessageForMfaError(code),
    cause: error,
    auth,
  });
}

function logMfaFailure(stage: MfaStage, error: unknown, requestId: string) {
  const auth = readAuthErrorDetails(error);
  logError("Falha no fluxo MFA administrativo.", error, {
    feature: "admin_mfa",
    stage,
    requestId,
    authName: auth.name,
    authCode: auth.code,
    authStatus: auth.status,
    // Nunca registrar qr_code, secret, uri, tokens ou cookies.
  });
}

async function requireSession(client: MfaAuthClient, stage: MfaStage = "session") {
  const { data, error } = await client.auth.getSession();
  if (error) throw toFlowError(error, stage);
  if (!data?.session) {
    throw new MfaFlowError({
      code: "session_expired",
      stage,
      message: userMessageForMfaError("session_expired"),
    });
  }
}

async function listAllFactors(client: MfaAuthClient): Promise<{
  all: FactorLike[];
  totp: FactorLike[];
}> {
  const { data, error } = await client.auth.mfa.listFactors();
  if (error) throw toFlowError(error, "list_factors");
  return {
    all: data?.all ?? [],
    totp: data?.totp ?? [],
  };
}

async function unenrollUnverifiedTotp(
  client: MfaAuthClient,
  factors: FactorLike[],
): Promise<number> {
  const unverified = factors.filter(
    (factor) => factor.factor_type === "totp" && factor.status !== "verified",
  );
  for (const factor of unverified) {
    const { error } = await client.auth.mfa.unenroll({ factorId: factor.id });
    if (error) throw toFlowError(error, "unenroll_unverified");
  }
  return unverified.length;
}

function setupFromEnrollment(data: {
  id: string;
  totp?: { qr_code?: string | null; secret?: string | null } | null;
}): MfaSetup {
  const qrCode = data.totp?.qr_code?.trim() ?? "";
  const secret = data.totp?.secret?.trim() ?? "";
  if (!data.id || !qrCode || !secret) {
    throw new MfaFlowError({
      code: "temporary_failure",
      stage: "enroll",
      message: userMessageForMfaError("temporary_failure"),
    });
  }
  if (!qrCode.startsWith("data:image/")) {
    throw new MfaFlowError({
      code: "temporary_failure",
      stage: "enroll",
      message: userMessageForMfaError("temporary_failure"),
    });
  }
  return {
    mode: "enroll",
    factorId: data.id,
    qrCode,
    secret,
  };
}

async function enrollFreshTotp(client: MfaAuthClient): Promise<MfaSetup> {
  const listed = await listAllFactors(client);
  await unenrollUnverifiedTotp(client, listed.all);

  const first = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: ADMIN_TOTP_FRIENDLY_NAME,
  });

  if (!first.error && first.data) {
    return setupFromEnrollment(first.data);
  }

  const classified = classifyMfaAuthError(first.error, "enroll");
  if (classified !== "pending_factor" && classified !== "temporary_failure") {
    throw toFlowError(first.error, "enroll");
  }

  // Conflito de nome ou falha transitória: limpa pendentes e tenta uma única vez.
  const again = await listAllFactors(client);
  await unenrollUnverifiedTotp(client, again.all);

  const second = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: ADMIN_TOTP_FRIENDLY_NAME,
  });
  if (second.error || !second.data) {
    throw toFlowError(second.error ?? first.error, "enroll");
  }
  return setupFromEnrollment(second.data);
}

async function prepareAdminMfaSetupOnce(client: MfaAuthClient): Promise<MfaSetup> {
  await requireSession(client, "session");

  const { data: assurance, error: assuranceError } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) throw toFlowError(assuranceError, "aal");
  if (!assurance) throw toFlowError(new Error("AAL indisponível."), "aal");
  if (assurance.currentLevel === "aal2") {
    throw new MfaFlowError({
      code: "already_configured",
      stage: "aal",
      message: userMessageForMfaError("already_configured"),
    });
  }

  const factors = await listAllFactors(client);
  const verified = factors.totp.find((factor) => factor.status === "verified");
  if (verified) {
    return { mode: "challenge", factorId: verified.id };
  }

  return enrollFreshTotp(client);
}

/**
 * Prepara o MFA administrativo com exclusão mútua.
 * Evita enrolls concorrentes (Strict Mode / reabertura do modal).
 */
export function prepareAdminMfaSetup(client: MfaAuthClient): Promise<MfaSetup> {
  if (!prepareInflight) {
    prepareInflight = prepareAdminMfaSetupOnce(client)
      .catch((error: unknown) => {
        const flowError = toFlowError(error, "enroll");
        if (flowError.code !== "already_configured") {
          logMfaFailure(flowError.stage, error, flowError.requestId);
        }
        throw new MfaFlowError({
          code: flowError.code,
          stage: flowError.stage,
          message: userMessageForMfaError(
            flowError.code,
            flowError.code === "unexpected" ? flowError.requestId : undefined,
          ),
          cause: error,
          auth: flowError.auth,
          requestId: flowError.requestId,
        });
      })
      .finally(() => {
        prepareInflight = null;
      });
  }
  return prepareInflight;
}

export async function verifyAdminMfaCode(
  client: MfaAuthClient,
  input: { factorId: string; code: string },
): Promise<void> {
  if (!/^\d{6}$/.test(input.code)) {
    throw new MfaFlowError({
      code: "invalid_code",
      stage: "verify",
      message: userMessageForMfaError("invalid_code"),
    });
  }
  if (verifyInflight) {
    return verifyInflight;
  }

  verifyInflight = (async () => {
    await requireSession(client, "verify");
    const { error } = await client.auth.mfa.challengeAndVerify({
      factorId: input.factorId,
      code: input.code,
    });
    if (error) {
      const flowError = toFlowError(error, "verify");
      logMfaFailure("verify", error, flowError.requestId);
      throw new MfaFlowError({
        code: flowError.code,
        stage: "verify",
        message: userMessageForMfaError(flowError.code, flowError.requestId),
        cause: error,
        auth: flowError.auth,
        requestId: flowError.requestId,
      });
    }

    const { data: assurance, error: assuranceError } =
      await client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) throw toFlowError(assuranceError, "assurance_refresh");
    if (!assurance || assurance.currentLevel !== "aal2") {
      throw new MfaFlowError({
        code: "temporary_failure",
        stage: "assurance_refresh",
        message: userMessageForMfaError("temporary_failure"),
      });
    }
  })().finally(() => {
    verifyInflight = null;
  });

  return verifyInflight;
}
