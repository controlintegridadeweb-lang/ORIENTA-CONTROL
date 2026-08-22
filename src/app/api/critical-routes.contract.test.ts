import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

const routeImplementations: Record<string, string | string[]> = {
  "src/app/api/admin/cycles/batch/route.ts":
    "src/features/cycles/http/create-cycles-batch-route.ts",
  "src/app/api/respondent/cycles/[cycleId]/submit/route.ts":
    "src/features/cycles/http/submit-cycle-route.ts",
  "src/app/api/admin/cycles/[cycleId]/reference-period/route.ts":
    "src/features/cycles/http/reference-period-route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/evidences/[evidenceId]/route.ts":
    "src/features/validation/http/evidence-validation-route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/not-applicable/[responseId]/route.ts":
    "src/features/validation/http/not-applicable-validation-route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/admin-proof-decision/[responseId]/route.ts":
    "src/features/validation/http/admin-proof-decision-route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/admin-not-applicable/[responseId]/route.ts":
    "src/features/validation/http/admin-applicability-route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/adjustments/dispatch/route.ts":
    "src/features/validation/http/adjustment-dispatch-route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/analysis-draft/route.ts":
    "src/features/validation/http/analysis-draft-route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/batch/route.ts":
    "src/features/validation/http/validation-batch-route.ts",
  "src/app/api/reports/official/route.ts":
    "src/features/reports/http/official-route.ts",
  "src/app/api/reports/[reportId]/download/route.ts":
    "src/features/reports/http/download-route.ts",
  "src/app/api/workbench/evidence/upload/route.ts": [
    "src/app/api/workbench/evidence/upload/route.ts",
    "src/application/workbench-evidence-upload/initialize-evidence-upload.ts",
    "src/application/workbench-evidence-upload/verify-evidence-upload.ts",
  ],
};

const criticalRoutes = [
  "src/app/api/admin/cycles/route.ts",
  "src/app/api/admin/cycles/batch/route.ts",
  "src/app/api/respondent/cycles/[cycleId]/submit/route.ts",
  "src/app/api/admin/cycles/[cycleId]/reference-period/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/consolidate/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation-reopen-impact/route.ts",
  "src/app/api/admin/cycles/[cycleId]/transition/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/evidences/[evidenceId]/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/not-applicable/[responseId]/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/admin-proof-decision/[responseId]/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/admin-not-applicable/[responseId]/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/adjustments/dispatch/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/analysis-draft/route.ts",
  "src/app/api/admin/cycles/[cycleId]/validation/batch/route.ts",
  "src/app/api/workbench/evidence/upload/route.ts",
  "src/app/api/reports/official/route.ts",
  "src/app/api/reports/[reportId]/download/route.ts",
  "src/app/api/evidences/[evidenceId]/file/route.ts",
  "src/app/api/action-plan-documents/[documentId]/file/route.ts",
] as const;

function source(path: string): string {
  return readFileSync(resolve(root, path), "utf8");
}

function implementationSource(path: string): string {
  const mapped = routeImplementations[path] ?? path;
  const files = Array.isArray(mapped) ? mapped : [mapped];
  return files.map(source).join("\n");
}

describe("contrato das rotas críticas", () => {
  it.each(criticalRoutes)("%s exige autenticação backend", (path) => {
    const content = implementationSource(path);
    expect(content).toMatch(/withRoute\s*(?:<[^>]+>)?\s*\(|requireAuth\s*\(/);
  });

  it("mantém validação de payload nas mutações com corpo", () => {
    const mutationRoutes = [
      "src/app/api/admin/cycles/batch/route.ts",
      "src/app/api/admin/cycles/[cycleId]/reference-period/route.ts",
      "src/app/api/admin/cycles/[cycleId]/transition/route.ts",
      "src/app/api/admin/cycles/[cycleId]/validation/evidences/[evidenceId]/route.ts",
      "src/app/api/admin/cycles/[cycleId]/validation/not-applicable/[responseId]/route.ts",
      "src/app/api/admin/cycles/[cycleId]/validation/admin-proof-decision/[responseId]/route.ts",
      "src/app/api/admin/cycles/[cycleId]/validation/admin-not-applicable/[responseId]/route.ts",
      "src/app/api/admin/cycles/[cycleId]/validation/analysis-draft/route.ts",
      "src/app/api/admin/cycles/[cycleId]/validation/batch/route.ts",
      "src/app/api/workbench/evidence/upload/route.ts",
      "src/app/api/reports/official/route.ts",
    ];
    for (const path of mutationRoutes) {
      const content = implementationSource(path);
      expect(content, path).toMatch(/z\.object\(|Schema|schema\./i);
      expect(content, path).not.toMatch(/request\.json\(\)\s+as\s+/);
    }
  });

  it("restringe service_role às rotas e módulos de servidor", () => {
    for (const path of criticalRoutes) {
      const route = source(path);
      const implementation = implementationSource(path);
      expect(route, path).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(implementation, path).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
    expect(source("src/infrastructure/supabase/server.ts")).toContain('import "server-only"');
  });

  it("entrega arquivos privados persistidos apenas por URL assinada", () => {
    const evidenceDownload = implementationSource("src/app/api/evidences/[evidenceId]/file/route.ts");
    const actionPlanDocumentDownload = implementationSource(
      "src/app/api/action-plan-documents/[documentId]/file/route.ts",
    );
    const reportDownload = implementationSource("src/app/api/reports/[reportId]/download/route.ts");

    for (const content of [evidenceDownload, actionPlanDocumentDownload, reportDownload]) {
      expect(content).toContain("createSignedUrl");
      expect(content).not.toMatch(/\.download\s*\(/);
    }
  });
});
