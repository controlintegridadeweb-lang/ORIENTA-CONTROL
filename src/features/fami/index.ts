/**
 * API pública client-safe do domínio FAMI.
 * Contratos de servidor ficam em `./server` (server-only).
 */
export {
  AXIS_COLORS,
  AXIS_COLOR_FALLBACK,
  colorForAxisName,
  colorForAxisNameOrFallback,
  sortAxesMaturity,
} from "./fami-axis-display";
export {
  buildSectionDetailRows,
  groupSectionDetailRowsByAxis,
  sortSectionsByFormOrder,
} from "./section-detail-view-model";
export { brtYearUtcBounds, currentBrtYear, getCalendarYearBrt } from "./fami-year";
export { FAMI_SCORING_GROUPS } from "./methodology-content";
export { levelMeta } from "./respondent-presentation";
export type { AxisMaturity } from "./types";
