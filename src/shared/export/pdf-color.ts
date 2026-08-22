import { rgb, type RGB } from "pdf-lib";

/** Converte hex sólido `#RRGGBB` para o espaço de cor do pdf-lib. */
export function hexToPdfRgb(hex: string): RGB {
  const match = /^#?([0-9A-Fa-f]{6})$/.exec(hex.trim());
  if (!match) {
    throw new Error(`Hex inválido para PDF: ${hex}`);
  }
  const value = match[1];
  return rgb(
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  );
}
