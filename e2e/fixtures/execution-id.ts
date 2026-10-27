import { randomBytes } from "node:crypto";

/** Prefixo estável dos formulários criados pela jornada. O sufixo distingue a execução. */
export const JOURNEY_FORM_PREFIX = "Diagnóstico E2E - Jornada Canônica";

const RUN_ID_PATTERN = /^[A-Za-z0-9-]{4,24}$/;

export function createExecutionId(now = new Date()): string {
  const fromEnv = process.env.E2E_RUN_ID?.trim();
  if (fromEnv) {
    if (!RUN_ID_PATTERN.test(fromEnv)) {
      throw new Error("E2E_RUN_ID deve ter de 4 a 24 letras, dígitos ou hífens.");
    }
    return fromEnv;
  }
  const pad = (value: number) => String(value).padStart(2, "0");
  const stamp = [
    String(now.getFullYear()).slice(2),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
  return `${stamp}${randomBytes(1).toString("hex")}`;
}

/** Um identificador por processo. Execuções seguintes não reutilizam o formulário anterior. */
export const E2E_RUN_ID = createExecutionId();

export function journeyFormName(runId = E2E_RUN_ID, suffix = ""): string {
  const name = suffix
    ? `${JOURNEY_FORM_PREFIX} ${runId} ${suffix}`
    : `${JOURNEY_FORM_PREFIX} ${runId}`;
  if (name.length > 200) {
    throw new Error("O nome do formulário de teste excede 200 caracteres.");
  }
  return name;
}

export function journeyPeriodLabel(runId = E2E_RUN_ID, suffix = ""): string {
  const label = suffix ? `E2E ${runId} ${suffix}` : `E2E ${runId}`;
  if (label.length > 60) {
    throw new Error("O período do diagnóstico de teste excede 60 caracteres.");
  }
  return label;
}
