import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { COVER_ASSET_FALLBACKS } from "./cover-asset-fallbacks";

const PUBLIC_PATHS = {
  logo: "public/assets/logo-orienta.png",
  brand: "public/assets/cover/brand.png",
  decoTop: "public/assets/cover/deco-top-left.png",
  decoBottom: "public/assets/cover/deco-bottom-right.png",
} as const;

export type ReportCoverAssetKey = keyof typeof PUBLIC_PATHS;

function decodeBase64Png(value: string): Uint8Array {
  return Uint8Array.from(Buffer.from(value, "base64"));
}

function readFromPublic(relativePath: string): Uint8Array | null {
  const fullPath = join(process.cwd(), relativePath);
  if (!existsSync(fullPath)) return null;
  return new Uint8Array(readFileSync(fullPath));
}

/** PNG da capa: disco em dev/teste; bytes embutidos no runtime sem public/. */
export function readReportCoverPng(key: ReportCoverAssetKey): Uint8Array {
  return readFromPublic(PUBLIC_PATHS[key]) ?? decodeBase64Png(COVER_ASSET_FALLBACKS[key]);
}
