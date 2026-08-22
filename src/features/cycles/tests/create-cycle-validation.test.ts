import { describe, expect, it } from "vitest";
import { validateCreateCycleForm } from "../create-cycle-validation";

const base = {
  formId: "form-1",
  periodLabel: "2026",
  referenceStartYear: "2026",
  referenceEndYear: "2026",
  availableOrganizations: 2,
  selectedOrganizations: 2,
  launchMode: "schedule" as const,
  startsAt: "2026-07-18T09:00",
  responseDeadlineAt: "2026-07-25T18:00",
  scheduleValidation: true,
  validationDeadlineAt: "2026-07-26T09:00",
  scheduleClose: true,
  cycleCloseAt: "2026-07-30T09:00",
  now: new Date("2026-07-17T20:00:00-03:00").getTime(),
};

describe("validateCreateCycleForm", () => {
  it("aceita um calendário linear no fuso oficial", () => {
    expect(validateCreateCycleForm(base)).toEqual({});
  });

  it("aponta cada campo obrigatório sem esconder os demais", () => {
    expect(
      validateCreateCycleForm({
        ...base,
        formId: "",
        periodLabel: "",
        referenceStartYear: "",
        referenceEndYear: "",
        availableOrganizations: 0,
        selectedOrganizations: 0,
        startsAt: "",
        responseDeadlineAt: "",
        validationDeadlineAt: "",
        cycleCloseAt: "",
      }),
    ).toMatchObject({
      formId: expect.any(String),
      periodLabel: expect.any(String),
      referenceStartYear: expect.any(String),
      referenceEndYear: expect.any(String),
      organizations: expect.any(String),
      startsAt: expect.any(String),
      responseDeadlineAt: expect.any(String),
      validationDeadlineAt: expect.any(String),
      cycleCloseAt: expect.any(String),
    });
  });

  it("impede datas programadas fora da sequência operacional", () => {
    const errors = validateCreateCycleForm({
      ...base,
      startsAt: "2026-07-17T20:02",
      responseDeadlineAt: "2026-07-17T19:00",
      validationDeadlineAt: "2026-07-17T18:00",
      cycleCloseAt: "2026-07-17T17:00",
    });
    expect(errors.startsAt).toContain("cinco minutos");
    expect(errors.responseDeadlineAt).toContain("anterior à abertura");
    expect(errors.validationDeadlineAt).toContain("posterior ao prazo");
    expect(errors.cycleCloseAt).toContain("posterior à validação");
  });

  it("não exige calendário ao salvar somente rascunhos", () => {
    expect(
      validateCreateCycleForm({
        ...base,
        launchMode: "draft",
        startsAt: "",
        responseDeadlineAt: "",
        scheduleValidation: false,
        validationDeadlineAt: "",
        scheduleClose: false,
        cycleCloseAt: "",
      }),
    ).toEqual({});
  });
});
