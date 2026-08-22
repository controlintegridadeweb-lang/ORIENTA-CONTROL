import { hasAnyDatabaseErrorCode } from "@/infrastructure/supabase/database-error";
import { DomainValidationError } from "@/infrastructure/api/domain-errors";
import { cycleStateLabelOrFallback } from "@/shared/domain/cycle-labels";
import { cycleStateFromRpcMessage } from "@/features/cycles/rpc-cycle-state";

export function rpcErrorMessage(error: unknown): string {
  return typeof error === "object" && error !== null && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : "";
}

export function cycleValidationStateError(
  message: string,
  options: {
    codes: readonly string[];
    operationMessage: string;
  },
): DomainValidationError | null {
  if (!hasAnyDatabaseErrorCode(message, options.codes)) return null;

  const currentState = cycleStateFromRpcMessage(message);
  const detail = currentState
    ? ` Situação atual: ${cycleStateLabelOrFallback(currentState)}.`
    : "";

  return new DomainValidationError([
    {
      path: "_",
      message: `${options.operationMessage}${detail}`,
    },
  ]);
}
