export type CriterionEvolutionStatus = "nao_iniciado" | "em_andamento" | "concluido";

export type CriterionEvolutionRow = {
  questionVersionId: string;
  questionPrompt: string;
  previousStatus: CriterionEvolutionStatus;
  currentStatus: CriterionEvolutionStatus;
  recoveredPoints: number;
};

export type QuadrimesterEvolution = {
  officialPercentage: number | null;
  previousPreliminaryPercentage: number | null;
  currentPreliminaryPercentage: number | null;
  deltaPercentagePoints: number | null;
  criteriaNowScoring: number;
  recoveredPoints: number;
  rows: CriterionEvolutionRow[];
};

function statusOf(input: {
  criterionCompleted: boolean | null;
  activeActionCount: number;
  recoveredPoints: number;
}): CriterionEvolutionStatus {
  if (input.criterionCompleted) return "concluido";
  if (input.activeActionCount > 0 || input.recoveredPoints > 0) return "em_andamento";
  return "nao_iniciado";
}

export function buildQuadrimesterEvolution(input: {
  officialPercentage: number | null;
  previousPreliminaryPercentage: number | null;
  currentPreliminaryPercentage: number | null;
  previous: Array<{
    questionVersionId: string;
    questionPrompt?: string;
    criterionCompleted: boolean | null;
    activeActionCount: number;
    recoveredPoints: number;
    preliminaryPoints: number;
    officialPoints: number;
  }>;
  current: Array<{
    questionVersionId: string;
    questionPrompt?: string;
    criterionCompleted: boolean | null;
    activeActionCount: number;
    recoveredPoints: number;
    preliminaryPoints: number;
    officialPoints: number;
  }>;
}): QuadrimesterEvolution {
  const previousById = new Map(input.previous.map((row) => [row.questionVersionId, row]));
  const rows: CriterionEvolutionRow[] = input.current.map((row) => {
    const previous = previousById.get(row.questionVersionId);
    const recoveredPoints = Math.max(
      0,
      round2(row.recoveredPoints - (previous?.recoveredPoints ?? 0)),
    );
    return {
      questionVersionId: row.questionVersionId,
      questionPrompt: row.questionPrompt ?? previous?.questionPrompt ?? row.questionVersionId,
      previousStatus: previous
        ? statusOf(previous)
        : statusOf({ criterionCompleted: false, activeActionCount: 0, recoveredPoints: 0 }),
      currentStatus: statusOf(row),
      recoveredPoints,
    };
  });
  const criteriaNowScoring = rows.filter(
    (row) => row.currentStatus === "concluido" && row.previousStatus !== "concluido",
  ).length;
  const recoveredPoints = round2(rows.reduce((sum, row) => sum + row.recoveredPoints, 0));
  const deltaPercentagePoints =
    input.currentPreliminaryPercentage != null && input.previousPreliminaryPercentage != null
      ? round2(input.currentPreliminaryPercentage - input.previousPreliminaryPercentage)
      : input.currentPreliminaryPercentage != null && input.officialPercentage != null
        ? round2(input.currentPreliminaryPercentage - input.officialPercentage)
        : null;
  return {
    officialPercentage: input.officialPercentage,
    previousPreliminaryPercentage: input.previousPreliminaryPercentage,
    currentPreliminaryPercentage: input.currentPreliminaryPercentage,
    deltaPercentagePoints,
    criteriaNowScoring,
    recoveredPoints,
    rows: rows.filter(
      (row) => row.recoveredPoints > 0 || row.currentStatus !== row.previousStatus,
    ),
  };
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function criterionEvolutionLabel(status: CriterionEvolutionStatus): string {
  if (status === "concluido") return "Concluído";
  if (status === "em_andamento") return "Em andamento";
  return "Não iniciado";
}
