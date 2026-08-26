import { describe, expect, it } from "vitest";
import {
  axisThemeKeyForName,
  getAxisTheme,
  getAxisThemeByKey,
  getAxisThemeStrict,
} from "./axis-theme";

describe("getAxisTheme", () => {
  it("resolve Governança, Ambiental e Social pela abstração compartilhada", () => {
    expect(getAxisTheme("Governança").primary).toBe("#0097B2");
    expect(getAxisTheme("Ambiental").primary).toBe("#16A34A");
    expect(getAxisTheme("Social").primary).toBe("#DB2777");
  });

  it("as tags do eixo usam o preenchimento forte (texto inverso branco)", () => {
    expect(getAxisTheme("Governança").strong).toBe("#00748A");
    expect(getAxisTheme("Ambiental").strong).toBe("#15803D");
    expect(getAxisTheme("Social").strong).toBe("#BE185D");
  });

  it("não exige condicionais locais por nome exato com acento", () => {
    expect(axisThemeKeyForName("Governanca")).toBe("governance");
    expect(getAxisThemeStrict("desconhecido")).toBeUndefined();
    expect(getAxisTheme("desconhecido").primary).toBe("#0F766E");
  });

  it("resolve a mesma fonte canônica quando a chave estrutural já é conhecida", () => {
    expect(getAxisThemeByKey("governance")).toEqual(getAxisTheme("Governança"));
    expect(getAxisThemeByKey("environmental")).toEqual(getAxisTheme("Ambiental"));
    expect(getAxisThemeByKey("social")).toEqual(getAxisTheme("Social"));
  });

  it("expõe fundos e bordas sólidos (sem rgba nem gradiente)", () => {
    for (const name of ["Governança", "Ambiental", "Social"] as const) {
      const theme = getAxisTheme(name);
      expect(theme.strong).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.tint).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.softBackground).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.border).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(theme.strong).not.toMatch(/rgba|gradient/i);
      expect(theme.tint).not.toMatch(/rgba|gradient/i);
      expect(theme.softBackground).not.toMatch(/rgba|gradient/i);
      expect(theme.border).not.toMatch(/rgba|gradient/i);
    }
  });
});
