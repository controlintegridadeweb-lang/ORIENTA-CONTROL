import { describe, expect, it } from "vitest";
import { SUPPORT_CHANNELS } from "./support-contacts";

describe("SUPPORT_CHANNELS", () => {
  it("expõe somente e-mail e WhatsApp do Setor de Integridade", () => {
    expect(SUPPORT_CHANNELS.email.value).toBe("integridadecge@gmail.com");
    expect(SUPPORT_CHANNELS.email.href).toBe("mailto:integridadecge@gmail.com");
    expect(SUPPORT_CHANNELS.whatsapp.value).toBe("(84) 9 8620-0805");
    expect(SUPPORT_CHANNELS.whatsapp.href).toBeNull();
    expect(Object.keys(SUPPORT_CHANNELS)).toEqual(["email", "whatsapp"]);
  });
});
