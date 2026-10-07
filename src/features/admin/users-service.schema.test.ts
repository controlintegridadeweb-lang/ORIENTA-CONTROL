import { describe, expect, it } from "vitest";
import { createRespondentSchema } from "@/features/admin/users-service";

describe("createRespondentSchema", () => {
  const organizationId = "70e8ef56-ae08-4cab-a65a-a07b08ccb293";

  it("normaliza espaços dos campos textuais", () => {
    const parsed = createRespondentSchema.parse({
      email: "  respondente@example.invalid  ",
      fullName: "  Respondente de Teste  ",
      organizationId: `  ${organizationId}  `,
      appointment: "titular",
      password: "SenhaForte123!",
    });

    expect(parsed).toEqual({
      email: "respondente@example.invalid",
      fullName: "Respondente de Teste",
      organizationId,
      appointment: "titular",
      password: "SenhaForte123!",
    });
  });

  it("converte campos opcionais vazios em ausentes", () => {
    const parsed = createRespondentSchema.parse({
      email: "respondente@example.invalid",
      fullName: "   ",
      organizationId,
      appointment: "suplente",
      password: "",
    });

    expect(parsed.fullName).toBeUndefined();
    expect(parsed.password).toBeUndefined();
    expect(parsed.appointment).toBe("suplente");
  });

  it("exige cargo titular ou suplente", () => {
    const parsed = createRespondentSchema.safeParse({
      email: "respondente@example.invalid",
      organizationId,
      appointment: "coordenador",
    });

    expect(parsed.success).toBe(false);
  });

  it("rejeita valores de FormData que não sejam texto", () => {
    const parsed = createRespondentSchema.safeParse({
      email: new Blob(["x"]),
      organizationId,
    });

    expect(parsed.success).toBe(false);
  });
});
