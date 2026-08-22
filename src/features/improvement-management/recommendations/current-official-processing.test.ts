import { describe, expect, it } from "vitest";
import { selectCurrentOfficialProcessingId } from "./current-official-processing";

const CYCLE_ID = "00000000-0000-4000-8000-000000000001";
const COMPLETED_V1 = "00000000-0000-4000-8000-000000000011";
const COMPLETED_V2 = "00000000-0000-4000-8000-000000000012";

function candidate(id: string, processingVersion: number) {
  return {
    id,
    cycle_id: CYCLE_ID,
    processing_version: processingVersion,
    status: "completed" as const,
  };
}

describe("selectCurrentOfficialProcessingId", () => {
  it("usa o processamento concluído mais recente", () => {
    expect(
      selectCurrentOfficialProcessingId([
        candidate(COMPLETED_V1, 1),
        candidate(COMPLETED_V2, 2),
      ]),
    ).toBe(COMPLETED_V2);
  });

  it("não inventa processamento oficial quando nenhum foi concluído", () => {
    expect(selectCurrentOfficialProcessingId([])).toBeNull();
  });
});
