import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);

/** CLI da dependência `supabase` versionada no package.json. */
export function supabaseCliPath() {
  return join(dirname(require.resolve("supabase/package.json")), "dist", "supabase.js");
}

export function runSupabase(args, options = {}) {
  return spawnSync(process.execPath, [supabaseCliPath(), ...args], {
    encoding: "utf8",
    maxBuffer: 32 * 1024 * 1024,
    ...options,
  });
}
