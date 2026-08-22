/**
 * Mapeamento explícito, determinístico e auditável:
 * coluna auxiliar do formulário legado → critério(s) oficiais (source_order 1–126).
 *
 * Não usa proximidade de colunas. Cada campo complementar de evidência, link,
 * upload, justificativa ou observação aponta para o identificador oficial do
 * critério correspondente. Campos órfãos (pergunta legada sem critério no
 * catálogo de 126) ficam apenas como metadado de auditoria.
 */

/** @typedef {'evidence' | 'auxiliary' | 'orphan_audit'} SupportingFieldRole */

/**
 * @typedef {object} SupportingColumnBinding
 * @property {readonly number[]} sourceOrders Critérios oficiais donos do campo.
 * @property {SupportingFieldRole} role
 * @property {number} [auditHomeSourceOrder] Destino só para metadado (órfãos).
 */

/** @type {Readonly<Record<number, SupportingColumnBinding>>} */
export const SUPPORTING_COLUMN_BINDINGS = Object.freeze({
  9: Object.freeze({ sourceOrders: Object.freeze([1]), role: "auxiliary" }),
  11: Object.freeze({ sourceOrders: Object.freeze([1]), role: "evidence" }),
  12: Object.freeze({ sourceOrders: Object.freeze([2]), role: "evidence" }),
  15: Object.freeze({ sourceOrders: Object.freeze([3]), role: "evidence" }),
  16: Object.freeze({ sourceOrders: Object.freeze([4]), role: "evidence" }),
  18: Object.freeze({ sourceOrders: Object.freeze([5]), role: "evidence" }),
  20: Object.freeze({ sourceOrders: Object.freeze([6]), role: "evidence" }),
  21: Object.freeze({ sourceOrders: Object.freeze([6]), role: "auxiliary" }),
  25: Object.freeze({ sourceOrders: Object.freeze([9]), role: "evidence" }),
  28: Object.freeze({ sourceOrders: Object.freeze([11]), role: "evidence" }),
  30: Object.freeze({ sourceOrders: Object.freeze([12]), role: "evidence" }),
  34: Object.freeze({ sourceOrders: Object.freeze([15]), role: "evidence" }),
  37: Object.freeze({ sourceOrders: Object.freeze([16]), role: "evidence" }),
  39: Object.freeze({ sourceOrders: Object.freeze([18]), role: "evidence" }),
  42: Object.freeze({ sourceOrders: Object.freeze([19]), role: "evidence" }),
  46: Object.freeze({ sourceOrders: Object.freeze([23]), role: "evidence" }),
  49: Object.freeze({ sourceOrders: Object.freeze([25]), role: "evidence" }),
  51: Object.freeze({ sourceOrders: Object.freeze([26]), role: "evidence" }),
  56: Object.freeze({ sourceOrders: Object.freeze([30]), role: "evidence" }),
  60: Object.freeze({ sourceOrders: Object.freeze([33]), role: "evidence" }),
  61: Object.freeze({ sourceOrders: Object.freeze([33]), role: "auxiliary" }),
  64: Object.freeze({ sourceOrders: Object.freeze([35]), role: "evidence" }),
  65: Object.freeze({ sourceOrders: Object.freeze([35]), role: "evidence" }),
  68: Object.freeze({ sourceOrders: Object.freeze([37]), role: "auxiliary" }),
  71: Object.freeze({ sourceOrders: Object.freeze([39]), role: "evidence" }),
  74: Object.freeze({ sourceOrders: Object.freeze([40, 41]), role: "evidence" }),
  76: Object.freeze({ sourceOrders: Object.freeze([42]), role: "auxiliary" }),
  78: Object.freeze({ sourceOrders: Object.freeze([43]), role: "evidence" }),
  81: Object.freeze({ sourceOrders: Object.freeze([44]), role: "evidence" }),
  83: Object.freeze({ sourceOrders: Object.freeze([46]), role: "evidence" }),
  86: Object.freeze({ sourceOrders: Object.freeze([48]), role: "evidence" }),
  92: Object.freeze({ sourceOrders: Object.freeze([51]), role: "evidence" }),
  93: Object.freeze({ sourceOrders: Object.freeze([53]), role: "evidence" }),
  98: Object.freeze({ sourceOrders: Object.freeze([56]), role: "auxiliary" }),
  100: Object.freeze({ sourceOrders: Object.freeze([58]), role: "evidence" }),
  101: Object.freeze({ sourceOrders: Object.freeze([58]), role: "auxiliary" }),
  104: Object.freeze({ sourceOrders: Object.freeze([60]), role: "evidence" }),
  106: Object.freeze({ sourceOrders: Object.freeze([61]), role: "evidence" }),
  107: Object.freeze({
    sourceOrders: Object.freeze([]),
    role: "orphan_audit",
    auditHomeSourceOrder: 61,
  }),
  108: Object.freeze({
    sourceOrders: Object.freeze([]),
    role: "orphan_audit",
    auditHomeSourceOrder: 61,
  }),
  111: Object.freeze({
    sourceOrders: Object.freeze([]),
    role: "orphan_audit",
    auditHomeSourceOrder: 63,
  }),
  113: Object.freeze({ sourceOrders: Object.freeze([64]), role: "evidence" }),
  117: Object.freeze({ sourceOrders: Object.freeze([67]), role: "evidence" }),
  125: Object.freeze({ sourceOrders: Object.freeze([73]), role: "evidence" }),
  133: Object.freeze({ sourceOrders: Object.freeze([81]), role: "evidence" }),
  138: Object.freeze({ sourceOrders: Object.freeze([85]), role: "evidence" }),
  142: Object.freeze({ sourceOrders: Object.freeze([88]), role: "evidence" }),
  145: Object.freeze({ sourceOrders: Object.freeze([89]), role: "evidence" }),
  150: Object.freeze({ sourceOrders: Object.freeze([93]), role: "evidence" }),
  151: Object.freeze({
    sourceOrders: Object.freeze([]),
    role: "orphan_audit",
    auditHomeSourceOrder: 95,
  }),
  153: Object.freeze({ sourceOrders: Object.freeze([95]), role: "evidence" }),
  155: Object.freeze({ sourceOrders: Object.freeze([96]), role: "evidence" }),
  158: Object.freeze({ sourceOrders: Object.freeze([97]), role: "evidence" }),
  163: Object.freeze({ sourceOrders: Object.freeze([102]), role: "evidence" }),
  167: Object.freeze({ sourceOrders: Object.freeze([105]), role: "evidence" }),
  170: Object.freeze({
    sourceOrders: Object.freeze([]),
    role: "orphan_audit",
    auditHomeSourceOrder: 108,
  }),
  172: Object.freeze({ sourceOrders: Object.freeze([108]), role: "evidence" }),
  175: Object.freeze({ sourceOrders: Object.freeze([109]), role: "evidence" }),
  176: Object.freeze({ sourceOrders: Object.freeze([110]), role: "evidence" }),
  178: Object.freeze({ sourceOrders: Object.freeze([111]), role: "evidence" }),
  181: Object.freeze({ sourceOrders: Object.freeze([112]), role: "evidence" }),
  184: Object.freeze({ sourceOrders: Object.freeze([114]), role: "auxiliary" }),
  187: Object.freeze({ sourceOrders: Object.freeze([116]), role: "auxiliary" }),
  188: Object.freeze({ sourceOrders: Object.freeze([117]), role: "evidence" }),
  191: Object.freeze({ sourceOrders: Object.freeze([118]), role: "evidence" }),
  194: Object.freeze({ sourceOrders: Object.freeze([120, 121]), role: "evidence" }),
  197: Object.freeze({ sourceOrders: Object.freeze([122, 123]), role: "evidence" }),
  200: Object.freeze({ sourceOrders: Object.freeze([124]), role: "evidence" }),
});

export const SUPPORTING_SOURCE_COLUMNS = Object.freeze(
  Object.keys(SUPPORTING_COLUMN_BINDINGS)
    .map(Number)
    .sort((a, b) => a - b),
);

export function bindingForSupportingColumn(sourceColumn) {
  const binding = SUPPORTING_COLUMN_BINDINGS[sourceColumn];
  if (!binding) {
    throw new Error(
      `Coluna auxiliar legada ${sourceColumn} sem mapeamento explícito para critério oficial.`,
    );
  }
  return binding;
}

export function targetSourceOrdersForSupportingColumn(sourceColumn) {
  const binding = bindingForSupportingColumn(sourceColumn);
  if (binding.role === "orphan_audit") {
    if (!Number.isInteger(binding.auditHomeSourceOrder)) {
      throw new Error(`Coluna órfã ${sourceColumn} sem auditHomeSourceOrder.`);
    }
    return [binding.auditHomeSourceOrder];
  }
  if (!binding.sourceOrders.length) {
    throw new Error(`Coluna ${sourceColumn} sem sourceOrders.`);
  }
  return [...binding.sourceOrders];
}

export function supportingFieldContributesEvidence(sourceColumn) {
  // Links em campos auxiliares oficiais também comprovam o critério principal.
  // Apenas órfãos (sem critério no catálogo de 126) ficam só em metadado/notas.
  return bindingForSupportingColumn(sourceColumn).role !== "orphan_audit";
}

export function classifySupportingAssignment({
  sourceColumn,
  assignedSourceOrder,
}) {
  const binding = bindingForSupportingColumn(sourceColumn);
  if (binding.role === "orphan_audit") {
    if (assignedSourceOrder === binding.auditHomeSourceOrder) {
      return "associacao_ambigua";
    }
    return "evidencia_vinculada_ao_criterio_errado";
  }
  if (binding.sourceOrders.includes(assignedSourceOrder)) {
    return "associacao_correta";
  }
  return "evidencia_vinculada_ao_criterio_errado";
}
