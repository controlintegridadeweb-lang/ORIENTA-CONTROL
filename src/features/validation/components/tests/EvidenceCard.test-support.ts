import type { QueueEvidence, QueueEvidenceGroup } from "@/features/validation/queue-model";
import { deriveResponseEvidenceStatus } from "@/features/validation/queue-model";

export function makeEvidence(over: Partial<QueueEvidence> = {}): QueueEvidence {
  return {
    id: "evidence-1",
    responseId: "response-1",
    questionPrompt: "Existe política de integridade?",
    sectionId: "section-integridade",
    sectionName: "Integridade",
    sectionOrder: 0,
    axisId: "axis-governanca",
    axisName: "Governança",
    orderIndex: 0,
    kind: "file",
    fileName: "politica.pdf",
    externalLink: null,
    linkReason: null,
    submittedAt: "2026-07-28T15:30:00.000Z",
    status: "pending",
    justification: null,
    answer: "yes",
    respondentNote: null,
    answeredByName: "Mauricio",
    answeredAt: "2026-07-28T15:30:00.000Z",
    ...over,
  };
}

export function makeGroup(
  documents: QueueEvidence[],
  over: Partial<QueueEvidenceGroup> = {},
): QueueEvidenceGroup {
  const head = documents[0];
  const base: QueueEvidenceGroup = {
    responseId: head?.responseId ?? "response-1",
    questionPrompt: head?.questionPrompt ?? "Existe política de integridade?",
    sectionId: head?.sectionId ?? "section-integridade",
    sectionName: head?.sectionName ?? "Integridade",
    sectionOrder: head?.sectionOrder ?? 0,
    axisId: head?.axisId ?? "axis-governanca",
    axisName: head?.axisName ?? "Governança",
    orderIndex: head?.orderIndex ?? 0,
    answer: head?.answer ?? "yes",
    respondentNote: head?.respondentNote ?? null,
    answeredByName: head?.answeredByName ?? null,
    answeredAt: head?.answeredAt ?? null,
    allowsNotApplicable: Boolean(head?.allowsNotApplicable),
    adminProofObservation: head?.adminProofObservation ?? null,
    status: documents.length > 0 ? deriveResponseEvidenceStatus(documents) : "not_presented",
    documents,
  };
  return { ...base, ...over, documents: over.documents ?? documents };
}
