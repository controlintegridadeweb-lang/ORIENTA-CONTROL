import { spawnSync } from "node:child_process";

const projectRef = process.env.SUPABASE_PROJECT_REF?.trim();
if (!projectRef) {
  console.error("Defina SUPABASE_PROJECT_REF com o projeto Supabase que deseja vincular.");
  process.exit(1);
}
if (!/^[a-z0-9]{20}$/.test(projectRef)) {
  console.error("SUPABASE_PROJECT_REF inválido. Informe os 20 caracteres exibidos no painel do projeto.");
  process.exit(1);
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["--no-install", "supabase", "link", "--project-ref", projectRef],
  { stdio: "inherit", shell: false },
);
if (result.error) throw result.error;
process.exit(result.status ?? 1);
