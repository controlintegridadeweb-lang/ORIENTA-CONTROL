export type AxisMaturity = {
  /** Identificador do eixo estrutural (`axes.id`), quando disponível. */
  axisId?: string;
  axisName: string;
  percentage: number;
  maturityLevel: number | null;
};
