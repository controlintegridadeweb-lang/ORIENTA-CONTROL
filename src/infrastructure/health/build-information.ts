import "server-only";
import packageJson from "../../../package.json";
const compactCommit = (value: string | undefined) => value?.trim() ? value.trim().slice(0, 12) : null;
export function getBuildInformation() {
  return {
    service: "orienta",
    version: packageJson.version,
    commit: compactCommit(process.env.VERCEL_GIT_COMMIT_SHA) ?? compactCommit(process.env.GITHUB_SHA) ?? "local",
    environment: process.env.VERCEL_ENV?.trim() || process.env.NODE_ENV?.trim() || "unknown",
  } as const;
}
