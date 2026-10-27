import { afterEach, describe, expect, it } from "vitest";
import {
  createExecutionId,
  JOURNEY_FORM_PREFIX,
  journeyFormName,
  journeyPeriodLabel,
} from "../../e2e/fixtures/execution-id";

const originalRunId = process.env.E2E_RUN_ID;

afterEach(() => {
  if (originalRunId === undefined) delete process.env.E2E_RUN_ID;
  else process.env.E2E_RUN_ID = originalRunId;
});

describe("identificador da execução E2E", () => {
  it("aceita um identificador explícito e recusa valor fora do padrão", () => {
    process.env.E2E_RUN_ID = "run-2401";
    expect(createExecutionId()).toBe("run-2401");
    process.env.E2E_RUN_ID = "com espaço";
    expect(() => createExecutionId()).toThrow(/E2E_RUN_ID/);
  });

  it("gera nomes e períodos únicos sem estourar o limite do produto", () => {
    const canonical = journeyFormName("261023154012ab");
    const percentual = journeyFormName("261023154012ab", "percentual");
    expect(canonical.startsWith(`${JOURNEY_FORM_PREFIX} `)).toBe(true);
    expect(canonical).not.toBe(percentual);
    expect(canonical.length).toBeLessThanOrEqual(200);
    expect(journeyPeriodLabel("261023154012ab").length).toBeLessThanOrEqual(60);
    expect(journeyPeriodLabel("261023154012ab", "percentual").length).toBeLessThanOrEqual(60);
  });
});
