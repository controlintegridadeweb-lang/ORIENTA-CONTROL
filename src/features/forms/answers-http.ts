import { requireUuid } from "@/infrastructure/api/with-route";
import { FormsValidationError } from "./admin-service";
import { parseStatusFilter } from "./answers-service";
import type {
  AnswersListFilters,
  RespondentListCursor,
} from "./answers-types";

function parseIsoDate(raw: string | null, path: string): string | null {
  if (!raw) return null;
  if (Number.isNaN(Date.parse(raw))) {
    throw new FormsValidationError([
      { path, message: `${path} deve ser uma data ISO valida.` },
    ]);
  }
  return raw;
}

/** Converte os filtros HTTP compartilhados pelas listagens e exportações. */
export function parseAnswersListFilters(searchParams: URLSearchParams): AnswersListFilters {
  const organizationId = searchParams.get("organizationId");

  return {
    organizationId: organizationId ? requireUuid(organizationId, "organizationId") : null,
    status: parseStatusFilter(searchParams.get("status")),
    from: parseIsoDate(searchParams.get("from"), "from"),
    to: parseIsoDate(searchParams.get("to"), "to"),
  };
}

/** Cursor opcional da paginação determinística de respondentes. */
export function parseRespondentListCursor(
  searchParams: URLSearchParams,
): RespondentListCursor | null {
  const updatedAt = searchParams.get("cursorUpdatedAt");
  const cycleId = searchParams.get("cursorCycleId");
  if (!updatedAt || !cycleId) return null;

  const parsedUpdatedAt = parseIsoDate(updatedAt, "cursorUpdatedAt");
  return parsedUpdatedAt
    ? { updatedAt: parsedUpdatedAt, cycleId: requireUuid(cycleId, "cursorCycleId") }
    : null;
}

/** Limite opcional da paginação; a limitação máxima permanece no serviço. */
export function parseRespondentListLimit(searchParams: URLSearchParams): number | undefined {
  const raw = searchParams.get("limit");
  if (!raw) return undefined;

  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new FormsValidationError([
      { path: "limit", message: "limit deve ser um numero positivo." },
    ]);
  }

  return Math.floor(value);
}
