import { describe, expect, it } from "vitest";
import { adminProofStatusSchema } from "./admin-proof-status";

describe("adminProofStatusSchema", () => {
  it.each([
    "validated_without_proof",
    "proof_requested",
    "considered_insufficient",
  ] as const)("aceita o status canônico %s", (status) => {
    expect(adminProofStatusSchema.parse(status)).toBe(status);
  });

  it("rejeita valores fora do enum do banco", () => {
    expect(adminProofStatusSchema.safeParse("pending").success).toBe(false);
  });
});
