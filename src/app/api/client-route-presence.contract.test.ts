import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Rotas consumidas diretamente pelos clientes administrativos/response UI.
 * Evita o estado inconsistente em que a tela continua compilando, mas o
 * endpoint do App Router foi removido durante uma refatoração.
 */
const activeClientRoutes = [
  "src/app/api/admin/cycles/[cycleId]/route.ts",
  "src/app/api/admin/cycles/[cycleId]/reference-period/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/evidences/[evidenceId]/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/not-applicable/[responseId]/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/admin-proof-decision/[responseId]/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/admin-not-applicable/[responseId]/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/adjustments/dispatch/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/analysis-draft/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/batch/route.ts",
  "src/app/api/respondent/cycles/[cycleId]/submit/route.ts",
  "src/app/api/admin/forms/[formId]/route.ts",
  "src/app/api/admin/forms/[formId]/readiness/route.ts",
  "src/app/api/admin/forms/[formId]/publish/route.ts",
  "src/app/api/admin/forms/[formId]/questions/route.ts",
  "src/app/api/admin/forms/[formId]/questions/[questionId]/route.ts",
  "src/app/api/admin/forms/[formId]/questions/reorder/route.ts",
  "src/app/api/admin/forms/[formId]/assignments/route.ts",
  "src/app/api/admin/forms/[formId]/questions/[questionId]/binding/route.ts",
  "src/app/api/admin/form-applications/[formId]/route.ts",
  "src/app/api/admin/form-applications/[formId]/deadline/route.ts",
  "src/app/api/admin/form-applications/[formId]/collection-pause/route.ts",
  "src/app/api/admin/form-applications/[formId]/reopen/route.ts",
  "src/app/api/admin/form-applications/[formId]/reopen-validation/route.ts",
  "src/app/api/admin/library/[entity]/route.ts",
  "src/app/api/admin/library/[entity]/[id]/route.ts",
  "src/app/api/admin/library/[entity]/[id]/transitions/route.ts",
  "src/app/api/admin/library/exceptions/[id]/route.ts",
  "src/app/api/admin/automation/jobs/[jobId]/route.ts",
  "src/app/api/admin/automation/jobs/[jobId]/download/route.ts",
  "src/app/api/reports/[reportId]/download/route.ts",
] as const;

describe("contrato de presença das rotas consumidas pela UI", () => {
  it.each(activeClientRoutes)("%s existe no App Router", (routePath) => {
    expect(existsSync(resolve(process.cwd(), routePath))).toBe(true);
  });
});
