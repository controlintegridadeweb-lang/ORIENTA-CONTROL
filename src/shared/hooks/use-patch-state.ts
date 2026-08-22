"use client";

import { useReducer } from "react";

type StatePatch<State extends object> =
  | Partial<State>
  | ((current: State) => Partial<State>);

function patchReducer<State extends object>(
  current: State,
  patch: StatePatch<State>,
): State {
  const changes = typeof patch === "function" ? patch(current) : patch;
  return { ...current, ...changes };
}

/**
 * Agrupa estado local coeso sem perder atualizações funcionais.
 * Deve ser usado apenas quando os campos pertencem ao mesmo contexto de UI.
 */
export function usePatchState<State extends object>(initial: State) {
  return useReducer(patchReducer<State>, initial);
}
