/**
 * API pública client-safe do domínio library.
 * Contratos de servidor ficam em `./server` (server-only).
 */
export type {
  InlineLibraryRecommendation,
  InlineMetric,
  LibraryBindings,
  QuestionLibraryConfiguration,
} from "./binding-types";
export { validateConfigurationForPublish } from "./binding-validation";
export {
  fetchLibraryCatalog,
  fetchQuestionConfiguration,
  saveQuestionConfiguration,
} from "./client";
export { bindingHasRecommendation, normalizeBindings } from "./normalize-bindings";
export type { LibraryAxis, LibrarySection } from "./types";
export {
  decideRecommendationException,
  listRecommendationExceptions,
  requestRecommendationException,
} from "./exceptions-client";
export type { RecommendationException } from "./exceptions-types";
