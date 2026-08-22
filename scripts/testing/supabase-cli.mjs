#!/usr/bin/env node
/**
 * Executa o Supabase CLI da versão pinada em package.json.
 * Uso: node scripts/testing/supabase-cli.mjs <args...>
 */
import { runSupabase } from "../shared/supabase-cli-path.mjs";

const result = runSupabase(process.argv.slice(2), {
  cwd: process.cwd(),
  stdio: "inherit",
  encoding: "utf8",
});
process.exit(result.status ?? 1);
