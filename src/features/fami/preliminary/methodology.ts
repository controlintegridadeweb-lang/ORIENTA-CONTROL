export const FAMI_PRELIMINARY_METHODOLOGY_V1 = "prelim_v1" as const;
export const FAMI_PRELIMINARY_METHODOLOGY_V2 = "prelim_v2" as const;

export const FAMI_PRELIMINARY_METHODOLOGY_VERSIONS = [
  FAMI_PRELIMINARY_METHODOLOGY_V1,
  FAMI_PRELIMINARY_METHODOLOGY_V2,
] as const;

export type FamiPreliminaryMethodologyVersion =
  (typeof FAMI_PRELIMINARY_METHODOLOGY_VERSIONS)[number];
