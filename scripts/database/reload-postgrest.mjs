#!/usr/bin/env node
import { loadEnv, supabaseProjectRef } from "../shared/load-env.mjs";

loadEnv();

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const ref = supabaseProjectRef();
if (!token || !ref) {
  console.error("SUPABASE_ACCESS_TOKEN e NEXT_PUBLIC_SUPABASE_URL são obrigatórios.");
  process.exit(1);
}

const query = `
notify pgrst, 'reload schema';
select proname, pg_get_function_identity_arguments(oid) as args
from pg_proc
where proname = 'list_validation_form_page'
  and pronamespace = 'public'::regnamespace;
`;

const response = await fetch(
  `https://api.supabase.com/v1/projects/${ref}/database/query`,
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  },
);

const body = await response.text();
console.log("status", response.status);
console.log(body);
if (!response.ok) process.exit(1);
