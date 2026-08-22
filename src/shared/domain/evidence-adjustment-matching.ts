export type EvidenceAdjustmentRecord = {
  id: string;
  validationStatus: string | null;
  submittedAt: string;
  validatedAt?: string | null;
};

export type EvidenceAdjustmentResolution = {
  requestedCount: number;
  resolvedCount: number;
  unresolvedCount: number;
  hasAdjustmentRequest: boolean;
  hasResolvedAllAdjustments: boolean;
};

type TimedRecord = {
  id: string;
  timestampMs: number;
};

function timestampToMilliseconds(value: string): number {
  const timestampMs = Date.parse(value);
  if (Number.isNaN(timestampMs)) {
    throw new Error(`Data de evidência inválida: ${value}`);
  }
  return timestampMs;
}

function compareTimedRecords(a: TimedRecord, b: TimedRecord): number {
  const byTimestamp = a.timestampMs - b.timestampMs;
  return byTimestamp !== 0 ? byTimestamp : a.id.localeCompare(b.id);
}

/**
 * Associa cada evidência devolvida a, no máximo, uma nova evidência pendente.
 *
 * O pareamento é cronológico e guloso: a devolutiva mais antiga recebe a
 * primeira evidência ainda não utilizada que tenha sido enviada depois dela.
 * Dessa forma, uma única substituição nunca resolve duas devolutivas da mesma
 * pergunta e evidências antigas não são reaproveitadas como correção.
 */
export function summarizeEvidenceAdjustmentResolution(
  evidences: readonly EvidenceAdjustmentRecord[],
): EvidenceAdjustmentResolution {
  const requests: TimedRecord[] = evidences
    .filter((evidence) => evidence.validationStatus === "adjustment_requested")
    .map((evidence) => ({
      id: evidence.id,
      timestampMs: timestampToMilliseconds(
        evidence.validatedAt ?? evidence.submittedAt,
      ),
    }))
    .sort(compareTimedRecords);

  const replacements: TimedRecord[] = evidences
    .filter((evidence) => evidence.validationStatus === "pending")
    .map((evidence) => ({
      id: evidence.id,
      timestampMs: timestampToMilliseconds(evidence.submittedAt),
    }))
    .sort(compareTimedRecords);

  let replacementIndex = 0;
  let resolvedCount = 0;

  for (const request of requests) {
    while (
      replacementIndex < replacements.length &&
      replacements[replacementIndex]!.timestampMs <= request.timestampMs
    ) {
      replacementIndex += 1;
    }

    if (replacementIndex >= replacements.length) break;

    resolvedCount += 1;
    replacementIndex += 1;
  }

  const requestedCount = requests.length;
  const unresolvedCount = Math.max(0, requestedCount - resolvedCount);

  return {
    requestedCount,
    resolvedCount,
    unresolvedCount,
    hasAdjustmentRequest: requestedCount > 0,
    hasResolvedAllAdjustments: requestedCount > 0 && unresolvedCount === 0,
  };
}
