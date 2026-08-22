import { describe, expect, it } from "vitest";
import {
  databaseErrorMessage,
  databaseErrorSqlState,
  hasAnyDatabaseErrorCode,
  hasDatabaseErrorCode,
  isForeignKeyViolation,
  isUniqueViolation,
} from "./database-error";

describe("database-error", () => {
  it("extrai mensagem e SQLSTATE sem depender do cliente do Supabase", () => {
    const error = { code: "23505", message: "duplicate key" };

    expect(databaseErrorMessage(error)).toBe("duplicate key");
    expect(databaseErrorSqlState(error)).toBe("23505");
    expect(isUniqueViolation(error)).toBe(true);
    expect(isForeignKeyViolation(error)).toBe(false);
  });

  it("reconhece códigos de domínio somente como tokens completos", () => {
    expect(hasDatabaseErrorCode("cycle_state_conflict", "cycle_state_conflict")).toBe(true);
    expect(
      hasDatabaseErrorCode(
        "Falha: cycle_state_conflict; operação cancelada.",
        "cycle_state_conflict",
      ),
    ).toBe(true);
    expect(hasDatabaseErrorCode("prefix_cycle_state_conflict_suffix", "cycle_state_conflict")).toBe(
      false,
    );
  });

  it("aceita o campo code quando a infraestrutura fornece um código estável", () => {
    expect(hasDatabaseErrorCode({ code: "cycle_not_completed" }, "cycle_not_completed")).toBe(
      true,
    );
  });

  it("avalia conjuntos de códigos sem lançar para valores desconhecidos", () => {
    expect(
      hasAnyDatabaseErrorCode({ message: "validation_unresolved_na" }, [
        "validation_pending_evidence",
        "validation_unresolved_na",
      ]),
    ).toBe(true);
    expect(hasAnyDatabaseErrorCode(null, ["validation_unresolved_na"])).toBe(false);
    expect(databaseErrorMessage(null)).toBe("");
    expect(databaseErrorSqlState({ code: 23503 })).toBeNull();
  });
});
