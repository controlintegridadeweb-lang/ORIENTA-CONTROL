import type {
  AdminProofStatus,
  EvidenceVerdict,
  QueueEvidence,
} from "./queue-types";

export function deriveResponseEvidenceStatus(
  documents: ReadonlyArray<Pick<QueueEvidence, "status" | "absentEvidence">>,
): EvidenceVerdict {
  if (
    documents.length === 0 ||
    documents.every((item) => item.absentEvidence || item.status === "not_presented")
  ) {
    return "not_presented";
  }
  const realDocuments = documents.filter((item) => !item.absentEvidence);
  if (realDocuments.some((item) => item.status === "adjustment_requested")) {
    return "adjustment_requested";
  }
  if (realDocuments.some((item) => item.status === "pending")) return "pending";
  if (realDocuments.some((item) => item.status === "approved")) return "approved";
  return "invalidated";
}

export function absentEvidenceStatusFromProof(
  adminProofStatus: AdminProofStatus,
): Extract<
  EvidenceVerdict,
  | "not_presented"
  | "validated_without_proof"
  | "proof_requested"
  | "considered_insufficient"
> {
  return adminProofStatus ?? "not_presented";
}

export function createAbsentEvidenceShell(
  input: Omit<
    QueueEvidence,
    | "id"
    | "kind"
    | "title"
    | "textBody"
    | "fileName"
    | "externalLink"
    | "linkReason"
    | "submittedAt"
    | "status"
    | "justification"
    | "validatedAt"
    | "validatedByName"
    | "absentEvidence"
  > & {
    status?: Extract<
      EvidenceVerdict,
      | "not_presented"
      | "validated_without_proof"
      | "proof_requested"
      | "considered_insufficient"
    >;
    justification?: string | null;
    validatedAt?: string | null;
    validatedByName?: string | null;
  },
): QueueEvidence {
  return {
    ...input,
    id: `absent:${input.responseId}`,
    kind: "link",
    title: null,
    textBody: null,
    fileName: null,
    externalLink: null,
    linkReason: null,
    submittedAt: null,
    status: input.status ?? "not_presented",
    justification: input.justification ?? null,
    validatedAt: input.validatedAt ?? null,
    validatedByName: input.validatedByName ?? null,
    absentEvidence: true,
    adminProofObservation: input.adminProofObservation ?? null,
  };
}
