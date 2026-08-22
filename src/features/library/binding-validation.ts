import type { LibraryBindings, QuestionLibraryConfiguration } from "./binding-types";
import { bindingHasRecommendation } from "./normalize-bindings";

export function computeCoverageScore(bindings: LibraryBindings): number {
  return bindingHasRecommendation(bindings) ? 100 : 0;
}

export function validateConfigurationForPublish(
  configuration: QuestionLibraryConfiguration,
): { valid: boolean; missing: string[] } {
  const missing: string[] = [];
  if (!bindingHasRecommendation(configuration.bindings)) {
    missing.push("defaultRecommendation");
  }
  if (!configuration.metric?.name) {
    missing.push("metric");
  }
  return { valid: missing.length === 0, missing };
}
