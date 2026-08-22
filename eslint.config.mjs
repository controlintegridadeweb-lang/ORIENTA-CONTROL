import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    "supabase/.temp/**",
    ".vercel/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // A regra permanece ativa no projeto inteiro. Exceções, quando a
      // sincronização com uma fonte externa é inevitável, são declaradas no
      // arquivo específico com uma justificativa técnica verificável.
      "react-hooks/set-state-in-effect": "error",
      "react-hooks/exhaustive-deps": "warn",
      // Identificadores prefixados com "_" sao descartes intencionais
      // (ex.: parametros de contrato nao usados, destructuring parcial).
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
