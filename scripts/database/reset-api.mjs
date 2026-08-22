/**
 * Reset destrutivo do schema public + buckets via Management API (HTTPS),
 * quando a porta 5432 está bloqueada. Uso operacional; não faz parte do app.
 *
 * Uso:
 *   SUPABASE_ACCESS_TOKEN=sbp_... npm run db:reset:api
 *
 * Token: https://supabase.com/dashboard/account/tokens
 */
import { loadEnv, supabaseProjectRef } from "../shared/load-env.mjs";

loadEnv();

const ref = supabaseProjectRef();
const token = process.env.SUPABASE_ACCESS_TOKEN;

async function q(sql) {
  const r = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    },
  );
  const body = await r.text();
  if (!r.ok) {
    throw new Error(`HTTP ${r.status}: ${body}`);
  }
  return body;
}

console.log("Resetando schema public e buckets de storage…");

await q(`
  drop schema if exists public cascade;
  create schema public;
  grant all on schema public to postgres;
  grant all on schema public to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
`);

await q(`
  delete from storage.buckets where id in ('evidencias', 'planos-acao', 'relatorios');
`);

console.log("Reset concluído.");
