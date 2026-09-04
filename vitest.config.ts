import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // `server-only` é um guard de build do Next (lança se importado no client).
      // Em testes (ambiente node) não há client/server split; aponta para um
      // stub vazio para permitir testar módulos marcados com `import "server-only"`.
      "server-only": path.resolve(__dirname, "./src/test/server-only-stub.ts"),
    },
  },
  test: {
    // Margem de segurança para CI/máquinas mais lentas. O default do vitest é
    // 5000ms; testes que arrastam grafos de módulos grandes (ex.: o de
    // conferência FAMI) podem estourar esse limite só no transform/resolução
    // sob carga — não por hang real. 20s remove a fragilidade sem mascarar bug.
    testTimeout: 20000,
    hookTimeout: 20000,
    // Playwright é uma suíte distinta, executada por `npm run test:e2e`.
    exclude: [
      "e2e/**",
      "node_modules/**",
      "dist/**",
      ".next/**",
      // Usa node:test (npm run data:migration:test-source-guard), não Vitest.
    ],
    coverage: {
      provider: "v8",
      reporter: ["text"],
      // No Vitest 4, `include` é o mecanismo que inclui também arquivos
      // não exercitados quando a suíte completa é executada. O escopo é
      // abrange regras determinísticas, contratos HTTP e serviços puros com testes
      // dedicados. Rotas, UI e integrações continuam validadas por testes de
      // componente, DB verify e Playwright no CI.
      include: [
        "src/shared/domain/**/*.ts",
        "src/features/cycles/commit/**/*.ts",
        "src/features/cycles/cycle-state-service.ts",
        "src/features/cycles/create-cycle-service.ts",
        "src/features/cycles/update-cycle-service.ts",
        "src/features/cycles/submit-cycle-service.ts",
        "src/features/workbench/validate-yes-evidence.ts",
        "src/features/evidences/next-step.ts",
        "src/features/evidences/storage-path.ts",
        "src/features/validation/evidence-status-policy.ts",
        "src/features/validation/validation-decision-policy.ts",
        "src/features/validation/form-criterion-classification.ts",
        "src/features/validation/form-filter-codec.ts",
        "src/features/validation/form-summary.ts",
        "src/features/improvement-management/action-plans/plan-status-map.ts",
        "src/features/improvement-management/action-plans/schemas.ts",
        "src/infrastructure/supabase/database-error.ts",
        "src/infrastructure/supabase/pagination.ts",
        "src/infrastructure/api/auth.ts",
        "src/infrastructure/api/contract-schema.ts",
        "src/infrastructure/api/domain-errors.ts",
        "src/infrastructure/api/fetch-client.ts",
        "src/infrastructure/api/tenant-guard.ts",
        "src/infrastructure/api/user-facing-error.ts",
        "src/infrastructure/api/with-route.ts",
        "src/infrastructure/auth/safe-redirect.ts",
        "src/infrastructure/auth/scope.ts",
        "src/shared/config/admin-list-url.ts",
        "src/shared/config/app-url.ts",
        "src/shared/datetime/business-date.ts",
        "src/shared/datetime/fortaleza-date-time.ts",
        "src/shared/export/csv.ts",
        "src/shared/navigation/admin-navigation-context.ts",
        "src/shared/navigation/evidence-list-paths.ts",
        "src/shared/navigation/fami-paths.ts",
        "src/shared/navigation/query-path.ts",
        "src/shared/navigation/respondent-navigation-context.ts",
        "src/features/respondent-progress/respondent-dashboard-focus.ts",
        "src/features/respondent-progress/respondent-dashboard-summary.ts",
        "src/features/respondent-progress/respondent-dashboard-year.ts",
        "src/features/respondent-progress/respondent-form-year-scope.ts",
        "src/features/evidences/file-links.ts",
        "src/features/evidences/file-validation.ts",
        "src/features/evidences/http-filters.ts",
        "src/features/evidences/respondent-evidence-helpers.ts",
        "src/features/evidences/status-groups.ts",
        "src/features/fami/cycle-options.ts",
        "src/features/fami/evolution-segments.ts",
        "src/features/fami/fami-axis-display.ts",
        "src/features/fami/fami-year.ts",
        "src/features/fami/frozen-scope-catalog.ts",
        "src/features/fami/respondent-presentation.ts",
        "src/features/improvement-management/action-plans/audit-presentation.ts",
        "src/features/improvement-management/action-plans/availability.ts",
        "src/features/improvement-management/action-plans/completion-readiness.ts",
        "src/features/improvement-management/action-plans/domain-model.ts",
        "src/features/improvement-management/action-plans/plan-metrics.ts",
        "src/features/improvement-management/action-plans/plan-progress.ts",
        "src/features/improvement-management/monitoring/csv.ts",
        "src/features/improvement-management/recommendations/current-official-processing.ts",
        "src/features/validation/pagination.ts",
        "src/features/validation/public-errors.ts",
        "src/features/workbench/adjustment-progress.ts",
        "src/features/workbench/http-contracts.ts",
        "src/features/workbench/section-completion.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.test.tsx", "src/test/**"],
      // Piso global de regressão do núcleo produtivo explicitamente coberto.
      thresholds: {
        lines: 70,
        functions: 75,
        statements: 70,
        branches: 60,
      },
    },
  },
});
