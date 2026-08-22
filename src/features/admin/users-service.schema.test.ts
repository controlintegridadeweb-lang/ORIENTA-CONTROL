import { describe, expect, it } from "vitest";
import { createRespondentSchema } from "@/features/admin/users-service";

describe("createRespondentSchema", () => {
  const organizationId = "70e8ef56-ae08-4cab-a65a-a07b08ccb293";

  it("normaliza espaços dos campos textuais", () => {
    const parsed = createRespondentSchema.parse({
      email: "  respondente@example.invalid  ",
      fullName: "  Respondente de Teste  ",
      organizationId: `  ${organizationId}  `,
      password: "SenhaForte123!",
    });

    expect(parsed).toEqual({
      email: "respondente@example.invalid",
      fullName: "Respondente de Teste",
      organizationId,
      password: "SenhaForte123!",
    });
  });

  it("converte campos opcionais vazios em ausentes", () => {
    const parsed = createRespondentSchema.parse({
      email: "respondente@example.invalid",
      fullName: "   ",
      organizationId,
      password: "",
    });

    expect(parsed.fullName).toBeUndefined();
    expect(parsed.password).toBeUndefined();
  });

  it("rejeita valores de FormData que não sejam texto", () => {
    const parsed = createRespondentSchema.safeParse({
      email: new Blob(["x"]),
      organizationId,
    });

    expect(parsed.success).toBe(false);
  });
});
