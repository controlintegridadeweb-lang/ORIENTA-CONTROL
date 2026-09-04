import { readFileSync, writeFileSync } from "node:fs";

const assets = [
  ["logo", "public/assets/logo-orienta.png"],
  ["brand", "public/assets/cover/brand.png"],
  ["decoTop", "public/assets/cover/deco-top-left.png"],
  ["decoBottom", "public/assets/cover/deco-bottom-right.png"],
];

const entries = assets.map(([key, path]) => {
  const b64 = readFileSync(path).toString("base64");
  return `  ${key}: "${b64}"`;
});

const source = [
  "/** Bytes PNG da capa embutidos. Fallback quando public/ nao esta no filesystem do runtime. */",
  "export const COVER_ASSET_FALLBACKS = {",
  entries.join(",\n"),
  "} as const;",
  "",
].join("\n");

writeFileSync("src/features/reports/pdf/cover-asset-fallbacks.ts", source);
console.log(`wrote cover-asset-fallbacks.ts (${source.length} chars)`);
