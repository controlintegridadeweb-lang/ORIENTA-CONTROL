/**
 * Contrato FAMI: a matriz oficial de pontuação deve coincidir entre
 * `calculate_live_fami_rows` (SQL vigente) e `scoreFamiCriterion` (TS).
 *
 * Fonte oficial de consolidação: SQL (finalize_validation_cycle).
 * TypeScript apresenta/simula o mesmo resultado unitário e agrega em calculateFami.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateFami,
  calculateFamiCriterion,
  scoreFamiCriterion,
} from "./fami";
import { CURRENT_FAMI_POLICY } from "./fami-policy";
import { inferRecommendationDetail } from "./recommendation-engine";
import type { QuestionInput } from "./types";

function compactSql(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

function allMigrationsSql(): string {
  const dir = join(process.cwd(), "supabase", "migrations");
  return readdirSync(dir)
    .filter((f) => /^\d{14}_.+\.sql$/.test(f))
    .sort()
    .map((f) => readFileSync(join(dir, f), "utf8"))
    .join("\n");
}

/** Espelho documentado do CASE de points_obtained vigente (Sim + eligible). */
type SqlYesCase = {
  id: string;
  requiresEvidence: boolean;
  hasApprovedEvidence: boolean;
  adminProofStatus:
    | "validated_without_proof"
    | "considered_insufficient"
    | "proof_requested"
    | null;
  hasInvalidatedEvidence: boolean;
  hasOpenEvidence: boolean;
  /** Resultado do CASE SQL vigente. */
  sqlObtained: number;
  sqlPossible: number;
};

/**
 * Deriva o obtido SQL a partir da árvore vigente (v7).
 * Mantido ao lado dos testes para falhar se o SQL mudar sem atualizar o contrato.
 */
function scoreSqlYesBranch(input: Omit<SqlYesCase, "id" | "sqlObtained" | "sqlPossible">): {
  obtained: number;
  possible: number;
} {
  const possible = input.requiresEvidence ? 2 : 1;
  if (!input.requiresEvidence) return { obtained: 1, possible };
  if (input.hasApprovedEvidence) return { obtained: 2, possible };
  return { obtained: 0, possible };
}

function toTsInput(c: SqlYesCase) {
  const isInsufficient =
    c.adminProofStatus === "considered_insufficient" ||
    (c.hasInvalidatedEvidence && !c.hasOpenEvidence && !c.hasApprovedEvidence);
  return {
    answer: "yes" as const,
    requiresEvidence: c.requiresEvidence,
    hasApprovedEvidence: c.hasApprovedEvidence,
    isInsufficient,
  };
}

const YES_CASES: SqlYesCase[] = [
  {
    id: "sim_sem_exigencia",
    requiresEvidence: false,
    hasApprovedEvidence: false,
    adminProofStatus: null,
    hasInvalidatedEvidence: false,
    hasOpenEvidence: false,
    sqlObtained: 1,
    sqlPossible: 1,
  },
  {
    id: "sim_evidencia_aprovada",
    requiresEvidence: true,
    hasApprovedEvidence: true,
    adminProofStatus: null,
    hasInvalidatedEvidence: false,
    hasOpenEvidence: false,
    sqlObtained: 2,
    sqlPossible: 2,
  },
  {
    id: "sim_validado_sem_comprovacao",
    requiresEvidence: true,
    hasApprovedEvidence: false,
    adminProofStatus: "validated_without_proof",
    hasInvalidatedEvidence: false,
    hasOpenEvidence: false,
    sqlObtained: 0,
    sqlPossible: 2,
  },
  {
    id: "sim_insuficiente_admin",
    requiresEvidence: true,
    hasApprovedEvidence: false,
    adminProofStatus: "considered_insufficient",
    hasInvalidatedEvidence: false,
    hasOpenEvidence: false,
    sqlObtained: 0,
    sqlPossible: 2,
  },
  {
    id: "sim_insuficiente_documento",
    requiresEvidence: true,
    hasApprovedEvidence: false,
    adminProofStatus: null,
    hasInvalidatedEvidence: true,
    hasOpenEvidence: false,
    sqlObtained: 0,
    sqlPossible: 2,
  },
  {
    id: "sim_pendente",
    requiresEvidence: true,
    hasApprovedEvidence: false,
    adminProofStatus: null,
    hasInvalidatedEvidence: false,
    hasOpenEvidence: true,
    sqlObtained: 0,
    sqlPossible: 2,
  },
  {
    id: "sim_proof_requested",
    requiresEvidence: true,
    hasApprovedEvidence: false,
    adminProofStatus: "proof_requested",
    hasInvalidatedEvidence: false,
    hasOpenEvidence: false,
    sqlObtained: 0,
    sqlPossible: 2,
  },
  {
    id: "sim_ausente_sem_decisao",
    requiresEvidence: true,
    hasApprovedEvidence: false,
    adminProofStatus: null,
    hasInvalidatedEvidence: false,
    hasOpenEvidence: false,
    sqlObtained: 0,
    sqlPossible: 2,
  },
];

describe("contrato FAMI SQL ↔ TypeScript", () => {
  it("política vigente é v7 sem ponto provisório em evidência", () => {
    expect(CURRENT_FAMI_POLICY.version).toBe("v7");
    expect(CURRENT_FAMI_POLICY.insufficientObtainsZero).toBe(true);
    expect(CURRENT_FAMI_POLICY.yesWithoutEvidenceWeight).toBe(1);
    expect(CURRENT_FAMI_POLICY.yesWithApprovedEvidenceWeight).toBe(2);
    expect(CURRENT_FAMI_POLICY.yesWithUnapprovedEvidenceWeight).toBe(0);
  });

  it("SQL vigente contém a árvore oficial de pontuação Sim (v7)", () => {
    const sql = compactSql(allMigrationsSql());
    expect(sql).toContain(
      "whennotrequires_evidencethen1::numericwhenhas_approved_evidencethen2::numericelse0::numeric",
    );
    expect(sql).toContain("fami_policy_version='v7'");
    expect(sql).toContain(
      "fami_policy_versionin('v3','v4','v5','v6','v7')",
    );
  });

  it("nenhum critério que exige evidência retorna 1 ponto na política vigente", () => {
    for (const c of YES_CASES.filter((row) => row.requiresEvidence)) {
      const ts = scoreFamiCriterion(toTsInput(c));
      expect(ts.obtainedPoints, c.id).not.toBe(1);
      expect(ts.possiblePoints, c.id).toBe(2);
    }
  });

  it.each(YES_CASES)(
    "caso $id: TS obtido=$sqlObtained / possível=$sqlPossible",
    (c) => {
      const derived = scoreSqlYesBranch(c);
      expect(derived.obtained).toBe(c.sqlObtained);
      expect(derived.possible).toBe(c.sqlPossible);

      const ts = scoreFamiCriterion(toTsInput(c));
      expect(ts.obtainedPoints).toBe(c.sqlObtained);
      expect(ts.possiblePoints).toBe(c.sqlPossible);
      expect(ts.includedInCalculation).toBe(true);

      const criterion = calculateFamiCriterion(toTsInput(c));
      expect(criterion.obtainedPoints).toBe(c.sqlObtained);
      expect(criterion.possiblePoints).toBe(c.sqlPossible);
    },
  );

  it("Não e Não se aplica coincidem SQL/TS", () => {
    expect(
      scoreFamiCriterion({
        answer: "no",
        requiresEvidence: true,
        hasApprovedEvidence: false,
      }),
    ).toEqual({
      obtainedPoints: 0,
      possiblePoints: 2,
      includedInCalculation: true,
    });
    expect(
      scoreFamiCriterion({
        answer: "not_applicable",
        requiresEvidence: true,
        hasApprovedEvidence: false,
      }),
    ).toEqual({
      obtainedPoints: 0,
      possiblePoints: 0,
      includedInCalculation: false,
    });
  });

  it("calculateFami agrega insuficiência documental como 0", () => {
    const q = (over: Partial<QuestionInput> & { id: string }): QuestionInput => ({
      axisId: "a",
      sectionId: "s",
      famiEnabled: true,
      requiresEvidence: true,
      answer: "yes",
      ...over,
    });
    const result = calculateFami([
      q({ id: "ok", validationStatus: "approved" }),
      q({ id: "bad", validationStatus: "invalidated" }),
    ]);
    expect(result.policyVersion).toBe("v7");
    expect(result.global.pointsObtained).toBe(2);
    expect(result.global.pointsPossible).toBe(4);
  });

  it("finalize vigente bloqueia evidência pendente e decisão administrativa", () => {
    const sql = compactSql(allMigrationsSql());
    expect(sql).toContain("validation_unresolved_evidence");
    expect(sql).toContain("validation_unresolved_absent_proof");
    expect(sql).toContain("get_validation_finalization_readiness");
  });
});

describe("contrato recomendações SQL ↔ TypeScript", () => {
  it("SQL gera evidencia_insuficiente para admin e documento", () => {
    const sql = compactSql(allMigrationsSql());
    expect(sql).toContain("admin_proof_status='considered_insufficient'");
    expect(sql).toContain("'evidencia_insuficiente'::public.recommendation_type");
    expect(sql).toContain("'ausencia_evidencia'::public.recommendation_type");
  });

  it("TS espelha insuficiência admin sem documento", () => {
    expect(
      inferRecommendationDetail({
        answer: "yes",
        requiresEvidence: true,
        hasEvidence: false,
        adminProofStatus: "considered_insufficient",
        famiEnabled: true,
      }),
    ).toEqual({
      tipo: "evidencia_insuficiente",
      trigger: "evidencia_invalida",
    });
  });

  it("TS espelha ausência quando não há decisão de insuficiência", () => {
    expect(
      inferRecommendationDetail({
        answer: "yes",
        requiresEvidence: true,
        hasEvidence: false,
        adminProofStatus: "validated_without_proof",
        famiEnabled: true,
      }),
    ).toEqual({
      tipo: "ausencia_evidencia",
      trigger: "evidencia_ausente",
    });
  });

  it("TS espelha documento invalidado", () => {
    expect(
      inferRecommendationDetail({
        answer: "yes",
        requiresEvidence: true,
        hasEvidence: true,
        validationStatus: "invalidated",
        famiEnabled: true,
      }),
    ).toEqual({
      tipo: "evidencia_insuficiente",
      trigger: "evidencia_invalida",
    });
  });

  it("N/A não gera recomendação", () => {
    expect(
      inferRecommendationDetail({
        answer: "yes",
        requiresEvidence: true,
        hasEvidence: false,
        isNotApplicable: true,
        famiEnabled: true,
      }),
    ).toBeNull();
  });
});

describe("fonte oficial documentada", () => {
  it("SQL é a fonte de consolidação; TS é espelho unitário", () => {
    const sql = allMigrationsSql();
    expect(sql).toContain("create or replace function public.calculate_live_fami_rows");
    expect(sql).toContain("set fami_policy_version = 'v7'");
    expect(typeof scoreFamiCriterion).toBe("function");
    expect(CURRENT_FAMI_POLICY.version).toBe("v7");
  });
});
