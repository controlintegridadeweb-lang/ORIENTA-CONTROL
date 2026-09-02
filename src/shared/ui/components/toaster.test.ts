import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Toaster da plataforma", () => {
  it("carrega o CSS do Sonner 2 para o toast não cair no fluxo da página", () => {
    expect(source("src/app/globals.css")).toContain('sonner/dist/styles.css');
  });

  it("não aplica borda genérica que vira contorno nativo sem o CSS da lib", () => {
    expect(source("src/shared/ui/components/toaster.tsx")).not.toMatch(
      /toast:\s*"rounded-xl border /,
    );
  });
});
