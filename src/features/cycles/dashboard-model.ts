import type { CycleState } from "@/shared/domain/types";
import { ADMIN_CYCLE_STATE_LABEL } from "@/shared/domain/cycle-labels";
import type { CycleListItem } from "@/features/cycles/cycle-queries";
import { isRespondentEditable } from "@/shared/domain/workflow";

/**
 * Lógica pura do Dashboard de ciclos por estado (seção 8 — admin).
 *
 * Agrupa os ciclos pelos 7 estados da máquina e os organiza nas macro-fases que
 * o domínio já reconhece (types.ts): construção, resposta, validação,
 * acompanhamento, encerrado. Sem I/O e sem React — testável isoladamente.
 */

export type CyclePhase =
  | "construcao"
  | "resposta"
  | "validacao"
  | "acompanhamento"
  | "encerrado";

/** Rótulos em pt-BR para cada estado (vocabulário da interface, não do sistema). */
export const STATE_LABEL = ADMIN_CYCLE_STATE_LABEL;

/** Cada estado pertence a uma macro-fase. */
const STATE_PHASE: Record<CycleState, CyclePhase> = {
  draft: "construcao",
  in_response: "resposta",
  submitted: "validacao",
  awaiting_adjustment: "resposta",
  in_validation: "validacao",
  validated: "acompanhamento",
  completed: "encerrado",
};

export const PHASE_LABEL: Record<CyclePhase, string> = {
  construcao: "Construção",
  resposta: "Resposta",
  validacao: "Validação",
  acompanhamento: "Acompanhamento",
  encerrado: "Avaliação encerrada",
};

/**
 * Ordem de exibição das colunas por responsabilidade operacional.
 * `awaiting_adjustment` fica junto da resposta porque, após o reenvio,
 * o diagnóstico retorna para `in_validation` em vez de avançar diretamente.
 */
export const STATE_ORDER: CycleState[] = [
  "draft",
  "in_response",
  "awaiting_adjustment",
  "submitted",
  "in_validation",
  "validated",
  "completed",
];

export type DueFilter = "all" | "overdue" | "in_response";
export type CollectionFilter = "all" | "active" | "suspended";

/** Filtra a condição da coleta sem alterar o estado técnico do diagnóstico. */
export function filterByCollectionStatus(
  cycles: CycleListItem[],
  filter: CollectionFilter,
): CycleListItem[] {
  if (filter === "all") return cycles;
  const suspended = filter === "suspended";
  return cycles.filter(
    (cycle) => Boolean(cycle.responseCollectionPausedAt) === suspended,
  );
}

export type DashboardCycleFilters = {
  search?: string;
  organizationId?: string;
  state?: CycleState | "";
  dueFilter: DueFilter;
  collectionFilter: CollectionFilter;
};

/** Aplica os filtros visuais sobre o conjunto já vinculado ao formulário. */
export function filterDashboardCycles(
  cycles: CycleListItem[],
  filters: DashboardCycleFilters,
  now: Date = new Date(),
): CycleListItem[] {
  let filtered = cycles;

  if (filters.organizationId) {
    filtered = filtered.filter(
      (cycle) => cycle.organizationId === filters.organizationId,
    );
  }

  const search = filters.search?.trim().toLocaleLowerCase("pt-BR") ?? "";
  if (search) {
    filtered = filtered.filter(
      (cycle) =>
        cycle.organizationName.toLocaleLowerCase("pt-BR").includes(search) ||
        cycle.organizationAcronym.toLocaleLowerCase("pt-BR").includes(search),
    );
  }

  if (filters.state) {
    filtered = filtered.filter((cycle) => cycle.state === filters.state);
  }

  filtered = filterByCollectionStatus(filtered, filters.collectionFilter);

  if (filters.dueFilter === "overdue") {
    return filtered.filter((cycle) => isResponseDeadlineOverdue(cycle, now));
  }
  if (filters.dueFilter === "in_response") {
    return filtered.filter(
      (cycle) =>
        !cycle.responseCollectionPausedAt &&
        isRespondentEditable(cycle.state),
    );
  }
  return filtered;
}

export type StateGroup = {
  state: CycleState;
  label: string;
  phase: CyclePhase;
  cycles: CycleListItem[];
  count: number;
};

/**
 * Ordem dentro da coluna: prazo vencido primeiro, depois prazo mais próximo,
 * período e nome da organização — para o crítico aparecer sem varrer a lista.
 */
export function sortCyclesInColumn(
  cycles: CycleListItem[],
  now: Date = new Date(),
): CycleListItem[] {
  return [...cycles].sort((a, b) => {
    const aOverdue = isResponseDeadlineOverdue(a, now) ? 0 : 1;
    const bOverdue = isResponseDeadlineOverdue(b, now) ? 0 : 1;
    if (aOverdue !== bOverdue) return aOverdue - bOverdue;

    const aDeadline = a.responseDeadlineAt
      ? new Date(a.responseDeadlineAt).getTime()
      : Number.POSITIVE_INFINITY;
    const bDeadline = b.responseDeadlineAt
      ? new Date(b.responseDeadlineAt).getTime()
      : Number.POSITIVE_INFINITY;
    if (aDeadline !== bDeadline) return aDeadline - bDeadline;

    const period = a.periodLabel.localeCompare(b.periodLabel, "pt-BR");
    if (period !== 0) return period;

    return a.organizationName.localeCompare(b.organizationName, "pt-BR");
  });
}

/**
 * Agrupa os ciclos por estado, na ordem do fluxo. Estados sem ciclos também
 * aparecem (coluna vazia) — o admin precisa ver que a etapa existe e está vazia.
 */
export function groupByState(
  cycles: CycleListItem[],
  now: Date = new Date(),
): StateGroup[] {
  const byState = new Map<CycleState, CycleListItem[]>();
  for (const state of STATE_ORDER) byState.set(state, []);
  for (const cycle of cycles) {
    const bucket = byState.get(cycle.state);
    if (bucket) bucket.push(cycle);
  }
  return STATE_ORDER.map((state) => {
    const list = sortCyclesInColumn(byState.get(state) ?? [], now);
    return {
      state,
      label: STATE_LABEL[state],
      phase: STATE_PHASE[state],
      cycles: list,
      count: list.length,
    };
  });
}


/**
 * O prazo de resposta só está vencido enquanto a organização ainda pode agir.
 * `submitted` não entra: após o envio, a próxima ação pertence à administração.
 */
export function isResponseDeadlineOverdue(
  cycle: Pick<
    CycleListItem,
    "state" | "responseDeadlineAt" | "responseCollectionPausedAt"
  >,
  now: Date = new Date(),
): boolean {
  if (cycle.responseCollectionPausedAt) return false;
  return Boolean(
    isRespondentEditable(cycle.state) &&
      cycle.responseDeadlineAt !== null &&
      new Date(cycle.responseDeadlineAt) < now,
  );
}

export type DashboardSummary = {
  total: number;
  byPhase: Record<CyclePhase, number>;
  /** Ciclos cujo prazo passou e ainda aguardam ação do respondente. */
  overdue: number;
  /** Ciclos que já foram reabertos ao menos uma vez. */
  reopened: number;
};

/**
 * Resumo de topo do dashboard. `overdue` cruza o prazo com a responsabilidade:
 * só conta atraso enquanto o respondente ainda pode editar e reenviar.
 */
export function summarize(
  cycles: CycleListItem[],
  now: Date = new Date(),
): DashboardSummary {
  const byPhase: Record<CyclePhase, number> = {
    construcao: 0,
    resposta: 0,
    validacao: 0,
    acompanhamento: 0,
    encerrado: 0,
  };
  let overdue = 0;
  let reopened = 0;

  for (const cycle of cycles) {
    byPhase[STATE_PHASE[cycle.state]] += 1;
    if (cycle.reopenCount > 0) reopened += 1;

    if (isResponseDeadlineOverdue(cycle, now)) overdue += 1;
  }

  return { total: cycles.length, byPhase, overdue, reopened };
}

/**
 * Para um formulário, mantém um único ciclo por órgão: o período mais recente.
 * Evita misturar histórico de períodos/versões diferentes na mesma coluna.
 */
export function selectLatestCyclePerOrganization(
  cycles: CycleListItem[],
): CycleListItem[] {
  const byOrg = new Map<string, CycleListItem>();

  for (const cycle of cycles) {
    const current = byOrg.get(cycle.organizationId);
    if (!current || compareCycleRecency(cycle, current) > 0) {
      byOrg.set(cycle.organizationId, cycle);
    }
  }

  return [...byOrg.values()];
}

/** Positivo se `a` for mais recente que `b` (período, depois abertura). */
function compareCycleRecency(a: CycleListItem, b: CycleListItem): number {
  const period = b.periodLabel.localeCompare(a.periodLabel, "pt-BR");
  if (period !== 0) return -period;

  const aStart = a.startsAt ? new Date(a.startsAt).getTime() : 0;
  const bStart = b.startsAt ? new Date(b.startsAt).getTime() : 0;
  if (aStart !== bStart) return aStart - bStart;

  return a.id.localeCompare(b.id);
}
