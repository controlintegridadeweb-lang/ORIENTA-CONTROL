import type { LucideIcon } from "lucide-react";
import {
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import type { AxisMaturity } from "@/features/fami/types";
import type { FamiEvolutionPoint, FamiEvolutionYearPoint, FamiSnapshot } from "@/features/fami/queries";
import {
  FAMI_MATURITY_LEVEL_REGISTRY,
  type FamiMaturityLevel,
} from "@/shared/ui/status-registry";
import { maturityLevelVariant } from "@/features/fami/maturity-level-variants";
import { CURRENT_FAMI_POLICY, levelForPercentage } from "@/shared/domain/fami-policy";

/**
 * Camada de apresentacao do FAMI para o painel do Respondente.
 *
 * Centraliza o vocabulario dos 5 niveis (label, descrição, cor e ícone),
 * regras de classificacao por percentual, interpretacao automatica do snapshot
 * (pontos fortes, críticos e eixos prioritários) para subsidiar uma leitura
 * executiva. O resultado FAMI é histórico: ações concluídas só podem refletir
 * melhoria em um diagnóstico posterior.
 *
 * Nenhuma chamada a banco; apenas pure functions a partir do que ja vem da
 * rota `/api/fami/snapshot`.
 */

// ---------------------------------------------------------------- NIVEIS

export type FamiLevel = 1 | 2 | 3 | 4 | 5;

export type LevelMeta = {
  level: FamiLevel;
  label: string;
  shortLabel: string;
  description: string;
  range: string;
  /** Limite superior inclusivo do nivel (em %). */
  upperBound: number;
  icon: LucideIcon;
  badgeClasses: string;
  ringColor: string;
  textColor: string;
  iconBg: string;
  iconColor: string;
};

const LEVEL_RANGE: Record<FamiLevel, Pick<LevelMeta, "range" | "upperBound">> = {
  1: { range: "0% a 20%", upperBound: 20 },
  2: { range: "Acima de 20% até 40%", upperBound: 40 },
  3: { range: "Acima de 40% até 60%", upperBound: 60 },
  4: { range: "Acima de 60% até 80%", upperBound: 80 },
  5: { range: "Acima de 80% até 100%", upperBound: 100 },
};

function buildLevelMeta(level: FamiLevel): LevelMeta {
  const reg = FAMI_MATURITY_LEVEL_REGISTRY[level as FamiMaturityLevel];
  const range = LEVEL_RANGE[level];
  const tone = maturityLevelVariant(level);
  const shortLabel =
    reg.label.includes("·") && reg.label.includes("Nível")
      ? reg.label.split("·").pop()!.trim()
      : reg.label;
  return {
    level,
    label: reg.label,
    shortLabel,
    description: reg.description ?? "",
    range: range.range,
    upperBound: range.upperBound,
    icon: reg.icon!,
    badgeClasses: tone.badge,
    ringColor: tone.ring,
    textColor: tone.text,
    iconBg: tone.iconBg,
    iconColor: tone.iconColor,
  };
}

export const LEVEL_META: Record<FamiLevel, LevelMeta> = {
  1: buildLevelMeta(1),
  2: buildLevelMeta(2),
  3: buildLevelMeta(3),
  4: buildLevelMeta(4),
  5: buildLevelMeta(5),
};

export function levelFromPercentage(percentage: number): FamiLevel {
  return levelForPercentage(percentage, CURRENT_FAMI_POLICY);
}

export function levelMeta(level: number): LevelMeta {
  if (level === 1 || level === 2 || level === 3 || level === 4 || level === 5) {
    return LEVEL_META[level];
  }
  throw new Error(`invalid_fami_maturity_level: ${level}`);
}

// ---------------------------------------------------------------- META / GAP

export type LevelGoal = {
  current: FamiLevel;
  next: FamiLevel | null;
  /** Percentual necessario para atingir o proximo nivel. */
  threshold: number;
  /** Pontos percentuais que faltam. */
  gap: number;
  /** Mensagem curta para badge/texto. */
  message: string;
};

export function levelGoal(percentage: number): LevelGoal {
  const current = levelFromPercentage(percentage);
  if (current === 5) {
    return {
      current,
      next: null,
      threshold: 100,
      gap: 0,
      message: "Nível máximo atingido — mantenha as práticas e revise evidências.",
    };
  }
  const meta = LEVEL_META[current];
  const threshold = meta.upperBound + 0.01;
  const gap = Math.max(0, Math.round((threshold - percentage) * 100) / 100);
  const next = (current + 1) as FamiLevel;
  const nextMeta = LEVEL_META[next];
  return {
    current,
    next,
    threshold,
    gap,
    message:
      gap > 0
        ? `Para atingir ${nextMeta.shortLabel} (Nível ${next}) em um próximo diagnóstico, o resultado precisa superar ${meta.upperBound.toFixed(0)}%.`
        : `Um próximo diagnóstico poderá refletir a evolução das práticas para o Nível ${next}.`,
  };
}

// ---------------------------------------------------------------- PRIORIDADE POR EIXO

export type AxisPriorityRow = {
  axisId: string | null;
  axisName: string;
  percentage: number;
  level: FamiLevel;
  isCritical: boolean;
  isAdvanced: boolean;
};

/**
 * Ordena os eixos pelo menor resultado atual. É uma priorização de leitura,
 * não uma estimativa de ganho nem uma projeção do FAMI histórico.
 */
export function rankAxesByPriority(axes: AxisMaturity[]): AxisPriorityRow[] {
  return axes
    .filter((axis) => axis.maturityLevel != null)
    .map((axis) => {
      const percentage = Math.max(0, Math.min(100, axis.percentage));
      return {
        axisId: axis.axisId ?? null,
        axisName: axis.axisName,
        percentage,
        level: levelFromPercentage(percentage),
        isCritical: percentage < 50,
        isAdvanced: percentage >= 75,
      };
    })
    .sort((left, right) => left.percentage - right.percentage || left.axisName.localeCompare(right.axisName, "pt-BR"));
}

// ---------------------------------------------------------------- DELTA EVOLUÇÃO

export type EvolutionDelta = {
  currentPercentage: number | null;
  previousPercentage: number | null;
  /** Pontos percentuais ganhos desde o ciclo anterior (positivo bom). */
  delta: number | null;
  /** Crescimento percentual relativo. */
  growth: number | null;
  trend: "up" | "down" | "flat" | "unknown";
  /** Pontuacao das ultimas N versoes (para mini-sparkline). */
  sparkline: number[];
};

export function evolutionDelta(points: FamiEvolutionPoint[]): EvolutionDelta {
  if (points.length === 0) {
    return {
      currentPercentage: null,
      previousPercentage: null,
      delta: null,
      growth: null,
      trend: "unknown",
      sparkline: [],
    };
  }
  const sorted = [...points].sort(
    (a, b) => a.processingVersion - b.processingVersion,
  );
  const current = sorted[sorted.length - 1]?.globalPercentage ?? null;
  const previous = sorted.length >= 2 ? sorted[sorted.length - 2]?.globalPercentage ?? null : null;
  const delta = current != null && previous != null
    ? Math.round((current - previous) * 10) / 10
    : null;
  const growth =
    current != null && previous != null && previous !== 0
      ? Math.round(((current - previous) / previous) * 1000) / 10
      : null;
  let trend: EvolutionDelta["trend"] = "unknown";
  if (delta != null) {
    if (delta > 0.5) trend = "up";
    else if (delta < -0.5) trend = "down";
    else trend = "flat";
  }
  const sparkline = sorted
    .filter((p) => typeof p.globalPercentage === "number")
    .slice(-5)
    .map((p) => p.globalPercentage as number);
  return { currentPercentage: current, previousPercentage: previous, delta, growth, trend, sparkline };
}

export function evolutionDeltaByYear(points: FamiEvolutionYearPoint[]): EvolutionDelta {
  if (points.length === 0) {
    return {
      currentPercentage: null,
      previousPercentage: null,
      delta: null,
      growth: null,
      trend: "unknown",
      sparkline: [],
    };
  }
  const sorted = [...points].sort((a, b) => a.year - b.year);
  const current = sorted[sorted.length - 1]?.globalPercentage ?? null;
  const previous = sorted.length >= 2 ? sorted[sorted.length - 2]?.globalPercentage ?? null : null;
  const delta =
    current != null && previous != null ? Math.round((current - previous) * 10) / 10 : null;
  const growth =
    current != null && previous != null && previous !== 0
      ? Math.round(((current - previous) / previous) * 1000) / 10
      : null;
  let trend: EvolutionDelta["trend"] = "unknown";
  if (delta != null) {
    if (delta > 0.5) trend = "up";
    else if (delta < -0.5) trend = "down";
    else trend = "flat";
  }
  const sparkline = sorted
    .filter((p) => typeof p.globalPercentage === "number")
    .slice(-5)
    .map((p) => p.globalPercentage as number);
  return { currentPercentage: current, previousPercentage: previous, delta, growth, trend, sparkline };
}

export const TREND_META: Record<EvolutionDelta["trend"], {
  label: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}> = {
  up: {
    label: "Evolução positiva",
    icon: TrendingUp,
    color: "text-emerald-700",
    bg: "bg-emerald-50",
  },
  down: {
    label: "Queda de maturidade",
    icon: TrendingDown,
    color: "text-rose-700",
    bg: "bg-rose-50",
  },
  flat: {
    label: "Estável desde o último diagnóstico",
    icon: TrendingUp,
    color: "text-slate-600",
    bg: "bg-slate-50",
  },
  unknown: {
    label: "Sem histórico para comparar",
    icon: TrendingUp,
    color: "text-slate-500",
    bg: "bg-slate-50",
  },
};

// ---------------------------------------------------------------- INSIGHTS

export type FamiInsightCard = {
  id: string;
  kind: "strength" | "weakness" | "opportunity" | "risk" | "neutral";
  title: string;
  description: string;
  /** Quando o cartão aponta um eixo específico (CTA / filtros). */
  axisId?: string | null;
  axisName?: string;
};

export function interpretSnapshot(snapshot: FamiSnapshot | null): {
  summary: string;
  cards: FamiInsightCard[];
  topAxis: AxisPriorityRow | null;
  bottomAxis: AxisPriorityRow | null;
  criticalAxes: AxisPriorityRow[];
  advancedAxes: AxisPriorityRow[];
} {
  if (!snapshot || !snapshot.global) {
    return {
      summary:
        "Ainda não há um processamento FAMI disponível para este formulário e organização.",
      cards: [],
      topAxis: null,
      bottomAxis: null,
      criticalAxes: [],
      advancedAxes: [],
    };
  }
  if (snapshot.global.maturityLevel == null) {
    return {
      summary:
        "O diagnóstico não possui critérios aplicáveis ao FAMI neste escopo. O resultado oficial é N/A e não representa desempenho zero.",
      cards: [
        {
          id: "not-applicable",
          kind: "neutral",
          title: "Resultado não aplicável",
          description:
            "Todos os critérios FAMI deste escopo foram dispensados, declarados não aplicáveis ou não pertencem ao respondente. Não há eixos para priorizar.",
        },
      ],
      topAxis: null,
      bottomAxis: null,
      criticalAxes: [],
      advancedAxes: [],
    };
  }

  const ranked = rankAxesByPriority(snapshot.axes);
  const byPercentageDesc = [...ranked].sort((a, b) => b.percentage - a.percentage);
  const topAxis = byPercentageDesc[0] ?? null;
  const bottomAxis = byPercentageDesc[byPercentageDesc.length - 1] ?? null;
  const criticalAxes = ranked.filter((r) => r.isCritical);
  const advancedAxes = ranked.filter((r) => r.isAdvanced);

  // Summary não ecoa %/nível (banner) nem eixos forte/fraco (cards/CTA).
  const goal = levelGoal(snapshot.global.percentage);
  const summary = goal.message;

  const cards: FamiInsightCard[] = [];
  const priorityAxis = ranked[0] ?? null;

  if (topAxis) {
    cards.push({
      id: "strength",
      kind: "strength",
      title: topAxis.axisName,
      description: `Melhor desempenho neste diagnóstico (${topAxis.percentage.toFixed(1)}%, ${LEVEL_META[topAxis.level].shortLabel}). Mantenha as práticas e evidências.`,
      axisId: topAxis.axisId,
      axisName: topAxis.axisName,
    });
  }
  // Um único cartão de prioridade (evita “ponto crítico” + “prioridade” no mesmo eixo).
  // Ação (“tratar recomendações”) fica só no CTA da UI — descrição é leitura factual.
  if (priorityAxis && priorityAxis !== topAxis) {
    cards.push({
      id: "priority",
      kind: "opportunity",
      title: priorityAxis.axisName,
      description: `Menor desempenho neste diagnóstico (${priorityAxis.percentage.toFixed(1)}%, ${LEVEL_META[priorityAxis.level].shortLabel}).`,
      axisId: priorityAxis.axisId,
      axisName: priorityAxis.axisName,
    });
  }
  if (criticalAxes.length >= 2) {
    cards.push({
      id: "risk",
      kind: "risk",
      title: "Risco institucional",
      description: `Há ${criticalAxes.length} eixos abaixo de 50%. A consolidação desses eixos é prioridade no próximo diagnóstico.`,
    });
  }
  if (advancedAxes.length === ranked.length && ranked.length > 0) {
    cards.push({
      id: "all-advanced",
      kind: "strength",
      title: "Todos os eixos em estágio avançado",
      description:
        "Todos os eixos estão em 75% ou mais. Avalie consolidar a maturidade para Nível 5.",
    });
  }
  if (cards.length === 0) {
    cards.push({
      id: "neutral",
      kind: "neutral",
      title: "Ainda há poucos dados para interpretar",
      description:
        "O processamento concluído ainda não possui eixos suficientes para uma comparação detalhada. Consulte o relatório oficial e as recomendações disponíveis.",
    });
  }

  return { summary, cards, topAxis, bottomAxis, criticalAxes, advancedAxes };
}
