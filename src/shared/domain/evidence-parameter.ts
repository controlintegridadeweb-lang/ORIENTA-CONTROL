/** Parâmetro de evidência do critério. */
export type EvidenceParameter = {
  required: boolean;
};

const DEFAULT_EVIDENCE_PARAMETER: EvidenceParameter = { required: false };

export function parseEvidenceParameter(raw: unknown): EvidenceParameter | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return null;
  }

  const value = raw as Record<string, unknown>;
  if (typeof value.required !== "boolean") {
    return null;
  }

  return { required: value.required };
}

function evidenceParameterFromRequired(required: boolean): EvidenceParameter {
  return { required: Boolean(required) };
}

export type EvidenceRequirementSource = {
  evidence_parameter?: unknown;
};

/** Fonte única da exigência de evidência. */
export function isEvidenceRequired(source: EvidenceRequirementSource): boolean {
  return parseEvidenceParameter(source.evidence_parameter)?.required ?? DEFAULT_EVIDENCE_PARAMETER.required;
}

export function evidenceParameterPayload(required: boolean): { evidence_parameter: EvidenceParameter } {
  return { evidence_parameter: evidenceParameterFromRequired(required) };
}
