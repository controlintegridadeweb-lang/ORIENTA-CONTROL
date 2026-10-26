import { describe, expect, it } from "vitest";
import { postgresMetaMirrorImages } from "./generate-types.mjs";

describe("espelhos da imagem postgres-meta", () => {
  it("repete a tag do ECR público no GitHub Container Registry e no Docker Hub", () => {
    expect(postgresMetaMirrorImages("public.ecr.aws/supabase/postgres-meta:v0.96.1")).toEqual([
      "ghcr.io/supabase/postgres-meta:v0.96.1",
      "supabase/postgres-meta:v0.96.1",
    ]);
  });

  it("não sugere espelho para outra imagem", () => {
    expect(postgresMetaMirrorImages("public.ecr.aws/supabase/postgres:17.6.1.107")).toEqual([]);
  });
});
