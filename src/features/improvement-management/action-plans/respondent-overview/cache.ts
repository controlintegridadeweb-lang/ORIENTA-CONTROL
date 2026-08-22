"use client";

import { listRespondentActionPlans } from "@/features/improvement-management/action-plans/client";
import type { ActionPlanListItem } from "@/features/improvement-management/action-plans/types";

type CacheEntry = {
  items: ActionPlanListItem[];
  fetchedAt: number;
  promise: Promise<ActionPlanListItem[]> | null;
};

const CACHE_TTL_MS = 30_000;
const OVERVIEW_PAGE_SIZE = 200;
let cache: CacheEntry = { items: [], fetchedAt: 0, promise: null };
const listeners = new Set<() => void>();
let cacheVersion = 0;
let requestVersion = 0;

export function getRespondentOverviewCacheVersion(): number {
  return cacheVersion;
}

function notifyListeners() {
  cacheVersion += 1;
  for (const listener of listeners) {
    listener();
  }
}

async function fetchOverviewItems(): Promise<ActionPlanListItem[]> {
  const items: ActionPlanListItem[] = [];
  let offset = 0;

  while (true) {
    const page = await listRespondentActionPlans({
      view: "overview",
      limit: OVERVIEW_PAGE_SIZE,
      offset,
    });
    items.push(...(page.items as ActionPlanListItem[]));
    offset += page.items.length;

    if (page.items.length === 0 || offset >= page.total) break;
  }

  return items;
}

/**
 * Cache em memória do overview do respondente (`action-plans?view=overview`).
 * Compartilhado entre portfólio, plano de ação e boot do FAMI.
 */
export async function getRespondentOverviewItems(
  options?: { force?: boolean },
): Promise<ActionPlanListItem[]> {
  const force = options?.force ?? false;
  const now = Date.now();
  // Lista vazia também é resultado válido — sem isso o cache nunca fica "fresh"
  // e o notify do fetch dispara reload infinito (loading ↔ empty).
  const fresh = !force && cache.fetchedAt > 0 && now - cache.fetchedAt < CACHE_TTL_MS;

  if (fresh) return cache.items;

  if (cache.promise && !force) {
    return cache.promise;
  }

  const currentRequestVersion = ++requestVersion;
  const promise = fetchOverviewItems()
    .then((items) => {
      if (currentRequestVersion !== requestVersion) return items;
      cache = { items, fetchedAt: Date.now(), promise: null };
      // Não notificar no sucesso: o bump de version é só para invalidate.
      // Notificar aqui refazia o load() dos hooks e gerava loop de fetch.
      return items;
    })
    .catch((e) => {
      if (currentRequestVersion === requestVersion) cache.promise = null;
      throw e;
    });
  cache.promise = promise;

  return promise;
}

export function invalidateRespondentOverviewCache(): void {
  requestVersion += 1;
  cache = { items: [], fetchedAt: 0, promise: null };
  notifyListeners();
}

export function subscribeRespondentOverviewCache(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
