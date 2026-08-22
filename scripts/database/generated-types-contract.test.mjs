import { describe, expect, it } from "vitest";
import {
  compareGeneratedTypeContracts,
  extractPublicContract,
  stripGeneratorMetadata,
} from "./generated-types-contract.mjs";

const JSON_HEADER = `export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]
`;

function databaseSource({
  extraColumn = false,
  extraTable = false,
  extraRpcArg = false,
  extraEnumValue = false,
  generatorMetadata = false,
} = {}) {
  const rowColumns = extraColumn
    ? `          id: string
          period_id: string
`
    : `          id: string
`;
  const relationships = generatorMetadata
    ? `        Relationships: [
          {
            foreignKeyName: "cycles_period_id_fkey"
            columns: ["period_id"]
            isOneToOne: false
            referencedRelation: "form_periods"
            referencedColumns: ["id"]
          },
        ]
`
    : "";
  const extraTableBlock = extraTable
    ? `      obsolete_table: {
        Row: {
          id: string
        }
        Insert: {
          id: string
        }
        Update: {
          id?: string
        }
      }
`
    : "";
  const rpcArgs = extraRpcArg
    ? `          p_cycle_id: string
          p_actor: string
`
    : `          p_cycle_id: string
`;
  const setof = generatorMetadata
    ? `        SetofOptions: {
          from: "cycles"
          to: "cycles"
          isOneToOne: false
          isSetofReturn: true
        }
`
    : "";
  const enumValues = extraEnumValue
    ? `        | "draft"
        | "validated"
        | "legacy_state"
`
    : `        | "draft"
        | "validated"
`;
  const internal = generatorMetadata
    ? `  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
`
    : generatorMetadata === false && extraColumn
      ? ""
      : `  __InternalSupabase: {
    PostgrestVersion: "13.0"
  }
`;

  return `${JSON_HEADER}
export type Database = {
${internal}  public: {
    Tables: {
      cycles: {
        Row: {
${rowColumns}        }
        Insert: {
${rowColumns}        }
        Update: {
          id?: string
        }
${relationships}      }
${extraTableBlock}    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      list_cycles: {
        Args: {
${rpcArgs}        }
        Returns: {
          id: string
        }[]
${setof}      }
    }
    Enums: {
      cycle_state:
${enumValues}    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
`;
}

describe("contrato de tipos gerados do Supabase", () => {
  it("ignora metadata interna do gerador (Caso A)", () => {
    const current = databaseSource({ generatorMetadata: false });
    const generated = databaseSource({ generatorMetadata: true });

    expect(stripGeneratorMetadata(generated)).not.toContain("Relationships");
    expect(stripGeneratorMetadata(generated)).not.toContain("SetofOptions");
    expect(stripGeneratorMetadata(generated)).not.toContain("PostgrestVersion");
    expect(stripGeneratorMetadata(generated)).not.toContain("__InternalSupabase");

    const comparison = compareGeneratedTypeContracts(current, generated);
    expect(comparison.structuralDiffs).toEqual([]);
    expect(comparison.typecheck.status).toBe(0);
    expect(comparison.ok).toBe(true);
  });

  it("falha quando uma coluna consumida pela aplicação muda (Caso B)", () => {
    const current = databaseSource();
    const generated = databaseSource({ extraColumn: true });
    const comparison = compareGeneratedTypeContracts(current, generated);

    expect(comparison.ok).toBe(false);
    expect(comparison.structuralDiffs.join("\n")).toContain("period_id");
  });

  it("falha quando uma tabela, RPC ou enum realmente usados mudam (Caso B)", () => {
    const current = databaseSource();

    const extraTable = compareGeneratedTypeContracts(
      current,
      databaseSource({ extraTable: true }),
    );
    expect(extraTable.ok).toBe(false);
    expect(extraTable.structuralDiffs.join("\n")).toContain("obsolete_table");

    const extraArg = compareGeneratedTypeContracts(
      current,
      databaseSource({ extraRpcArg: true }),
    );
    expect(extraArg.ok).toBe(false);
    expect(extraArg.structuralDiffs.join("\n")).toContain("p_actor");

    const extraEnum = compareGeneratedTypeContracts(
      current,
      databaseSource({ extraEnumValue: true }),
    );
    expect(extraEnum.ok).toBe(false);
    expect(extraEnum.structuralDiffs.join("\n")).toContain("legacy_state");
  });

  it("trata Returns como Database[Tables][X][Row] equivalente ao objeto inline", () => {
    const current = databaseSource();
    const generated = current.replace(
      "        Returns: {\n          id: string\n        }[]",
      '        Returns: Database["public"]["Tables"]["cycles"]["Row"][]',
    );

    const aliased = extractPublicContract(generated);
    expect(aliased.functions.list_cycles.returns).toEqual(["id"]);

    const comparison = compareGeneratedTypeContracts(current, generated);
    expect(comparison.structuralDiffs).toEqual([]);
    expect(comparison.typecheck.status).toBe(0);
    expect(comparison.ok).toBe(true);
  });

  it("extrai Insert e Update além de Row", () => {
    const contract = extractPublicContract(databaseSource({ extraColumn: true }));
    expect(contract.tables.cycles.row).toEqual(["id", "period_id"]);
    expect(contract.tables.cycles.insert).toEqual(["id", "period_id"]);
    expect(contract.tables.cycles.update).toEqual(["id"]);
    expect(contract.functions.list_cycles.args).toEqual(["p_cycle_id"]);
    expect(contract.enums.cycle_state).toEqual(["draft", "validated"]);
  });
});
