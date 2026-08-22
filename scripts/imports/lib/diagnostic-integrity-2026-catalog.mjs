import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const DIAGNOSTIC_INTEGRITY_2026_CATALOG_PATH = resolve(
  here,
  "../reference/diagnostico-integridade-2026.questions.json",
);

export function loadDiagnosticIntegrity2026Catalog() {
  const parsed = JSON.parse(
    readFileSync(DIAGNOSTIC_INTEGRITY_2026_CATALOG_PATH, "utf8"),
  );
  if (!Array.isArray(parsed) || parsed.length !== 126) {
    throw new Error(
      `Catálogo do Diagnóstico de Integridade 2026 deve conter 126 critérios; contém ${Array.isArray(parsed) ? parsed.length : "valor não-array"}.`,
    );
  }

  return parsed.map((question, index) => {
    const expectedOrder = index + 1;
    if (question?.source_order !== expectedOrder) {
      throw new Error(
        `Ordem do catálogo interrompida no critério ${expectedOrder}.`,
      );
    }
    if (typeof question.prompt !== "string" || question.prompt.trim() === "") {
      throw new Error(`Critério ${expectedOrder} sem enunciado válido.`);
    }
    if (typeof question.requires_evidence !== "boolean") {
      throw new Error(
        `Critério ${expectedOrder} sem requires_evidence booleano.`,
      );
    }
    return question;
  });
}
