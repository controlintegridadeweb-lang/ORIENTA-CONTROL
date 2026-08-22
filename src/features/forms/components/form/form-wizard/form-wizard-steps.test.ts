import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  derivePersistedWizardStep,
  parseWizardStep,
  resolveWizardStepAccess,
  wizardStepHref,
  wizardStepStatus,
} from "./form-wizard-steps";

describe("form wizard steps", () => {
  it("normaliza etapas inválidas", () => {
    expect(parseWizardStep(null)).toBe(1);
    expect(parseWizardStep("3")).toBe(3);
    expect(parseWizardStep("99")).toBe(1);
  });

  it("não permite saltar além do progresso alcançado", () => {
    expect(resolveWizardStepAccess(5, 3)).toEqual({ currentStep: 3, maxReachableStep: 3 });
  });

  it("gera o deep link canônico", () => {
    expect(wizardStepHref("form-1", 4)).toBe("/admin/formularios/form-1/configuracao?etapa=4");
  });

  it("reconstrói o progresso usando dados persistidos", () => {
    expect(derivePersistedWizardStep({ questionCount: 0, bindingsComplete: false, assignmentCount: 0 })).toBe(2);
    expect(derivePersistedWizardStep({ questionCount: 2, bindingsComplete: false, assignmentCount: 1 })).toBe(2);
    expect(derivePersistedWizardStep({ questionCount: 2, bindingsComplete: true, assignmentCount: 0 })).toBe(3);
    expect(derivePersistedWizardStep({ questionCount: 2, bindingsComplete: true, assignmentCount: 1 })).toBe(4);
  });

  it("classifica etapa atual, concluída, disponível e bloqueada", () => {
    expect(wizardStepStatus(2, 2, 3)).toBe("current");
    expect(wizardStepStatus(1, 2, 3)).toBe("complete");
    expect(wizardStepStatus(3, 2, 3)).toBe("available");
    expect(wizardStepStatus(5, 2, 3)).toBe("locked");
  });

  it("numera as etapas em círculos, com a atual no verde institucional", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/forms/components/form/form-wizard/form-wizard-stepper.tsx"),
      "utf8",
    );

    expect(source).toContain("rounded-full");
    expect(source).toContain("bg-brand");
    expect(source).toContain("ring-brand-100");
    expect(source).toContain("bg-brand-50/60");
    expect(source).toContain("flex-1");
    expect(source).toContain("h-12 w-12");
    expect(source).toContain("<Check");
    expect(source).not.toContain("underlineTabLinkClass");
    expect(source).not.toContain("sm:justify-center");
  });

  it("cadastro de pergunta começa pela seção da biblioteca, com o botão à esquerda", () => {
    const source = readFileSync(
      join(process.cwd(), "src/features/forms/components/form/form-question-create-form.tsx"),
      "utf8",
    );

    expect(source.indexOf("new-question-section")).toBeLessThan(source.indexOf("new-question-prompt"));
    expect(source).toContain("justify-start");
    expect(source).toContain("fieldHint");
  });
});
