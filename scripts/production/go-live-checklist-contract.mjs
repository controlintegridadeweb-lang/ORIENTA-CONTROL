export const REQUIRED_GO_LIVE_GATES = [
  "static_release",
  "dependency_audit",
  "production_environment",
  "database_migrations",
  "generated_types",
  "database_verify",
  "report_storage",
  "end_to_end",
  "smoke",
  "backup",
  "restore_drill",
  "final_data_snapshot",
  "migration_dry_run",
  "migration_parity",
  "rollback_plan",
  "incident_response",
  "homologation",
];

function isIsoDate(value) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}
function isValidUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}
export function validateGoLiveChecklistShape(checklist) {
  const issues = [];
  if (!checklist || typeof checklist !== "object" || Array.isArray(checklist)) return ["checklist deve ser um objeto JSON"];
  if (!checklist.release || typeof checklist.release !== "object") issues.push("release é obrigatório");
  if (!checklist.gates || typeof checklist.gates !== "object") issues.push("gates é obrigatório");
  for (const gate of REQUIRED_GO_LIVE_GATES) {
    if (!checklist.gates?.[gate]) issues.push(`gate ${gate} é obrigatório`);
  }
  return issues;
}
export function validateGoLiveApproval(checklist) {
  const issues = [...validateGoLiveChecklistShape(checklist)];
  const release = checklist?.release ?? {};
  if (!/^[0-9a-f]{7,40}$/i.test(String(release.commit ?? ""))) issues.push("release.commit deve conter SHA Git válido");
  if (!String(release.deploymentId ?? "").trim()) issues.push("release.deploymentId é obrigatório");
  if (!isValidUrl(release.baseUrl)) issues.push("release.baseUrl deve ser uma URL HTTPS válida");
  if (!String(release.approvedBy ?? "").trim()) issues.push("release.approvedBy é obrigatório");
  if (!isIsoDate(release.approvedAt)) issues.push("release.approvedAt deve ser ISO-8601 válido");

  for (const gate of REQUIRED_GO_LIVE_GATES) {
    const item = checklist?.gates?.[gate];
    if (!item) continue;
    if (item.status !== "approved") issues.push(`gate ${gate} ainda não está aprovado`);
    if (!String(item.evidence ?? "").trim()) issues.push(`gate ${gate} precisa de evidence`);
    if (!isIsoDate(item.checkedAt)) issues.push(`gate ${gate} precisa de checkedAt válido`);
  }
  return issues;
}
