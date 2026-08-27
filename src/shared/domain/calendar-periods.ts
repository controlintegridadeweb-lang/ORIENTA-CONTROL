export const PLATFORM_CIVIL_OFFSET = "-03:00" as const;

export const BIMESTERS = [1, 2, 3, 4, 5, 6] as const;
export type Bimester = (typeof BIMESTERS)[number];

export const QUADRIMESTERS = [1, 2, 3] as const;
export type Quadrimester = (typeof QUADRIMESTERS)[number];

const BIMESTER_SHORT_LABELS: Record<Bimester, string> = {
  1: "Jan–Fev",
  2: "Mar–Abr",
  3: "Mai–Jun",
  4: "Jul–Ago",
  5: "Set–Out",
  6: "Nov–Dez",
};

function assertReferenceYear(referenceYear: number): void {
  if (!Number.isInteger(referenceYear) || referenceYear < 1900 || referenceYear > 2100) {
    throw new Error("invalid_preliminary_reference_year");
  }
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function lastInstantOf(isoDay: string): Date {
  return new Date(`${isoDay}T23:59:59.999${PLATFORM_CIVIL_OFFSET}`);
}

function firstInstantOf(isoDay: string): Date {
  return new Date(`${isoDay}T00:00:00.000${PLATFORM_CIVIL_OFFSET}`);
}

/** Bimestre 2, 4 e 6 fecham o 1º, 2º e 3º quadrimestre, nesta ordem. */
export function quadrimesterClosedByBimester(bimester: Bimester): Quadrimester | null {
  if (bimester === 2) return 1;
  if (bimester === 4) return 2;
  if (bimester === 6) return 3;
  return null;
}

export function bimesterClosesQuadrimester(bimester: Bimester): boolean {
  return quadrimesterClosedByBimester(bimester) != null;
}

export function bimestersOfQuadrimester(quadrimester: Quadrimester): readonly [Bimester, Bimester] {
  const first = ((quadrimester - 1) * 2 + 1) as Bimester;
  const second = ((quadrimester - 1) * 2 + 2) as Bimester;
  return [first, second];
}

/** Bimestres 1–2 → Q1, 3–4 → Q2, 5–6 → Q3. */
export function quadrimesterContainingBimester(bimester: Bimester): Quadrimester {
  if (!BIMESTERS.includes(bimester)) {
    throw new Error("invalid_bimester");
  }
  return Math.ceil(bimester / 2) as Quadrimester;
}

export function bimesterPeriod(
  referenceYear: number,
  bimester: Bimester,
): {
  start: string;
  end: string;
  label: string;
  shortLabel: string;
  closesQuadrimester: boolean;
  quadrimester: Quadrimester | null;
} {
  assertReferenceYear(referenceYear);
  if (!BIMESTERS.includes(bimester)) {
    throw new Error("invalid_bimester");
  }
  const startMonth = (bimester - 1) * 2 + 1;
  const endMonth = startMonth + 1;
  const start = isoDate(referenceYear, startMonth, 1);
  const end = isoDate(referenceYear, endMonth, lastDayOfMonth(referenceYear, endMonth));
  const quadrimester = quadrimesterClosedByBimester(bimester);
  return {
    start,
    end,
    label: `${bimester}º bimestre`,
    shortLabel: BIMESTER_SHORT_LABELS[bimester],
    closesQuadrimester: quadrimester != null,
    quadrimester,
  };
}

export function quadrimesterPeriod(
  referenceYear: number,
  quadrimester: Quadrimester,
): {
  start: string;
  end: string;
  label: string;
} {
  assertReferenceYear(referenceYear);
  const ranges = {
    1: [`${referenceYear}-01-01`, `${referenceYear}-04-30`, "1º quadrimestre"],
    2: [`${referenceYear}-05-01`, `${referenceYear}-08-31`, "2º quadrimestre"],
    3: [`${referenceYear}-09-01`, `${referenceYear}-12-31`, "3º quadrimestre"],
  } as const;
  const [start, end, label] = ranges[quadrimester];
  return { start, end, label };
}

export function periodLastInstant(periodEnd: string): Date {
  return lastInstantOf(periodEnd);
}

export function periodCutoffExclusive(periodEnd: string): Date {
  return new Date(lastInstantOf(periodEnd).getTime() + 1);
}

export function bimesterLastInstant(referenceYear: number, bimester: Bimester): Date {
  return lastInstantOf(bimesterPeriod(referenceYear, bimester).end);
}

export function bimesterCutoffExclusive(referenceYear: number, bimester: Bimester): Date {
  return periodCutoffExclusive(bimesterPeriod(referenceYear, bimester).end);
}

export function isBimesterClosed(
  referenceYear: number,
  bimester: Bimester,
  now: Date = new Date(),
): boolean {
  return now.getTime() > bimesterLastInstant(referenceYear, bimester).getTime();
}

export function hasBimesterStarted(
  referenceYear: number,
  bimester: Bimester,
  now: Date = new Date(),
): boolean {
  const { start } = bimesterPeriod(referenceYear, bimester);
  return now.getTime() >= firstInstantOf(start).getTime();
}

export function quadrimesterLastInstant(
  referenceYear: number,
  quadrimester: Quadrimester,
): Date {
  return lastInstantOf(quadrimesterPeriod(referenceYear, quadrimester).end);
}

/** Primeiro instante após a data de corte, no horário de Fortaleza. */
export function quadrimesterCutoffExclusive(
  referenceYear: number,
  quadrimester: Quadrimester,
): Date {
  return periodCutoffExclusive(quadrimesterPeriod(referenceYear, quadrimester).end);
}

/** Disponível no dia seguinte à data de corte, no horário de Fortaleza. */
export function isQuadrimesterClosed(
  referenceYear: number,
  quadrimester: Quadrimester,
  now: Date = new Date(),
): boolean {
  return now.getTime() > quadrimesterLastInstant(referenceYear, quadrimester).getTime();
}

export function hasQuadrimesterStarted(
  referenceYear: number,
  quadrimester: Quadrimester,
  now: Date = new Date(),
): boolean {
  const { start } = quadrimesterPeriod(referenceYear, quadrimester);
  return now.getTime() >= firstInstantOf(start).getTime();
}

export function happenedAtOrBefore(
  timestamp: string | null | undefined,
  limit: Date,
): boolean {
  if (!timestamp) return false;
  const instant = new Date(timestamp);
  if (Number.isNaN(instant.getTime())) return false;
  return instant.getTime() <= limit.getTime();
}
